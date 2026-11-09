const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const BOOT_FILES = ['voctocat.html', 'loaders.css', 'canvases.css', 'loaders.json'].map((name) => path.resolve(__dirname, '../src/shared/branding', name));

function injectBoot(html) {
  const voctocat = read('src/shared/branding/voctocat.html').trim();
  const css = read('src/shared/branding/loaders.css').trim();
  const canvases = read('src/shared/branding/canvases.css').trim();
  const markup = JSON.stringify(JSON.parse(read('src/shared/branding/loaders.json')));
  return html
    .replace('<!--VOCTOCAT-->', () => voctocat)
    .replace('<!--LOADER_CSS-->', () => css)
    .replace('<!--CANVAS_CSS-->', () => canvases)
    .replace('<!--LOADER_MARKUP-->', () => markup);
}

module.exports = { injectBoot, BOOT_FILES };
