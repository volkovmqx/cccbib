import type { Recording } from '@/entities/talk';
import { formatSeconds, mirrorInfo } from '@/entities/talk';

export interface StatRow { label: string; value: string }
export interface StatsContext {
  guid: string;
  recording: Recording | null;
  duration: number;
  sourceUrl: string;
  sourceIndex: number;
  sourceCount: number;
  aspect: string;
  speed: number;
  audioLanguage: string;
  subtitleLanguage: string;
  subtitleStatus: string;
  buffering: boolean;
  version: string;
}
export interface StatsRate { at: number; time: number; start: number; end: number; fill: number }

type MeasuredVideo = HTMLVideoElement & { webkitDecodedFrameCount?: number; webkitDroppedFrameCount?: number };
type Connection = { downlink?: number; effectiveType?: string; rtt?: number };

const READY = ['nothing', 'metadata', 'current data', 'future data', 'enough data'];
const NETWORK = ['empty', 'idle', 'loading', 'no source'];

export function bufferedRange(video: HTMLVideoElement) {
  const ranges = video.buffered;
  for (let index = 0; index < ranges.length; index++) {
    if (ranges.start(index) <= video.currentTime + 0.1 && ranges.end(index) >= video.currentTime) return { start: ranges.start(index), end: ranges.end(index) };
  }
  return { start: video.currentTime, end: video.currentTime };
}

// An estimate, the file size is listed in MB
function bitrateMbit(recording: Recording | null, duration: number) {
  const size = recording && recording.size;
  return typeof size === 'number' && size > 0 && duration > 0 ? (size * 8) / duration : null;
}

// How many seconds of video arrived per second, the bytes themselves are not visible to the page
// A seek or another buffered range is no download, so such a sample only starts over
export function nextRate(previous: StatsRate | null, now: number, video: HTMLVideoElement, speed = 1): StatsRate {
  const { start, end } = bufferedRange(video);
  const time = video.currentTime;
  const base = { at: now, time, start, end, fill: 0 };
  if (!previous || now <= previous.at) return base;
  const elapsed = (now - previous.at) / 1000;
  const moved = time - previous.time;
  if (start !== previous.start || moved < -0.5 || moved > elapsed * Math.max(1, video.playbackRate, speed) + 1.5) return base;
  const fill = Math.max(0, (end - previous.end) / elapsed);
  return { ...base, fill: fill < 0.01 ? 0 : fill };
}

export function fileFormat(url: string, mimeType?: string) {
  const folder = (url.match(/\/((?:h264|h265|vp8|vp9|av1|webm|mp4|opus|mp3|ogg)[\w-]*)\//i) || [])[1];
  const extension = (url.split('?')[0].match(/\.(\w{2,5})$/) || [])[1];
  return [folder || extension, mimeType].filter(Boolean).join(' / ');
}

const fixed = (value: number, digits = 1) => (Math.round(value * 10 ** digits) / 10 ** digits).toFixed(digits);

function frames(video: MeasuredVideo) {
  const quality = typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality() : null;
  const total = quality ? quality.totalVideoFrames : video.webkitDecodedFrameCount || 0;
  const dropped = quality ? quality.droppedVideoFrames : video.webkitDroppedFrameCount || 0;
  return total > 0 ? `${dropped} dropped of ${total}` : 'not reported by this TV';
}

function subtitleState(video: HTMLVideoElement, context: StatsContext) {
  const language = context.subtitleLanguage;
  if (language === 'none') return 'off';
  const shown = Array.from(video.textTracks || []).find((track) => track.mode === 'showing');
  if (shown) return `${language}, ${shown.cues ? shown.cues.length : 0} cues`;
  return `${language} (${context.subtitleStatus === 'error' ? 'not available' : context.subtitleStatus === 'loading' ? 'loading' : 'not showing'})`;
}

export function collectStats(video: HTMLVideoElement, context: StatsContext, rate: StatsRate | null): StatRow[] {
  const { recording } = context;
  const source = video.currentSrc || context.sourceUrl;
  const mirror = mirrorInfo(source);
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  const bitrate = bitrateMbit(recording, context.duration);
  const ahead = Math.max(0, bufferedRange(video).end - video.currentTime);
  const listed = recording && recording.width && recording.height ? `${recording.width}x${recording.height}` : '';
  const resolution = video.videoWidth ? `${video.videoWidth}x${video.videoHeight}` : 'waiting for the video';
  const state = video.ended ? 'ended' : context.buffering ? 'buffering' : video.paused ? 'paused' : 'playing';
  const chrome = (navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)/) || [])[1];
  const fill = rate && rate.fill > 0 ? `${fixed(rate.fill)}x realtime` : 'buffer full or idle';
  return [
    { label: 'Video', value: context.guid },
    { label: 'Mirror', value: mirror ? `${mirror.host}${mirror.share !== null ? ` (${mirror.share}% share)` : mirror.cdn ? ' (direct)' : ''}` : 'unknown' },
    { label: 'Source', value: `${context.sourceIndex + 1} of ${context.sourceCount}` },
    { label: 'File', value: [fileFormat(source, recording ? recording.mimeType : undefined), recording && recording.size ? `${recording.size} MB` : ''].filter(Boolean).join(', ') || 'unknown' },
    { label: 'Bitrate', value: bitrate ? `about ${fixed(bitrate, 2)} Mbit/s` : 'unknown' },
    { label: 'Resolution', value: listed && listed !== resolution ? `${resolution} (listed ${listed})` : resolution },
    { label: 'Aspect', value: `${video.videoHeight ? fixed(video.videoWidth / video.videoHeight, 2) : '-'} (${context.aspect})` },
    { label: 'Viewport', value: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x` },
    { label: 'Frames', value: frames(video) },
    { label: 'Buffer', value: `${fixed(ahead)} s ahead, ${video.buffered.length} range${video.buffered.length === 1 ? '' : 's'}` },
    { label: 'Buffer fill', value: fill },
    { label: 'Connection', value: connection && connection.downlink ? [`about ${connection.downlink} Mbit/s`, connection.effectiveType, connection.rtt ? `${connection.rtt} ms` : ''].filter(Boolean).join(', ') : 'not reported by this TV' },
    { label: 'Position', value: `${formatSeconds(video.currentTime)} / ${formatSeconds(Number.isFinite(video.duration) ? video.duration : context.duration)}` },
    { label: 'State', value: `${state}, ${fixed(context.speed, 2).replace(/\.?0+$/, '')}x, ${READY[video.readyState] || video.readyState}, network ${NETWORK[video.networkState] || video.networkState}` },
    { label: 'Audio', value: `${context.audioLanguage || 'unknown'}, player volume ${Math.round(video.volume * 100)}%${video.muted ? ' (muted)' : ''}` },
    { label: 'Subtitles', value: subtitleState(video, context) },
    { label: 'Engine', value: `${chrome ? `Chrome ${chrome}` : 'unknown browser'}, app ${context.version}` },
  ];
}
