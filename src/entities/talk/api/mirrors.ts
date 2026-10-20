// cdn.media.ccc.de redirects every request to a random mirror, and each seek makes webOS ask agian.
// berlin-ak.media.ccc.de is left out on purpose: it refuses connections, so a share of requests failed.
const CDN_PREFIX = 'https://cdn.media.ccc.de/';
const MAX_MIRRORS = 3;

const MIRRORS = [
  { base: 'https://ffmuc.media.ccc.de/', weight: 47 },
  { base: 'https://ftp.agdsn.de/ccc/', weight: 17 },
  { base: 'https://mirror.netcologne.de/CCC/', weight: 17 },
  { base: 'https://duesseldorf.media.ccc.de/', weight: 7 },
  { base: 'https://eu.mirror.ionos.com/projects/media.ccc.de/', weight: 5 },
];

let preferredBase: string | null = null;

export function rememberMirror(url: string) {
  const mirror = url && MIRRORS.find((item) => url.startsWith(item.base));
  if (mirror) preferredBase = mirror.base;
}

// Ordered list to try: the mirror that worked last, then weighted random ones, finally the original address
export function videoSources(url: string) {
  if (!url || !url.startsWith(CDN_PREFIX)) return [url];
  const path = url.slice(CDN_PREFIX.length);
  const pool = MIRRORS.slice();
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
