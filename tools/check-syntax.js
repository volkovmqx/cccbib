#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const dist = path.join(__dirname, '..', 'dist');
let failed = false;

for (const file of fs.readdirSync(dist).filter((name) => name.endsWith('.js'))) {
  try {
    acorn.parse(fs.readFileSync(path.join(dist, file), 'utf8'), { ecmaVersion: 2019 });
  } catch (error) {
    failed = true;
    console.error(`${file}: ${error.message}`);
  }
}

if (failed) {
  console.error('Build output has syntax newer than ES2019, which Chrome 68 (webOS 5) cannot parse.');
  process.exit(1);
}
console.log('Build output is ES2019 compatible.');
