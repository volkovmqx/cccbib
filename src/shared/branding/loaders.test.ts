import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { expect, test } from 'vitest';
import { LOADER_STYLES, SPINNER_STYLES } from '@/shared/config/constants';
import markup from './loaders.json';

const css = readFileSync(join(process.cwd(), 'src/shared/branding/loaders.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const { injectBoot } = createRequire(import.meta.url)('../../../tools/index-html.js') as { injectBoot: (html: string) => string };
const entries = markup as Record<string, string>;

test('every loading animation has styles and no markup without a loading animation', () => {
  for (const { code } of LOADER_STYLES) expect(css, String(code)).toMatch(new RegExp(`\\.loader-${code}\\b`));
  const codes = SPINNER_STYLES.map(style => String(style.code));
  expect(Object.keys(entries).filter(code => !codes.includes(code))).toEqual([]);
});

test('loading animations take all their colours from the accent and the theme', () => {
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  expect(css).not.toMatch(/rgba?\(\s*\d/);
  expect(css).not.toMatch(/\b(?:white|black|red|green|blue|yellow|orange|purple|gray|grey)\b/);
  const allowed = ['--s', '--w', '--h', '--d', '--boot-scale', '--accent', '--accent-rgb', '--text', '--text-rgb', '--bg'];
  const used = [...new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]))];
  expect(used.filter(name => !allowed.includes(name))).toEqual([]);
  for (const html of Object.values(entries)) expect(html).not.toMatch(/\b(?:fill|stroke|style|color)=/);
});

const keyframesOf = (name: string) => {
  const start = css.indexOf(`@keyframes ${name} {`);
  if (start < 0) return '';
  let depth = 0;
  for (let index = css.indexOf('{', start); index < css.length; index++) {
    if (css[index] === '{') depth++;
    if (css[index] === '}' && --depth === 0) return css.slice(start, index + 1);
  }
  return '';
};

test('the wheel, orbit, ring, dots, pulse, squares, ball, blocks, glider and rocket are drawn in the accent and in the text colour', () => {
  const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1], body: match[2] }));
  for (const code of ['wheel', 'orbit', 'ring', 'dots', 'spin', 'pulse', 'squares', 'ball', 'blocks', 'glider', 'rocket']) {
    const bodies = rules.filter(rule => new RegExp(`\\.loader-${code}\\b`).test(rule.selector)).map(rule => rule.body).join('\n');
    const own = bodies + (bodies.match(/\b(?:loader|spinner)-[\w-]+/g) || []).map(keyframesOf).join('\n');
    expect(own, code).toMatch(/var\(--accent(?:-rgb)?\)/);
    expect(own, code).toMatch(/var\(--text(?:-rgb)?\)/);
  }
});

test('the four phases of the glider on its fixed grid follow each other by the rules of the Game of Life', () => {
  const cells = [...entries.glider.matchAll(/<circle class="(\w+)" cx="([\d.]+)" cy="([\d.]+)"/g)].map(match => ({ cls: match[1], x: Number(match[2]) - 0.5, y: Number(match[3]) - 0.5 }));
  expect(cells).toHaveLength(9);
  const phases = [0, 1, 2, 3].map(generation => new Set(cells.filter(cell => cell.cls === 'on' || cell.cls.slice(1)[generation] === '1').map(cell => `${cell.x},${cell.y}`)));
  for (const cell of cells.filter(item => item.cls !== 'on')) {
    expect([...keyframesOf(`loader-glider-${cell.cls.slice(1)}`).matchAll(/opacity: (\d)/g)].map(match => match[1]).join(''), cell.cls).toBe(cell.cls.slice(1));
  }
  const normalise = (alive: Set<string>) => {
    const points = [...alive].map(key => key.split(',').map(Number));
    const [left, top] = [Math.min(...points.map(point => point[0])), Math.min(...points.map(point => point[1]))];
    return points.map(([x, y]) => `${x - left},${y - top}`).sort();
  };
  const next = (alive: Set<string>) => {
    const counts = new Map<string, number>();
    for (const key of alive) {
      const [x, y] = key.split(',').map(Number);
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
        if (dx || dy) counts.set(`${x + dx},${y + dy}`, (counts.get(`${x + dx},${y + dy}`) || 0) + 1);
      }
    }
    return new Set([...counts].filter(([key, count]) => count === 3 || (count === 2 && alive.has(key))).map(([key]) => key));
  };
  phases.forEach((alive, generation) => {
    expect(alive.size, `phase ${generation}`).toBe(5);
    expect(normalise(next(alive)), `phase ${generation}`).toEqual(normalise(phases[(generation + 1) % 4]));
  });
});

