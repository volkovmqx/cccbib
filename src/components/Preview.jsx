import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { getPreviewVideo, formatSeconds, releaseVideo, isOddAspect } from '../helpers/helpers';
import { videoSources } from '../helpers/mirrors';
import { IconEye, IconClock, IconUser, IconWorld, IconBadgeCc, IconAspectRatio } from '@tabler/icons-react';
import { useSetting } from '../settings';
import { useIdle } from '../hooks/utils';
import { useTranslation } from '../i18n';

const PREVIEW_DEBOUNCE_MS = 300;
const POSTER_DEBOUNCE_MS = 250;
const PREVIEW_IDLE_MS = 120000;

export const Preview = React.memo(function Preview({ event, conferenceTitle, disableVideo = false }) {
    const t = useTranslation();
    const [language] = useSetting('language');
    const [previewVideo] = useSetting('previewVideo');
    const idle = useIdle(PREVIEW_IDLE_MS);

    // Debounce video loading - wait before loading video on rapid navigation
    const [showVideo, setShowVideo] = useState(false);
    useEffect(() => {
        setShowVideo(false);
        if (disableVideo) return undefined;
        const timer = setTimeout(() => setShowVideo(true), PREVIEW_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [event.guid, disableVideo]);

    const silencePreview = (event) => {
        const tracks = event.target.audioTracks;
        if (previewVideo !== 'mute' || !tracks) return;
        for (let i = 0; i < tracks.length; i += 1) tracks[i].enabled = false;
    };

    const previewVideoRef = useRef(null);
    const trackPreviewVideo = useCallback((element) => {
        if (!element) releaseVideo(previewVideoRef.current);
        previewVideoRef.current = element;
    }, []);

    const [posterLoadedFor, setPosterLoadedFor] = useState(null);
    const [loadPoster, setLoadPoster] = useState(false);
    useEffect(() => {
        setLoadPoster(false);
        const timer = setTimeout(() => setLoadPoster(true), POSTER_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [event.guid]);
    const thumbUrl = event.images && event.images.thumbUrl;
    const posterUrl = event.images && event.images.posterUrl;

    // Memoize getVideo call to avoid re-computation on every render
    const recording = useMemo(() =>
        getPreviewVideo(event.videos, language),
        [event.videos, language]
    );

    const previewSources = useMemo(() => (recording && recording.url ? videoSources(recording.url) : []), [recording && recording.url]);
    const [previewSourceIndex, setPreviewSourceIndex] = useState(0);
    useEffect(() => setPreviewSourceIndex(0), [recording && recording.url]);

    // Memoize preview timestamp - only changes when event changes
    const previewTimestamp = useMemo(() =>
        Math.floor(Math.random() * event.duration / 2),
        [event.guid, event.duration]
    );

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
                {previewVideo !== 'none' && (
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
                {showVideo && !idle && recording && recording.url && !disableVideo && (previewVideo === 'on' || previewVideo === 'mute') && (
                    <video
                        ref={trackPreviewVideo}
                        src={`${previewSources[Math.min(previewSourceIndex, previewSources.length - 1)]}#t=${previewTimestamp}`}
                        onError={() => setPreviewSourceIndex((index) => index + 1)}
                        preload="none"
                        autoPlay
                        muted={previewVideo === 'mute'}
                        onLoadedMetadata={silencePreview}
                        onPlaying={silencePreview}
                        className="player"
                    />
                )}
                {previewVideo !== 'none' && !recording && (
                    <div className="noRecording">
                        {t('No recording available')}
                    </div>
                )}
            </div>
        </div>
    );
});