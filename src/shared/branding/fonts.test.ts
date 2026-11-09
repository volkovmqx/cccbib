import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { SETTING_DEFAULTS, UI_FONTS } from '@/shared/config/constants';

const fontsDir = join(process.cwd(), 'src/shared/branding/fonts');
const faces = readFileSync(join(process.cwd(), 'src/app/styles/fonts.css'), 'utf8');
const files = readdirSync(fontsDir).filter(name => name.endsWith('.woff2')).sort();

const NUMBERED_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

const readTables = (font: Buffer) => {
  const tables: { tag: string; length: number; stored: number }[] = [];
  let at = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = font[at++];
      value = value * 128 + (byte & 127);
      if (!(byte & 128)) break;
    }
    return value;
  };
  for (let i = 0; i < font.readUInt16BE(12); i++) {
    const flags = font[at++];
    const index = flags & 63;
    const tag = index === 63 ? font.toString('latin1', at, (at += 4)) : NUMBERED_TAGS[index];
    const version = flags >> 6;
    const length = base128();
    const stored = (tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0) ? base128() : length;
    tables.push({ tag, length, stored });
  }
  return { tables, end: at };
};

const tableSizes = (font: Buffer) => Object.fromEntries(readTables(font).tables.map(({ tag, length }) => [tag, length]));

const mapped = (cmap: Buffer, found: Set<number>) => {
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const at = cmap.readUInt32BE(8 + i * 8);
    const format = cmap.readUInt16BE(at);
    if (format === 12) {
      for (let group = 0; group < cmap.readUInt32BE(at + 12); group++) {
        for (let code = cmap.readUInt32BE(at + 16 + group * 12); code <= cmap.readUInt32BE(at + 20 + group * 12); code++) found.add(code);
      }
    } else if (format === 4) {
      const segments = cmap.readUInt16BE(at + 6) / 2;
      const ends = at + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const offsets = deltas + segments * 2;
      for (let segment = 0; segment < segments; segment++) {
        const first = cmap.readUInt16BE(starts + segment * 2);
        const delta = cmap.readUInt16BE(deltas + segment * 2);
        const offset = cmap.readUInt16BE(offsets + segment * 2);
        for (let code = first; code <= cmap.readUInt16BE(ends + segment * 2) && code < 0xffff; code++) {
          const glyph = offset === 0 ? code : cmap.readUInt16BE(offsets + segment * 2 + offset + (code - first) * 2);
          if (glyph && ((glyph + delta) & 0xffff)) found.add(code);
        }
      }
    }
  }
};

const letters = (font: Buffer) => {
  const { tables, end } = readTables(font);
  const data = brotliDecompressSync(Uint8Array.from(font.subarray(end, end + font.readUInt32BE(20))));
  const found = new Set<number>();
  let at = 0;
  for (const { tag, stored } of tables) {
    if (tag === 'cmap') mapped(data.subarray(at, at + stored), found);
    at += stored;
  }
  return found;
};

const outlineBytes = (name: string) => tableSizes(readFileSync(join(fontsDir, name))).glyf;

const OUTLINE_BUDGET = 256 * 1024;
const NO_CZECH_OR_POLISH = ['Silkscreen.woff2'];

const localesDir = join(process.cwd(), 'src/shared/i18n/locales');
const wanted = (skip: string[]) => {
  const text = readdirSync(localesDir).filter(name => name.endsWith('.ts') && !skip.includes(name)).map(name => readFileSync(join(localesDir, name), 'utf8')).join('');
  return [...new Set(`${text}„“”‚‘’«»‹›\u2013\u2014…•€·×`.match(/[^\x00-\x7f]/g))].filter(char => char !== '♥');
};
const missingFrom = (name: string, chars: string[]) => {
  const have = letters(readFileSync(join(fontsDir, name)));
  return chars.filter(char => !have.has(char.codePointAt(0) as number)).join('');
};

test('the table directory of a font file is read, including tables that carry a second length', () => {
  const entries = [
    10, 0x82, 0x2c, 0x81, 0x7a,
    63, ...Buffer.from('abcd', 'latin1'), 5,
    11 | (3 << 6), 7,
    47, 12,
  ];
  const font = Buffer.alloc(48 + entries.length);
  font.write('wOF2', 0, 'latin1');
  font.writeUInt16BE(4, 12);
  font.set(entries, 48);
  expect(tableSizes(font)).toEqual({ glyf: 300, abcd: 5, loca: 7, fvar: 12 });
});

test('every font file is declared in the font faces and every declared file exists', () => {
  const declared = [...new Set([...faces.matchAll(/branding\/fonts\/([^')]+)'\)/g)].map(match => match[1]))].sort();
  expect(declared).toEqual(files);
});

test('every font of the Font setting has a font face and every font face belongs to a font of the setting', () => {
  const families = UI_FONTS.flatMap(font => (font.family ? [font.family] : []));
  const declared = [...new Set([...faces.matchAll(/font-family: '([^']+)'/g)].map(match => match[1]))];
  expect(declared.sort()).toEqual([...families].sort());
});

test('no bundled font is a variable font, because those render with overlapping letters on webOS 5', () => {
  for (const name of files) {
    const sizes = tableSizes(readFileSync(join(fontsDir, name)));
    expect(sizes.fvar, name).toBeUndefined();
    expect(sizes.gvar, name).toBeUndefined();
  }
});

test('the outlines of a bundled font stay light, because heavy ones cost the TV frames on every new text', () => {
  for (const name of files) {
    const size = outlineBytes(name);
    expect(size, name).toBeGreaterThan(0);
    expect(size, name).toBeLessThanOrEqual(OUTLINE_BUDGET);
  }
});

test('the font used by default is the system font, so nobody pays for a bundled font without choosing one', () => {
  for (const code of [SETTING_DEFAULTS.uiFont, SETTING_DEFAULTS.subtitleFont]) expect(UI_FONTS.find(font => font.code === code)?.family, code).toBeNull();
});

test('every bundled font has the letters of the other languages and the typographic quotes', () => {
  const western = wanted(['cs.ts', 'pl.ts']);
  for (const name of files) expect(missingFrom(name, western), name).toBe('');
});

test('every bundled font has the Czech and Polish letters, except those known to fall back to the system font for them', () => {
  const everything = wanted([]);
  for (const name of files) expect(missingFrom(name, everything) === '', name).toBe(!NO_CZECH_OR_POLISH.includes(name));
});
