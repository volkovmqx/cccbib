import React from 'react';
import { IconEye, IconPlayerPlay, IconTimeDuration0 } from '@tabler/icons-react';
import { Card, Text, Group, Center, rem, useMantineTheme } from '@mantine/core';
import classes from './ItemCard.module.css';
import { Link } from 'react-router-dom';

const formatSeconds = s => [parseInt(s / 60 / 60), parseInt(s / 60 % 60), parseInt(s % 60)].join(':').replace(/\b(\d)\b/g, '0$1');

export function ItemCard({title, image, persons, duration, viewCount, active, guid}) {
  const theme = useMantineTheme();
  return (
    <Card
      p="lg"
      shadow="lg"
      className={`${classes.image} ${classes.card} ${active ? classes.active : ''}`}
      component={Link}
      to={`/event/${guid}`}
      style={{
          backgroundImage:'url("'+image+'")',
        }}
    >
     
      <div className={classes.overlay} />
      {active && (
        <div className={classes.activeplay}>
          <IconPlayerPlay size="56" />
        </div>
      )}
      <div className={classes.content}>
        <div>
          <Text size="lg" className={classes.title} fw={500}>
            {title}
          </Text>

          <Group justify="space-between" gap="xs">
            <Text size="sm" className={classes.author} truncate="end">
              {persons.map((p) => p + " ")}
            </Text>

            <Group gap="lg">
              <Center>
                <IconEye
                  style={{ width: rem(16), height: rem(16) }}
                  stroke={1.5}
                  color={theme.colors.dark[2]}
                />
                <Text size="sm" className={classes.bodyText} >
                  {viewCount}
                </Text>
              </Center>
              <Center>
                <IconTimeDuration0
                  style={{ width: rem(16), height: rem(16) }}
                  stroke={1.5}
                  color={theme.colors.dark[2]}
                />
                <Text size="sm" className={classes.bodyText}>
                  {formatSeconds(duration)}
                </Text>
              </Center>
            </Group>
          </Group>
        </div>
      </div>
    </Card>
  );
}