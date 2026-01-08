import React, { useState, useRef, useEffect } from 'react';
import { Center, Loader, Container, Title } from '@mantine/core';
import { useWindowEvent } from '@mantine/hooks';
import { useQuery } from '@apollo/client';
import { GET_CONFERENCE } from '../data';
import { Preview } from './Preview';
import { Player } from './Player';

import '../styles.css';

export const ConferenceView = React.memo(function ConferenceView({ conferenceId, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen }) {
  const [playerIsOpen, setPlayerIsOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(0);
  const selectedItemRef = useRef(null);
  const containerRef = useRef(null);

  const { loading, error, data } = useQuery(GET_CONFERENCE, {
    variables: { id: conferenceId },
    fetchPolicy: 'cache-first', // Use cache for better performance
  });

  const eventsPerRow = 4;

  // Scroll selected item into view with header offset
  useEffect(() => {
    if (selectedItemRef.current && containerRef.current) {
      const container = containerRef.current;
      const item = selectedItemRef.current;
      const headerOffset = 70; // Account for sticky header

      const itemTop = item.offsetTop - headerOffset;
      const itemBottom = item.offsetTop + item.offsetHeight;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      // Check if item is above visible area
      if (itemTop < containerScrollTop) {
        container.scrollTop = itemTop;
      }
      // Check if item is below visible area
      else if (itemBottom > containerScrollTop + containerHeight) {
        container.scrollTop = itemBottom - containerHeight + 20;
      }
    }
  }, [activeEvent]);

  // Keyboard navigation
  useWindowEvent('keydown', (e) => {
    if (!data || !data.conference || !data.conference.lectures) return;
    const totalEvents = data.conference.lectures.nodes.length;

    // Don't handle keyboard events when player is open (Player handles its own back/escape)
    if (playerIsOpen) return;

    // Don't handle keyboard events if sidebar is focused
    if (sidebarFocused) return;

    if (e.key === 'Enter') {
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
      <div className="conferenceView__container" ref={containerRef}>
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
