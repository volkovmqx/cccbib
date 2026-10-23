import type { Talk } from '@/entities/talk';
import React, { useMemo, useState, useEffect } from 'react';
import { getVideo, formatSeconds, isOddAspect } from '@/entities/talk';
import { IconEye, IconClock, IconUser, IconWorld, IconBadgeCc, IconAspectRatio } from '@tabler/icons-react';
import { useSetting } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';

const POSTER_DEBOUNCE_MS = 250;

export const Preview = React.memo(function Preview({ event }: { event: Talk }) {
    const t = useTranslation();
    const [language] = useSetting('language');
    const [previewImage] = useSetting('previewImage');

    const [posterLoadedFor, setPosterLoadedFor] = useState<string | null>(null);
    const [loadPoster, setLoadPoster] = useState(false);
    useEffect(() => {
        setLoadPoster(false);
        const timer = setTimeout(() => setLoadPoster(true), POSTER_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [event.guid]);
    const thumbUrl = event.images && event.images.thumbUrl;
    const posterUrl = event.images && event.images.posterUrl;

    const hasRecording = useMemo(() => getVideo(event.videos, language)[0] !== null, [event.videos, language]);
    const showPicture = previewImage !== 'none';

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
                {showPicture && !hasRecording && (
                    <div className="noRecording">
                        {t('No recording available')}
                    </div>
                )}
            </div>
        </div>
    );
});
