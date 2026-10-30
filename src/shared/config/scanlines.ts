const STEP_MS = 100;
const PASS_MS = 8000;
const PASS_FIRST_MS = 1500;
const PASS_EVERY_MS = 30000;
const BAND_PX = 120;

let mode = '';
let stopCurrent = () => {};

// A running animation keeps the TV redrawing, so the Pulse line moves in ten steps per second and only exists while it travels
function run(overlay: HTMLElement) {
  const root = document.documentElement;
  const band = overlay.querySelector<HTMLElement>('.scanBand');
  if (!band) return () => {};
  let last = performance.now();
  let pass = 0;
  let passing = false;
  let wait = PASS_FIRST_MS;

  const tick = () => {
    const now = performance.now();
    const elapsed = now - last;
    last = now;
    if (document.hidden || document.querySelector('.player-fullscreen-container')) return;
    if (passing) {
      pass += elapsed;
      band.style.transform = `translateY(${(Math.min(1, pass / PASS_MS) * (window.innerHeight + BAND_PX) - BAND_PX).toFixed(1)}px)`;
      if (pass >= PASS_MS) {
        passing = false;
        root.removeAttribute('data-scan-pulse');
        wait = PASS_EVERY_MS - PASS_MS;
      }
    } else {
      wait -= elapsed;
      if (wait <= 0) {
        passing = true;
        pass = 0;
        band.style.transform = `translateY(${-BAND_PX}px)`;
        root.setAttribute('data-scan-pulse', '');
      }
    }
  };

  const timer = setInterval(tick, STEP_MS);
  return () => {
    clearInterval(timer);
    root.removeAttribute('data-scan-pulse');
    band.style.removeProperty('transform');
  };
}

export function syncScanlines(next: string) {
  if (next === mode) return;
  mode = next;
  stopCurrent();
  stopCurrent = () => {};
  const overlay = document.getElementById('scanlines');
  const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!overlay || calm || next !== 'pulse') return;
  stopCurrent = run(overlay);
}
