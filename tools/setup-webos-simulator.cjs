const { createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');
const { mkdir, rm, rename, chmod, stat } = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const pin = {
  version: '26-1.5.0',
  url: 'https://gfts.lge.com/fts/gftsFilePathDownload.lge?key=dlRF00021103&hash=3mRAeemt6icWHcOx&mtime=1774402895031',
  sha256: '8668c06503e82a52303e8c31e90c458c1d7c4d6dc74151ae6fc53df37e368d4e',
};
const cacheDir = path.resolve('.cache/webos-simulator');
const archive = path.join(cacheDir, `${pin.version}-${pin.sha256}.zip`);
const executable = path.join(cacheDir, 'runtime/squashfs-root/webOS_TV_26_Simulator_1.5.0');

async function verify(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const actual = hash.digest('hex');
  if (actual !== pin.sha256) throw new Error(`Simulator SHA-256 mismatch: ${actual}`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.status}`);
}

async function setup() {
  if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('The pinned Simulator requires Linux x64.');
  await mkdir(cacheDir, { recursive: true });
  if (!await stat(archive).catch(() => null)) {
    const partial = `${archive}.partial`;
    try {
      run('curl', ['--fail-with-body', '--location', '--retry', '2', '--max-time', '180',
        '--referer', 'https://webostv.developer.lge.com/', '--user-agent', 'Mozilla/5.0', '--output', partial, pin.url]);
      await verify(partial);
      await rename(partial, archive);
    } finally { await rm(partial, { force: true }); }
  }
  // Verify cache hits too. Always extract from the verified archive.
  await verify(archive);
  const runtime = path.join(cacheDir, 'runtime');
  await rm(runtime, { recursive: true, force: true });
  await mkdir(runtime);
  run('unzip', ['-q', archive, '-d', runtime]);
  const appImage = path.join(runtime, 'webOS_TV_26_Simulator_1.5.0/webOS_TV_26_Simulator_1.5.0.AppImage');
  await chmod(appImage, 0o755);
  run(appImage, ['--appimage-extract'], runtime);
  console.log(JSON.stringify({ ...pin, executable }, null, 2));
}

module.exports = { pin, cacheDir, archive, executable };
if (require.main === module) {
  if (process.argv.includes('--cache-key')) console.log(`webos-simulator-${pin.version}-${pin.sha256}`);
  else setup().catch(error => { console.error(error); process.exitCode = 1; });
}
