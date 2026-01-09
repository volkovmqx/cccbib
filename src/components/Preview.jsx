import React, { useMemo, useState, useEffect } from 'react';
import { getVideo, formatSeconds } from '../helpers/helpers';
import { Box, Title, Group, Center, Text } from '@mantine/core';
import { IconEye, IconClock, IconUser, IconWorld, IconBadgeCc } from '@tabler/icons-react';
import { useLocalStorage } from '@mantine/hooks';
import { Logo } from './Logo';

const PREVIEW_DEBOUNCE_MS = 300;

export const Preview = React.memo(function Preview({ event, conferenceTitle, disableVideo = false }) {
    const [language] = useLocalStorage({
        key: 'language',
        defaultValue: 'deu',
    });

    // Debounce video loading - wait before loading video on rapid navigation
    const [showVideo, setShowVideo] = useState(false);
    useEffect(() => {
        setShowVideo(false);
        const timer = setTimeout(() => setShowVideo(true), PREVIEW_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [event.guid]);

    // Memoize getVideo call to avoid re-computation on every render
    const [recording] = useMemo(() =>
        getVideo(event.videos, language),
        [event.videos, language]
    );

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

    return (
        <Box className='previewContainer'>
            <div className="title">
                <Logo />
                <Title className="preview-title" mt={40} lineClamp="2">{event.title}</Title>
                <Group gap="lg" mt={10}>
                    <Center>
                        <IconEye className="preview-icon" stroke={1} />
                        <Text size="24px" ml={10}>{event.viewCount}</Text>
                    </Center>
                    <Center>
                        <IconClock className="preview-icon" stroke={1} />
                        <Text size="24px" ml={10}>{formatSeconds(event.duration)}</Text>
                    </Center>
                    {hasMultipleLanguages && (
                        <Center>
                            <IconWorld className="preview-icon" stroke={1} />
                            <Text size="24px" ml={10}>{availableLanguages.length}</Text>
                        </Center>
                    )}
                    {hasSubtitles && (
                        <Center>
                            <IconBadgeCc className="preview-icon" stroke={1} />
                        </Center>
                    )}
                    <Center>
                        <IconUser className="preview-icon" stroke={1} />
                        <Text size="24px" ml={10}>{event.persons.join(', ')}</Text>
                    </Center>
                </Group>
                <Title size="32px" lineClamp={3} mt={5}>{event.description}</Title>
            </div>
            <div className="preview">
                <div className="previewOverlay" />
                {showVideo && recording && recording.url && !disableVideo && (
                    <video
                        src={`${recording.url}#t=${previewTimestamp}`}
                        preload="none"
                        autoPlay
                        className="player"
                    />
                )}
                {!recording && (
                    <Text size="xl" fw={700} className="noRecording">
                        No recording available
                    </Text>
                )}
            </div>
        </Box>
    );
});