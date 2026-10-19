const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const CATALOGS = fs.readdirSync(path.join(SRC, 'locales')).filter((file) => file.endsWith('.js'));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'assets' || entry.name === 'locales' ? [] : walk(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

const unescape = (text) => text.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
const STRING = String.raw`'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"`;
const pick = (match) => unescape(match[1] !== undefined ? match[1] : match[2]);

const files = walk(SRC);
const sources = files.map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
const used = new Map();
const add = (text, where) => { if (text && /[A-Za-z]/.test(text)) used.set(text, where); };

sources.forEach(({ file, text }) => {
  const name = path.relative(SRC, file);
  for (const match of text.matchAll(new RegExp(String.raw`\bt\(\s*(?:${STRING})`, 'g'))) add(pick(match), name);
  if (name === 'constants.js') {
    text.split('\n').forEach((line) => {
      if (/family:|native: true/.test(line)) return;
      for (const match of line.matchAll(new RegExp(String.raw`\bname:\s*(?:${STRING})`, 'g'))) add(pick(match), name);
    });
    for (const match of text.matchAll(/\? '(Normal[^']*)'/g)) add(match[1], name);
  }
  if (name === path.join('components', 'Settings.jsx')) {
    for (const match of text.matchAll(new RegExp(String.raw`\b(?:title|description|label|button):\s*(?:${STRING})`, 'g'))) add(pick(match), name);
  }
});

const allText = sources.map((source) => source.text).join('\n');
let failed = false;

CATALOGS.forEach((file) => {
  const module = { exports: {} };
  new Function('module', fs.readFileSync(path.join(SRC, 'locales', file), 'utf8').replace('export default', 'module.exports ='))(module);
  const catalog = module.exports;
  const keys = Object.keys(catalog);
  const missing = [...used.keys()].filter((text) => !(text in catalog));
  const stale = keys.filter((key) => !allText.includes(key.replace(/\n/g, '\\n')));
  const dashes = keys.concat(Object.values(catalog)).filter((text) => /[\u2013\u2014]/.test(text));
  const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort().join(',');
  const broken = keys.filter((key) => typeof catalog[key] !== 'string' || !catalog[key].trim() || placeholders(key) !== placeholders(catalog[key]));
  if (missing.length || stale.length || dashes.length || broken.length) failed = true;
  broken.forEach((key) => console.error(`${file}: empty value or changed {placeholders} for ${JSON.stringify(key)}`));
  missing.forEach((text) => console.error(`${file}: missing ${JSON.stringify(text)} (${used.get(text)})`));
  stale.forEach((key) => console.error(`${file}: unused ${JSON.stringify(key)}`));
  dashes.forEach((text) => console.error(`${file}: dash in ${JSON.stringify(text)}`));
  if (!missing.length && !stale.length && !dashes.length && !broken.length) console.log(`${file}: ${keys.length} strings, complete`);
});

process.exit(failed ? 1 : 0);
