const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const { fixture } = require('./fixtures.cjs');

const revision = '561732';
async function main() {
  const server = fork(path.join(__dirname, 'server.cjs'), [], { env: { ...process.env, TEST_PORT: '3335' }, stdio: 'inherit' });
  let browser;
  let page;
  const errors = [];
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch('http://127.0.0.1:3335')).ok) { ready = true; break; } } catch { }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Production server did not start. Run yarn build first.');
    let executablePath = process.env.CHROME68_EXECUTABLE_PATH;
    if (!executablePath) {
      const fetcher = puppeteer.createBrowserFetcher({ path: process.env.CHROME68_CACHE || path.join(os.tmpdir(), 'cccbib-chrome68') });
      executablePath = (await fetcher.download(revision)).executablePath;
    }
    browser = await puppeteer.launch({ executablePath, headless: true,
      env: { ...process.env, FONTCONFIG_FILE: path.join(__dirname, 'fonts.conf') },
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
    assert.match(await browser.version(), /(?:Chrome|Chromium)\/68\./);
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', async request => {
      if (new URL(request.url()).hostname === '127.0.0.1') return request.continue();
      try {
        const response = fixture(request.url(), request.postData(), request.method());
        if (!response) throw Error(`Unexpected external request: ${request.url()}`);
        await request.respond({ ...response, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, accept' } });
      } catch (error) {
        errors.push(String(error));
        await request.abort();
      }
    });
    await page.goto('http://127.0.0.1:3335');
    await page.waitForFunction(() => !document.getElementById('boot'));
    assert.equal(await page.$eval('.carouselTitle', element => element.textContent), 'Fixture conference 0');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.embla__slide.active .embla__slide__title').textContent === 'Other talk 0');
    await page.evaluate(() => Array.from(document.querySelectorAll('.sidebarItem')).find(element => element.textContent.includes('Search')).click());
    await page.waitForSelector('.searchContainer');
    await page.type('input', 'fixture');
    await page.waitForSelector('.searchResults .listItem');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForSelector('video.player-video');
    await page.waitForFunction(() => document.querySelector('video.player-video').currentTime > 0);
    await page.keyboard.press('ArrowUp');
    for (let index = 0; index < 3; index++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForSelector('button[aria-label="In Watchlist"]');
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('boot'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('watchlist'))[0].guid), 'talk');
    assert.deepEqual(errors, []);
    console.log('Chrome 68: startup, lazy screens, navigation, video, and persistence passed.');
  } catch (error) {
    fs.mkdirSync('test-results', { recursive: true });
    if (page) await page.screenshot({ path: 'test-results/chrome68.png' }).catch(() => {});
    fs.writeFileSync('test-results/chrome68.log', [String(error.stack || error), ...errors].join('\n'));
    throw error;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
