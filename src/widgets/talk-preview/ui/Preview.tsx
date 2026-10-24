import type { Talk } from '@/entities/talk';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { getPreviewVideo, formatSeconds, releaseVideo, isOddAspect, previewFit, rememberMirror, videoSources } from '@/entities/talk';
import { IconEye, IconClock, IconUser, IconWorld, IconBadgeCc, IconAspectRatio } from '@tabler/icons-react';
import { useSetting } from '@/shared/config';
import { useIdle } from '@/shared/lib';
import { useTranslation } from '@/shared/i18n';

const PREVIEW_DEBOUNCE_MS = 250;
const PREVIEW_QUIET_MS = 700;
const PREVIEW_QUIET_DELAY_MS = 40;
const POSTER_DEBOUNCE_MS = 250;
const PREVIEW_IDLE_MS = 120000;
const PREVIEW_MOVED_S = 0.1;

export const Preview = React.memo(function Preview({ event, disableVideo = false }: { event: Talk; disableVideo?: boolean }) {
    const t = useTranslation();
    const [language] = useSetting('language');
    const [previewVideo] = useSetting('previewVideo');
    const idle = useIdle(PREVIEW_IDLE_MS);

    // A talk that somebody stopped on starts at once, while the selection keeps changing a video waits a moment
    const [readyFor, setReadyFor] = useState<string | null>(null);
    const lastChangeRef = useRef(0);
    useEffect(() => {
        setReadyFor(null);
        if (disableVideo) return undefined;
        const now = Date.now();
        const delay = now - lastChangeRef.current > PREVIEW_QUIET_MS ? PREVIEW_QUIET_DELAY_MS : PREVIEW_DEBOUNCE_MS;
        lastChangeRef.current = now;
        const timer = setTimeout(() => setReadyFor(event.guid), delay);
        return () => clearTimeout(timer);
    }, [event.guid, disableVideo]);

    // The sound waits for the picture, on the TV the cover can stay a few seconds
    const silencePreview = (video: React.SyntheticEvent<HTMLVideoElement>) => {
        const tracks = video.currentTarget.audioTracks;
        if (!tracks || (previewVideo !== 'mute' && videoPlaying)) return;
        for (let i = 0; i < tracks.length; i += 1) tracks[i].enabled = false;
    };

    const previewVideoRef = useRef<HTMLVideoElement | null>(null);
    const trackPreviewVideo = useCallback((element: HTMLVideoElement | null) => {
        if (!element) releaseVideo(previewVideoRef.current);
        previewVideoRef.current = element;
    }, []);

    const [posterLoadedFor, setPosterLoadedFor] = useState<string | null>(null);
    const [loadPoster, setLoadPoster] = useState(false);
    useEffect(() => {
        setLoadPoster(false);
        const timer = setTimeout(() => setLoadPoster(true), POSTER_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [event.guid]);
    const thumbUrl = event.images && event.images.thumbUrl;
    const posterUrl = event.images && event.images.posterUrl;

    const recording = useMemo(() => getPreviewVideo(event.videos, language), [event.videos, language]);

    const [measuredRatio, setMeasuredRatio] = useState<number | null>(null);
    useEffect(() => setMeasuredRatio(null), [event.guid, recording && recording.url]);
    const fit = previewFit(measuredRatio || (recording && recording.width && recording.height ? recording.width / recording.height : 16 / 9));

    const sources = useMemo(() => (recording && recording.url ? videoSources(recording.url) : []), [recording && recording.url]);
    const [sourceIndex, setSourceIndex] = useState(0);
    useEffect(() => setSourceIndex(0), [event.guid, recording && recording.url]);

    const videoMode = previewVideo === 'on' || previewVideo === 'mute';
    const [blockedFor, setBlockedFor] = useState<string | null>(null);
    const blocked = blockedFor === event.guid;
    const videoShown = Boolean(readyFor === event.guid && !idle && recording && recording.url && !disableVideo && videoMode && sourceIndex < sources.length && !blocked);

    // A browser refuses a video with sound until the page has had a key press or a click
    useEffect(() => {
        const video = previewVideoRef.current;
        if (!videoShown || !video) return;
        const attempt = video.play();
        if (attempt && attempt.catch) attempt.catch((error) => { if (error && error.name === 'NotAllowedError') setBlockedFor(event.guid); });
    }, [videoShown, event.guid]);

    // The TV draws a video black until its first picture and can hold it, so an opaque cover stays over the video until it has moved. Hiding it with visibility left the TV without a picture in half of the cases
    const [videoPlaying, setVideoPlaying] = useState(false);
    const playStartRef = useRef<number | null>(null);
    useEffect(() => {
        playStartRef.current = null;
        setVideoPlaying(false);
    }, [videoShown, recording && recording.url, sourceIndex]);
    useEffect(() => {
        const tracks = previewVideoRef.current && previewVideoRef.current.audioTracks;
        if (!videoPlaying || previewVideo !== 'on' || !tracks) return;
        for (let i = 0; i < tracks.length; i += 1) tracks[i].enabled = true;
    }, [videoPlaying, previewVideo]);
    const showWhenMoving = (video: HTMLVideoElement) => {
        const start = playStartRef.current;
        if (start === null) return;
        // The clock of the TV can jump back by seconds after the first picture, so it counts from the lowest position it has shown
        if (video.currentTime < start) playStartRef.current = video.currentTime;
        else if (video.currentTime - start >= PREVIEW_MOVED_S) setVideoPlaying(true);
    };

    // In the video modes the picture only stands in where no video can play, never as a first frame before it
    const showPicture = previewVideo !== 'none' && (!videoMode || (!disableVideo && (!recording || sourceIndex >= sources.length || idle || blocked)));

    const previewTimestamp = useMemo(() => Math.floor(Math.random() * event.duration / 2), [event.guid, event.duration]);

    // Check if multiple audio languages are available
    const availableLanguages = useMemo(() => [...new Set(
        event.videos
            .filter(v => v.mimeType === "video/webm" && v.url && v.language)
            .flatMap(v => v.language.split('-'))
    )], [event.videos]);
    const hasMultipleLanguages = availableLanguages.length > 1;

    // Check if subtitles are available
    const hasSubtitles = event.subtitles && event.subtitles.length > 0;

    const oddAspect = useMemo(() => isOddAspect(event.videos, language), [event.videos, language]);

    return (
        <div className='previewContainer'>
            <div className="title">
                <h1 className="preview-title">{event.title}</h1>
                <div className="previewMeta">
                    <div className="previewMeta__item">
                        <IconEye className="preview-icon" stroke={1.5} />
                        <span className="previewMeta__text">{event.viewCount}</span>
                    </div>
                    <div className="previewMeta__item">
                        <IconClock className="preview-icon" stroke={1.5} />
                        <span className="previewMeta__text">{formatSeconds(event.duration)}</span>
                    </div>
                    {hasMultipleLanguages && (
                        <div className="previewMeta__item">
                            <IconWorld className="preview-icon" stroke={1.5} />
                            <span className="previewMeta__text">{availableLanguages.length}</span>
                        </div>
                    )}
                    {hasSubtitles && (
                        <div className="previewMeta__item">
                            <IconBadgeCc className="preview-icon" stroke={1.5} />
                        </div>
                    )}
                    {oddAspect && (
                        <div className="previewMeta__item">
                            <IconAspectRatio className="preview-icon" stroke={1.5} />
                        </div>
                    )}
                    <div className="previewMeta__item">
                        <IconUser className="preview-icon" stroke={1.5} />
                        <span className="previewMeta__text">{event.persons.join(', ')}</span>
                    </div>
                </div>
                <h2 className="previewDescription">{event.description}</h2>
            </div>
            <div className="preview">
                <div className="previewOverlay" />
                {showPicture && (
                    <div className="previewBackdrop" aria-hidden="true">
                        {thumbUrl && <img key={`thumb-${event.guid}`} className="previewBackdrop__img" src={thumbUrl} alt="" />}
                        {posterUrl && loadPoster && (
                            <img
                                key={`poster-${event.guid}`}
                                className="previewBackdrop__img"
                                style={{ opacity: posterLoadedFor === event.guid ? 1 : 0 }}
                                src={posterUrl}
                                onLoad={() => setPosterLoadedFor(event.guid)}
                                alt=""
                            />
                        )}
                    </div>
                )}
                {videoShown && recording && (
                    <video
                        ref={trackPreviewVideo}
                        src={`${sources[Math.min(sourceIndex, sources.length - 1)]}#t=${previewTimestamp}`}
                        onError={() => setSourceIndex((index) => index + 1)}
                        preload="none"
                        autoPlay
                        muted={previewVideo === 'mute'}
                        style={fit}
                        onLoadedMetadata={(loaded) => {
                            silencePreview(loaded);
                            const { videoWidth, videoHeight } = loaded.currentTarget;
                            if (videoWidth && videoHeight) setMeasuredRatio(videoWidth / videoHeight);
                        }}
                        onPlaying={(playing) => {
                            silencePreview(playing);
                            rememberMirror(playing.currentTarget.currentSrc);
                            playStartRef.current = playing.currentTarget.currentTime;
                        }}
                        onTimeUpdate={(update) => showWhenMoving(update.currentTarget)}
                        className="player"
                    />
                )}
                {videoShown && !videoPlaying && <div className="previewCover" />}
                {previewVideo !== 'none' && !recording && (
                    <div className="noRecording">
                        {t('No recording available')}
                    </div>
                )}
            </div>
        </div>
    );
});
