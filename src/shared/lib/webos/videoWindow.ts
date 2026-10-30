import { callLuna } from './luna';

const SET_WINDOW = 'luna://com.webos.service.videooutput/display/setDisplayWindow';
const NOT_REGISTERED = 53;
const FIRST_CHROME_WITH_OBJECT_FIT = 79;

// The video plane of old webOS ignores object-fit, so the TV's video output service has to crop and stretch
export function usesOutputWindow() {
  const match = /Chrome\/(\d+)/.exec(navigator.userAgent);
  return typeof window.PalmServiceBridge !== 'undefined' && match !== null && Number(match[1]) < FIRST_CHROME_WITH_OBJECT_FIT;
}

export function computeOutputWindow(mode: string, vw: number, vh: number, sw: number, sh: number) {
  const full = { x: 0, y: 0, width: vw, height: vh };
  const screen = { x: 0, y: 0, width: sw, height: sh };

  if (mode === 'stretch') {
    const declared = { x: 0, y: 0, width: vw, height: Math.round((vw * sh) / sw) };
    return { original: declared, source: declared, output: screen };
  }

  if (mode === 'zoom') {
    if (vw / vh < sw / sh) {
      const height = Math.round((vw * sh) / sw);
      return { original: full, source: { x: 0, y: Math.round((vh - height) / 2), width: vw, height }, output: screen };
    }
    const width = Math.round((vh * sw) / sh);
    return { original: full, source: { x: Math.round((vw - width) / 2), y: 0, width, height: vh }, output: screen };
  }

  const scale = Math.min(sw / vw, sh / vh);
  const width = Math.round(vw * scale);
  const height = Math.round(vh * scale);
  return {
    original: full,
    source: full,
    output: { x: Math.round((sw - width) / 2), y: Math.round((sh - height) / 2), width, height },
  };
}

export async function applyOutputWindow(video: HTMLVideoElement, mode: string) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return 'wait';
  if (!video.mediaId) return 'pending';

  const sw = window.screen.width || window.innerWidth || 1920;
  const sh = window.screen.height || window.innerHeight || 1080;
  const rects = computeOutputWindow(mode, vw, vh, sw, sh);
  const reply = await callLuna(SET_WINDOW, {
    context: video.mediaId,
    sourcePort: 3,
    originalInput: rects.original,
    sourceInput: rects.source,
    displayOutput: rects.output,
    fullScreen: false,
  });
  if (reply && reply.returnValue) return 'ok';
  return reply && reply.errorCode === NOT_REGISTERED ? 'pending' : 'failed';
}
