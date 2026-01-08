import React, { useState, useEffect, useCallback } from 'react';
import { isDevelopment } from '../helpers/scrollHelpers';
import { ListView } from './ListView';

import '../styles.css';

export const EventsListView = React.memo(function EventsListView({ onClose, onSelectEvent, onFocusSidebar, sidebarFocused }) {
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const fetchConferences = async () => {
      try {
        const apiUrl = isDevelopment()
          ? '/api/public/conferences'
          : 'https://api.media.ccc.de/public/conferences';

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch conferences: ${response.statusText}`);
        }

        const data = await response.json();
        const confs = data.conferences || [];

        confs.sort((a, b) => {
          const dateA = new Date(b.event_last_released_at || b.updated_at || 0);
          const dateB = new Date(a.event_last_released_at || a.updated_at || 0);
          return dateA - dateB;
        });

        setConferences(confs);
      } catch (err) {
        console.error('Error fetching conferences:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConferences();
  }, []);

  const handleSelect = useCallback((item) => {
    onSelectEvent(item.acronym);
  }, [onSelectEvent]);

  const renderItem = useCallback((conference) => (
    <>
      {conference.logo_url && (
        <img
          src={conference.logo_url}
          alt={conference.title}
          className="eventsListView__logo"
          loading="lazy"
        />
      )}
      <div className="eventsListView__info">
        <div className="eventsListView__title">{conference.title}</div>
        {conference.acronym && (
          <div className="eventsListView__acronym">{conference.acronym}</div>
        )}
      </div>
    </>
  ), []);

  return (
    <ListView
      title="Events"
      items={conferences}
      loading={loading}
      error={error}
      selectedIndex={selectedIndex}
      setSelectedIndex={setSelectedIndex}
      onClose={onClose}
      onSelect={handleSelect}
      onFocusSidebar={onFocusSidebar}
      sidebarFocused={sidebarFocused}
      emptyMessage="No events found"
      renderItem={renderItem}
      className="eventsListView"
      itemClassName="eventsListView__item"
      selectedItemClassName="eventsListView__item--selected"
    />
  );
});

export default EventsListView;
