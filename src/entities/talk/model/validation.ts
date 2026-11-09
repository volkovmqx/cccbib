import type { Talk } from './types';

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const optionalString = (value: unknown) => value === undefined || typeof value === 'string';
const optionalNumber = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isFinite(value));
const isSource = (value: unknown) => isObject(value)
  && ['url', 'mimeType', 'language'].every(key => typeof value[key] === 'string')
  && optionalNumber(value.width) && optionalNumber(value.height) && optionalNumber(value.size ?? undefined);

export function isTalk(value: unknown): value is Talk {
  return isObject(value)
    && typeof value.guid === 'string' && value.guid.length > 0
    && typeof value.title === 'string'
    && typeof value.duration === 'number' && Number.isFinite(value.duration)
    && Array.isArray(value.persons) && value.persons.every((person: unknown) => typeof person === 'string')
    && isObject(value.images) && optionalString(value.images.thumbUrl) && optionalString(value.images.posterUrl)
    && Array.isArray(value.videos) && value.videos.every(isSource)
    && (value.subtitles === undefined || (Array.isArray(value.subtitles) && value.subtitles.every(isSource)))
    && optionalString(value.slug) && (value.description === null || optionalString(value.description)) && optionalString(value.conference_title)
    && optionalNumber(value.viewCount)
    && (value.detailsChecked === undefined || typeof value.detailsChecked === 'boolean');
}