test('every animation the loading styles use is defined', () => {
  const defined = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(match => match[1]));
  const used = [...css.matchAll(/animation(?:-name)?\s*:\s*([\w-]+)\s/g)].map(match => match[1]).filter(name => !/^(?:none|infinite)$/.test(name));
  expect(used.filter(name => !defined.has(name))).toEqual([]);
  expect(defined.size).toBeGreaterThan(15);
});

test('the boot screen gets the voctocat, the loading animation styles and their markup written into it', () => {
  const html = readFileSync(join(process.cwd(), 'src/index.html'), 'utf8');
  expect(html).toContain('<!--LOADER_CSS-->');
  expect(html).toContain('<!--LOADER_MARKUP-->');
  expect(html).toContain('<!--CANVAS_CSS-->');
  const built = injectBoot(html);
  expect(built).not.toMatch(/<!--(?:VOCTOCAT|LOADER_CSS|LOADER_MARKUP|CANVAS_CSS)-->/);
  for (const theme of ['ambient', 'ember', 'sunset', 'frost', 'paper', 'nocturne', 'abyss', 'cyberpunk', 'terminal', 'chicago']) expect(built, theme).toContain(`html[data-theme='${theme}']`);
  expect(built).toContain("html[data-canvas='glow'] #boot { background: var(--canvas), var(--bg); }");
  for (const { code } of LOADER_STYLES) expect(built, String(code)).toContain(`.loader-${code}`);
  const script = /var markup = (\{.*\});/.exec(built);
  expect(script).not.toBeNull();
  expect(JSON.parse(script![1])).toEqual(entries);
  expect(built).toContain('class="voctocat"');
});

test('the rocket of the CCC logo flies diagonally, its flame swells in bursts and every burst pushes it on and sends puffs back', () => {
  const html = entries.rocket;
  expect(html).toContain('rotate(-20)');
  expect(html).toContain('translate(-71.638 684.758)');
  for (const part of ['ship', 'burst', 'port']) expect(html, part).toContain(`class="${part}"`);
  expect(html.match(/class="body"/g)).toHaveLength(1);
  expect(html.match(/class="line"/g)).toHaveLength(4);
  expect(html.match(/class="heat"/g)).toHaveLength(1);
  expect(html.match(/class="fire"/g)).toHaveLength(1);
  expect(html.match(/class="puff [abc]"/g)).toHaveLength(3);
  expect(html.indexOf('class="burst"')).toBeGreaterThan(html.indexOf('class="port"'));
  for (const name of ['rocket-thrust', 'rocket-burst', 'rocket-puff']) expect(keyframesOf(name), name).toContain('transform');
  expect(keyframesOf('rocket-puff')).toContain('opacity');
  const delays = [...css.matchAll(/\.loader-rocket \.puff\.([abc]) \{[^}]*animation-delay: (-?[\d.]+)s/g)].map(match => Number(match[2]));
  expect(delays).toEqual([-0.8, -0.4]);
  expect(SPINNER_STYLES.map(style => style.code).slice(0, 3)).toEqual(['orbit', 'rocket', 'glider']);
});

