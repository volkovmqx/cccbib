import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Center, Loader, Container, Title } from '@mantine/core';
import { useWindowEvent } from '@mantine/hooks';
import { useQuery } from '@apollo/client';
import { GET_CONFERENCE } from '../data';
import { Preview } from './Preview';
import { Player } from './Player';

import '../styles.css';

export const ConferenceView = React.memo(function ConferenceView({ conferenceId, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen, onClose }) {
  const [playerIsOpen, setPlayerIsOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(0);
  const selectedItemRef = useRef(null);
  const containerRef = useRef(null);

  const { loading, error, data } = useQuery(GET_CONFERENCE, {
    variables: { id: conferenceId },
    fetchPolicy: 'cache-first', // Use cache for better performance
  });

  const eventsPerRow = 4;

  // Keep scroll position
  const savedScrollPositionRef = useRef(0);
  const playerJustClosedRef = useRef(false);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      savedScrollPositionRef.current = containerRef.current.scrollTop;
    }
  }, []);

  useEffect(() => {
    if (playerIsOpen) {
      playerJustClosedRef.current = false;
      return;
    }

    playerJustClosedRef.current = true;
    const resetTimeout = setTimeout(() => {
      playerJustClosedRef.current = false;
    }, 300);

    if (savedScrollPositionRef.current > 0) {
      const scrollTimeout = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = savedScrollPositionRef.current;
        }
      }, 100);
      return () => {
        clearTimeout(resetTimeout);
        clearTimeout(scrollTimeout);
      };
    }

    return () => clearTimeout(resetTimeout);
  }, [playerIsOpen]);

  useEffect(() => {
    if (playerIsOpen) return;

    const timeoutId = setTimeout(() => {
      if (selectedItemRef.current && containerRef.current) {
        const container = containerRef.current;
        const item = selectedItemRef.current;
        const headerOffset = 70;

        const itemTop = item.offsetTop - headerOffset;
        const itemBottom = item.offsetTop + item.offsetHeight;
        const containerScrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        if (itemTop < containerScrollTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerScrollTop + containerHeight) {
          container.scrollTop = itemBottom - containerHeight + 20;
        }
        savedScrollPositionRef.current = container.scrollTop;
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [activeEvent]);

  // Keyboard navigation
  useWindowEvent('keydown', (e) => {
    if (!data || !data.conference || !data.conference.lectures) return;
    const totalEvents = data.conference.lectures.nodes.length;

    // Don't handle keyboard events when player is open (Player handles its own back/escape)
    if (playerIsOpen) return;

    // Don't handle keyboard events if sidebar is focused
    if (sidebarFocused) return;

    if (e.key === 'Escape' || e.keyCode === 461) {
      e.preventDefault();
      if (!playerJustClosedRef.current) {
        onClose?.();
      }
    } else if (e.key === 'Enter') {
      setPlayerIsOpen(true);
      setIsPlayerFullscreen(true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveEvent((prev) => (prev + 1) % totalEvents);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      // Check if at start of a row (leftmost position)
      if (activeEvent % eventsPerRow === 0) {
        onFocusSidebar();
      } else {
        setActiveEvent((prev) => prev - 1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveEvent((prev) => Math.min(prev + eventsPerRow, totalEvents - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveEvent((prev) => Math.max(prev - eventsPerRow, 0));
    }
  });

  if (loading) {
    return (
      <Center h={"100vh"}>
        <Loader color="#AAF40D" type="dots" size="xl" />
      </Center>
    );
  }

  if (error) {
    return <p>Error: {error.message}</p>;
  }

  if (!data || !data.conference || !data.conference.lectures || !data.conference.lectures.nodes.length) {
    return (
      <Center h={"100vh"}>
        <p>No videos found for this conference.</p>
      </Center>
    );
  }

  const conference = data.conference;
  const events = conference.lectures.nodes;

  if (playerIsOpen) {
    return (
      <div className="player-fullscreen-container">
        <Player
          event={events[activeEvent]}
          conferenceTitle={conference.title}
          onClose={() => {
            setPlayerIsOpen(false);
            setIsPlayerFullscreen(false);
          }}
        />
      </div>
    );
  }

  return (
    <Container fluid>
      <Preview
        event={events[activeEvent]}
        conferenceTitle={conference.title}
      />
      <div className="conferenceView__container" ref={containerRef} onScroll={handleScroll}>
        <div className="conferenceView__header">
          <h2 className="conferenceView__title">{conference.title}</h2>
        </div>
        <div className="conferenceView__grid">
          {events.map((event, index) => (
            <div
              key={event.guid}
              ref={index === activeEvent ? selectedItemRef : null}
              className={`conferenceView__gridItem ${index === activeEvent ? 'conferenceView__gridItem--active' : ''}`}
              onClick={() => setActiveEvent(index)}
            >
              <img
                src={event.images.thumbUrl}
                alt={event.title}
                className="conferenceView__gridItem__img"
                loading="lazy"
              />
              <div className="conferenceView__gridItem__title">{event.title}</div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
});

export default ConferenceView;
