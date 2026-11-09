import { callLuna } from './luna';
import { isWebOS } from '../platform';

const SET_PLAY_RATE = 'luna://com.webos.media/setPlayRate';

// WebAppMgr mutes the sound at any other playbackRate, the TV's media service speeds up picture and sound together
export async function applyPlayRate(video: HTMLVideoElement, rate: number) {
  if (!isWebOS()) {
    video.defaultPlaybackRate = rate;
    video.playbackRate = rate;
    return 'ok';
  }
  if (!video.mediaId) return 'pending';
  const reply = await callLuna(SET_PLAY_RATE, { mediaId: video.mediaId, playRate: rate, audioOutput: true });
  return reply.returnValue ? 'ok' : 'failed';
}
