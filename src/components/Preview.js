import React from 'react';
import { getVideo } from '../helpers/helpers';
import { Box, Title, Group, Center, Text, Space } from '@mantine/core';
import { IconEye, IconClock, IconUser } from '@tabler/icons-react';
import { formatSeconds } from '../helpers/helpers';

import { Logo } from './Logo'
export function Preview({ event, conferenceTitle }) {
    const [recording] = getVideo(event.videos)

    return (

        <Box className='previewContainer'>
            <div className="title">
                <Logo />
                <Title size={"64px"} mt={40} lineClamp="2">{event.title}</Title>
                <Group gap="lg" mt={10}>
                    <Center>
                        <IconEye
                            style={{ width: '24px', height: '24px' }}
                            stroke={1}
                        />
                        <Text size={"24px"} ml={10}  >
                            {event.viewCount}
                        </Text>
                    </Center>
                    <Center>
                        <IconClock
                            style={{ width: '24px', height: '24px' }}
                            stroke={1}
                        />
                        <Text size={"24px"} ml={10}>
                            {formatSeconds(event.duration)}
                        </Text>
                    </Center>
                    <Center>
                        <IconUser
                            style={{ width: '24px', height: '24px' }}
                            stroke={1}
                        />
                        <Text size={"24px"} ml={10}>
                            {event.persons.join(', ')}
                        </Text>
                    </Center>
                </Group>
                <Title size={"32px"} lineClamp={3} mt={100}>{event.description}</Title>
                <Space h={100} />
            </div>
            <div className="preview">
                <div className="previewOverlay" />
                {recording && recording.url && (
                    <video src={recording.url + "#t=" + (Math.random() * event.duration) / 2} preload="auto" autoPlay className="player" />
                )}
                {!recording && (
                    <Text size="xl" weight={700} className="noRecording">
                        No recording available
                    </Text>
                )}

            </div>
        </Box>
    )
}