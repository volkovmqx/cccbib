import type { Recording } from '../model/types';

// Returns [recording, recordingLanguage] for best matching video
export function getVideo(videos: Recording[], preferredLanguage = 'deu'): [Recording | null, string | null | undefined] {
      if (preferredLanguage === 'auto') {
        const widest = (mimeType: string) => videos
          .filter(s => s.mimeType === mimeType && s.url)
          .reduce<Recording | null>((best, s) => (!best || (s.width || 0) > (best.width || 0) ? s : best), null);
        const recording = widest("video/webm") || widest("video/mp4");
        if (recording) {
          return [recording, recording.language];
        }
        return [null, null];
      }

      let bestMatch: Recording | null = null;
      let bestPriority = 0;
      const isBetter = (priority: number, video: Recording) => priority > bestPriority
        || (priority === bestPriority && bestMatch && (video.width || 0) > (bestMatch.width || 0));

      for (const video of videos) {
        if (!video.url) continue;

        const isWebm = video.mimeType === "video/webm";
        const isMp4 = video.mimeType === "video/mp4";

        if (!isWebm && !isMp4) continue;

        if (video.language) {
          const languages = video.language.split('-');
          const isExactMatch = languages.length === 1 && languages[0] === preferredLanguage;
          const includesLanguage = languages.includes(preferredLanguage);

          // Priority: 6=single WEBM, 5=single MP4, 4=multi WEBM, 3=multi MP4, 2=any WEBM, 1=any MP4
          let priority = 0;
          if (isExactMatch && isWebm) {
            priority = 6;
          } else if (isExactMatch && isMp4) {
            priority = 5;
          } else if (includesLanguage && isWebm) {
            priority = 4;
          } else if (includesLanguage && isMp4) {
            priority = 3;
          } else if (isWebm) {
            priority = 2;
          } else {
            priority = 1;
          }

          if (isBetter(priority, video)) {
            bestMatch = video;
            bestPriority = priority;
          }
        } else {
          const priority = isWebm ? 2 : 1;
          if (isBetter(priority, video)) {
            bestMatch = video;
            bestPriority = priority;
          }
        }
      }

      return [bestMatch, bestMatch?.language];
}
export function isOddAspect(videos: Recording[], preferredLanguage?: string) {
  const [recording] = getVideo(videos || [], preferredLanguage);
  if (!recording || !recording.width || !recording.height) return false;
  return Math.abs(recording.width / recording.height - 16 / 9) > 0.08;
}

// webOS has a single hardware decoder, so a video has to be unloaded explicitly before the next one starts
export function releaseVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  try {
    video.muted = true;
    video.pause();
    video.removeAttribute('src');
    video.load();
  } catch (error) {
  }
}

export const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
};

export const formatSeconds = (s: number) => [Math.trunc(s / 60 / 60), Math.trunc(s / 60 % 60), Math.trunc(s % 60)].join(':').replace(/\b(\d)\b/g, '0$1');

