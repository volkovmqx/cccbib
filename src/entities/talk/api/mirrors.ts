// cdn.media.ccc.de redirects every request to a mirror, so the ranking is read once and a playback stays on one mirror
const CDN_PREFIX = 'https://cdn.media.ccc.de/';
const SAMPLE_FILE = 'congress/2016/webm-hd/33c3-8429-eng-deu-fra-33C3_Opening_Ceremony_webm-hd.webm';
const MAX_MIRRORS = 3;
const RANKING_KEY = 'mirror_ranking';
const RANKING_TTL_MS = 12 * 60 * 60 * 1000;
const BLOCKED_HOSTS = ['berlin-ak.media.ccc.de'];

interface Mirror { base: string; weight: number }

const FALLBACK_MIRRORS: Mirror[] = [
  { base: 'https://ffmuc.media.ccc.de/', weight: 34 },
  { base: 'https://ftp.fau.de/cdn.media.ccc.de/', weight: 19 },
  { base: 'https://mirror.selfnet.de/CCC/', weight: 11 },
  { base: 'https://ftp.agdsn.de/ccc/', weight: 10 },
  { base: 'https://eu.mirror.ionos.com/projects/media.ccc.de/', weight: 9 },
  { base: 'https://duesseldorf.media.ccc.de/', weight: 8 },
];

let ranked: Mirror[] | null = null;
let preferredBase: string | null = null;

const isUsable = (mirror: Mirror) => {
  try {
    const { protocol, hostname } = new URL(mirror.base);
    return protocol === 'https:' && mirror.base.endsWith('/') && mirror.weight > 0 && !BLOCKED_HOSTS.includes(hostname);
  } catch { return false; }
};

function parseMirrorList(html: string): Mirror[] {
  const section = (html.split('<h3>Excluded Mirrors</h3>')[0].split('<h3>Mirrors</h3>')[1]) || '';
  const text = (cell: string) => cell.replace(/<[^>]*>/g, '').trim();
  return (section.match(/<tr>[\s\S]*?<\/tr>/g) || []).map((row) => {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => text(match[1]));
    const share = cells[6] || '';
    return { base: cells[2] || '', weight: /^&lt;/.test(share) ? 0.5 : parseFloat(share) || 0 };
  }).filter(isUsable);
}

function readSaved(): Mirror[] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(RANKING_KEY) || 'null');
    const fresh = saved && Date.now() - saved.at < RANKING_TTL_MS && Array.isArray(saved.mirrors);
    const mirrors: Mirror[] = fresh ? saved.mirrors.filter(isUsable) : [];
    return mirrors.length > 0 ? mirrors : null;
  } catch { return null; }
}

const currentMirrors = () => ranked || (ranked = readSaved()) || FALLBACK_MIRRORS;

export async function refreshMirrors() {
  if (readSaved()) return;
  try {
    const response = await fetch(`${CDN_PREFIX}${SAMPLE_FILE}?mirrorlist`);
    if (!response.ok) return;
    const mirrors = parseMirrorList(await response.text());
    if (mirrors.length === 0) return;
    ranked = mirrors;
    localStorage.setItem(RANKING_KEY, JSON.stringify({ at: Date.now(), mirrors }));
  } catch (error) {
    console.error('Could not load the mirror list', error);
  }
}

export function mirrorInfo(url: string) {
  if (!url) return null;
  try {
    const pool = currentMirrors();
    const mirror = pool.find((item) => url.startsWith(item.base));
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    return { host: new URL(url).host, share: mirror ? Math.round((mirror.weight / total) * 100) : null, cdn: url.startsWith(CDN_PREFIX) };
  } catch {
    return null;
  }
}

export function rememberMirror(url: string) {
  const mirror = url && currentMirrors().find((item) => url.startsWith(item.base));
  if (mirror) preferredBase = mirror.base;
}

// Ordered list to try: the mirror that worked last, then weighted random ones, finally the original address
export function videoSources(url: string) {
  if (!url || !url.startsWith(CDN_PREFIX)) return [url];
  const path = url.slice(CDN_PREFIX.length);
  const pool = currentMirrors().slice();
  const order = [];

  const preferred = preferredBase && pool.find((item) => item.base === preferredBase);
  if (preferred) order.push(pool.splice(pool.indexOf(preferred), 1)[0]);

  while (pool.length > 0 && order.length < MAX_MIRRORS) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    let index = 0;
    while (index < pool.length - 1 && roll >= pool[index].weight) {
      roll -= pool[index].weight;
      index += 1;
    }
    order.push(pool.splice(index, 1)[0]);
  }

  return order.map((item) => item.base + path).concat(url);
}
