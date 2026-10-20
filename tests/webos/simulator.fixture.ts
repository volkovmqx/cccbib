import { test as base, expect, chromium, type Browser, type CDPSession, type Page, type TestInfo } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import os from 'node:os';

const { pin, executable } = require('../../tools/setup-webos-simulator.cjs') as {
  pin: { version: string; sha256: string; url: string }; executable: string;
};
const { fixture } = require('../browser/fixtures.cjs') as {
  fixture(url: string, body: string, method: string): { status?: number; contentType: string; body: string | Buffer } | null;
};
const appURL = pathToFileURL(path.resolve('dist/index.html')).href;
const redact = (text: string) => text.replace(/([?&]api_secret=)[^&\s'"\\]+/g, '$1<REDACTED>');

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No CDP port.');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

export class Simulator {
  page!: Page;
  private browser?: Browser;
  private input?: CDPSession;
  private child?: ChildProcess;
  private launches = 0;
  private output = '';
  private errors: string[] = [];
  private consoleErrors: string[] = [];
  private unexpected: string[] = [];
  private failurePath?: string;
  failedRequests = 0;

  constructor(private storage: string, private info: TestInfo) {}

  async start() {
    const port = await freePort();
    const args = [path.resolve('dist'), '{}', '--ozone-platform=x11', '--no-sandbox',
      `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${this.storage}`, '--autoplay-policy=no-user-gesture-required', '--enable-automation',
      // Block network access before CDP interception is installed.
      '--host-resolver-rules=MAP * ~NOTFOUND', '--disable-gpu', '--disable-dev-shm-usage'];
    this.launches++;
    await writeFile(this.info.outputPath(`launch-${this.launches}.json`), JSON.stringify({ pin, executable, args }, null, 2));
    this.child = spawn(executable, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, XDG_CONFIG_HOME: path.join(this.storage, 'config'), XDG_CACHE_HOME: path.join(this.storage, 'cache'),
        HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', ALL_PROXY: 'http://127.0.0.1:9', NO_PROXY: '',
        http_proxy: 'http://127.0.0.1:9', https_proxy: 'http://127.0.0.1:9', all_proxy: 'http://127.0.0.1:9', no_proxy: '' } });
    this.child.stdout?.on('data', chunk => { this.output += chunk.toString(); });
    this.child.stderr?.on('data', chunk => { this.output += chunk.toString(); });
    let startupError: Error | undefined;
    this.child.on('error', error => { startupError = error; });
    const endpoint = `http://127.0.0.1:${port}`;
    await expect.poll(async () => {
      if (startupError) throw startupError;
      if (this.child?.exitCode !== null) throw new Error(`Simulator exited: ${this.child?.exitCode}`);
      return fetch(`${endpoint}/json/version`).then(r => r.ok).catch(() => false);
    }, { timeout: 30_000, message: 'Simulator must expose CDP.' }).toBe(true);
    this.browser = await chromium.connectOverCDP(endpoint, { timeout: 15_000 });
    const context = this.browser.contexts()[0];
    if (!context) throw new Error('Simulator has no default context.');
    await context.route('**/*', async route => {
      const request = route.request();
      if ([path.resolve('dist'), path.dirname(executable)].some(directory =>
        request.url().startsWith(pathToFileURL(directory + path.sep).href))) {
        await route.continue(); return;
      }
      const response = fixture(request.url(), request.postData() || '', request.method());
      if (!response) {
        this.unexpected.push(request.url());
        await route.abort('blockedbyclient'); return;
      }
      if (this.failurePath && request.url().includes(this.failurePath) && request.method() !== 'OPTIONS') {
        this.failurePath = undefined;
        this.failedRequests++;
        await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Fixture request failure',
          headers: { 'Access-Control-Allow-Origin': '*' } });
        return;
      }
      const headers: Record<string, string> = { 'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, accept, range' };
      if (Buffer.isBuffer(response.body)) {
        const size = response.body.length;
        headers['Accept-Ranges'] = 'bytes';
        const range = request.headers().range;
        if (range) {
          const match = /^bytes=(\d+)-(\d*)$/.exec(range);
          if (!match) throw new Error(`Unsupported fixture range: ${range}`);
          const start = Number(match[1]);
          const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
          if (start > end) {
            await route.fulfill({ status: 416, body: '', headers: { ...headers, 'Content-Range': `bytes */${size}` } });
            return;
          }
          headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
          response.body = response.body.subarray(start, end + 1);
          response.status = 206;
        }
        headers['Content-Length'] = String(response.body.length);
      }
      await route.fulfill({ ...response, headers });
    });
    await expect.poll(() => context.pages().filter(page => page.url() === appURL).length,
      { timeout: 15_000, message: 'Simulator must create exactly one application target.' }).toBe(1);
    this.page = context.pages().find(page => page.url() === appURL)!;
    this.page.on('pageerror', error => this.errors.push(error.message));
    this.page.on('console', message => { if (message.type() === 'error') this.consoleErrors.push(message.text()); });
    this.input = await context.newCDPSession(this.page);
    const runtime = await this.input.send('Browser.getVersion');
    const commandLine = await this.input.send('Browser.getBrowserCommandLine');
    const target = await this.input.send('Target.getTargetInfo');
    await writeFile(this.info.outputPath(`runtime-${this.launches}.json`), JSON.stringify({ runtime, target, args,
      actualArguments: commandLine.arguments,
      node: process.version, playwright: require('@playwright/test/package.json').version,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`, display: process.env.DISPLAY }, null, 2));
    // The tested navigation starts only after routing and error collection are ready.
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  async key(key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Enter' | 'Back') {
    if (!this.input) throw new Error('Simulator input is not connected.');
    const keyCode = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Enter: 13, Back: 461 }[key];
    for (const type of ['rawKeyDown', 'keyUp'] as const) {
      await this.input.send('Input.dispatchKeyEvent', { type, key: key === 'Back' ? 'Unidentified' : key,
        code: key === 'Back' ? '' : key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    }
    await this.page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  }

  async dismissKeyboard() {
    const context = this.browser?.contexts()[0];
    if (!context) throw new Error('Simulator is not connected.');
    const remote = context.pages().find(page => page.url().endsWith('/screen/rcu/index.html'));
    if (!remote) throw new Error('The Simulator remote target is missing.');
    const keyboardVisible = () => this.page.evaluate(() =>
      (window.webOSSystem as { isKeyboardVisible: boolean }).isKeyboardVisible);
    await expect.poll(keyboardVisible).toBe(true);
    // Use LG's remote to close the virtual keyboard before application navigation.
    await remote.getByTestId('buttonRCU-Back').click();
    await expect.poll(keyboardVisible).toBe(false);
  }

  failNextRequest(path: string) { this.failurePath = path; }

  async restart() {
    await this.page.screenshot({ path: this.info.outputPath(`before-restart-${this.launches}.png`) });
    await this.stop();
    await this.start();
  }

  async stop() {
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = undefined;
    if (this.child?.pid) {
      const pid = this.child.pid;
      try { process.kill(-pid, 'SIGTERM'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
      await new Promise<void>(resolve => {
        if (this.child?.exitCode !== null) { resolve(); return; }
        const timer = setTimeout(resolve, 3000);
        this.child?.once('exit', () => { clearTimeout(timer); resolve(); });
      });
      try { process.kill(-pid, 'SIGKILL'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
    }
    this.child = undefined;
    await writeFile(this.info.outputPath('simulator.log'), redact(this.output));
    await writeFile(this.info.outputPath('console-errors.json'), redact(JSON.stringify({ exceptions: this.errors, consoleErrors: this.consoleErrors }, null, 2)));
  }

  async finish() {
    try {
      if (this.page && !this.page.isClosed()) {
        const screenshot = this.info.outputPath('application.png');
        await this.page.screenshot({ path: screenshot });
        await this.info.attach('application', { path: screenshot, contentType: 'image/png' });
      }
    } finally { await this.stop(); }
    expect(this.unexpected, 'Unexpected external requests').toEqual([]);
    expect(this.errors, 'Application exceptions').toEqual([]);
  }
}

export const test = base.extend<{ simulator: Simulator }>({
  simulator: async ({}, use, info) => {
    await mkdir(info.outputDir, { recursive: true });
    const storage = await mkdtemp(path.join(os.tmpdir(), 'cccbib-webos-'));
    const simulator = new Simulator(storage, info);
    try { await simulator.start(); await use(simulator); }
    finally { try { await simulator.finish(); } finally { await rm(storage, { recursive: true, force: true }); } }
  },
});
export { expect };
