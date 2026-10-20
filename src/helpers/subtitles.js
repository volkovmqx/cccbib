// cdn.media.ccc.de redirects without CORS headers. Load from the hosts the website uses insted.
const CDN_PREFIX = 'https://cdn.media.ccc.de/';
const SRT_BASE = 'https://media.ccc.de/srt/';
const VTT_BASE = 'https://static.media.ccc.de/media/';

export function resolveSubtitleUrl(url) {
  if (!url || !url.startsWith(CDN_PREFIX)) return url;
  const path = url.slice(CDN_PREFIX.length);
  if (/\.srt$/i.test(path)) return SRT_BASE + path;
  if (/\.vtt$/i.test(path)) return VTT_BASE + path;
  return url;
}

const isVtt = (subtitle) => /vtt/i.test(subtitle.mimeType || '') || /\.vtt$/i.test(subtitle.url || '');

export function getSubtitleSources(subtitles, language) {
  const candidates = (subtitles || [])
    .filter((s) => s && s.url && s.language === language)
    .sort((a, b) => Number(isVtt(b)) - Number(isVtt(a)));
  return [...new Set(candidates.map((s) => resolveSubtitleUrl(s.url)))];
}

export function getSubtitleLanguages(subtitles) {
  return [...new Set((subtitles || []).filter((s) => s && s.url && s.language).map((s) => s.language))];
}

const TIME = '(?:(\\d+):)?(\\d{1,2}):(\\d{2})[.,](\\d{1,3})';
const TIMING_RE = new RegExp(`^\\s*${TIME}\\s*-->\\s*${TIME}`);
const INDEX_LINE_RE = /^\d+$/;

const toSeconds = (h, m, s, ms) =>
  (Number(h) || 0) * 3600 + Number(m) * 60 + Number(s) + Number(String(ms).padEnd(3, '0')) / 1000;

const cleanCueText = (lines) =>
  lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/<(?!\/?(?:i|b|u)>)[^>]*>/g, '')
    .replace(/&(?!(?:amp|lt|gt|nbsp|lrm|rlm);)/g, '&amp;')
    .replace(/<(?!\/?(?:i|b|u)>)/g, '&lt;')
    .trim();

export function parseSubtitles(raw) {
  const lines = String(raw).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const cues = [];
  let current = null;

  const close = () => {
    if (!current) return;
    const text = cleanCueText(current.lines);
    if (text && current.end > current.start) {
      cues.push({ start: current.start, end: current.end, text });
    }
    current = null;
  };

  for (const line of lines) {
    const timing = TIMING_RE.exec(line);
    if (timing) {
      if (current && current.lines.length && INDEX_LINE_RE.test(current.lines[current.lines.length - 1].trim())) {
        current.lines.pop();
      }
      close();
      current = {
        start: toSeconds(timing[1], timing[2], timing[3], timing[4]),
        end: toSeconds(timing[5], timing[6], timing[7], timing[8]),
        lines: [],
      };
    } else if (!line.trim()) {
      close();
    } else if (current) {
      current.lines.push(line);
    }
  }
  close();

  cues.sort((a, b) => a.start - b.start);

  for (let i = 0; i < cues.length - 1; i++) {
    const next = cues[i + 1];
    if (cues[i].end > next.start && next.start > cues[i].start) {
      cues[i].end = Math.max(next.start - 0.1, cues[i].start + 0.1);
    }
  }

  return cues;
}

const MAX_CACHED = 12;
const cueCache = new Map();

const inflight = new Map();

async function fetchCues(url, signal) {
  const cached = cueCache.get(url);
  if (cached) {
    cueCache.delete(url);
    cueCache.set(url, cached);
    return cached;
  }

  let request = inflight.get(url);
  if (!request) {
    request = (async () => {
      const response = await fetch(url, { credentials: 'omit' });
      if (!response.ok) throw new Error(`Subtitle request failed: ${response.status}`);

      const cues = parseSubtitles(await response.text());
      if (cues.length === 0) throw new Error('Subtitle file contains no cues');

      cueCache.set(url, cues);
      if (cueCache.size > MAX_CACHED) cueCache.delete(cueCache.keys().next().value);
      return cues;
    })();
    inflight.set(url, request);
    const done = () => inflight.delete(url);
    request.then(done, done);
  }

  const cues = await request;
  if (signal && signal.aborted) throw new Error('Subtitle request aborted');
  return cues;
}

export async function loadSubtitleCues(sources, signal) {
  let lastError = new Error('No subtitle source available');
  for (const url of sources) {
    try {
      return await fetchCues(url, signal);
    } catch (error) {
      if (signal && signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
