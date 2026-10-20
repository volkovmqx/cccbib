import type { ConferenceSummary } from '@/entities/conference';
import type { PageProps } from '@/shared/ui';
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '@/shared/api';
import { ListView } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

const EventsListView = React.memo(function EventsListView({ onClose, onSelectEvent, onFocusSidebar, sidebarFocused, selectedIndex, setSelectedIndex }: PageProps & { onSelectEvent: (id: string) => void; selectedIndex: number; setSelectedIndex: React.Dispatch<React.SetStateAction<number>> }) {
  const t = useTranslation();
  const [conferences, setConferences] = useState<ConferenceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConferences = async () => {
      try {
        const response = await fetch(`${API_BASE}/conferences`);
        if (!response.ok) {
          throw new Error(`Failed to fetch conferences: ${response.statusText}`);
        }

        const data = await response.json() as { conferences?: ConferenceSummary[] };
        const confs = data.conferences || [];

        confs.sort((a, b) => {
          const dateA = new Date(b.event_last_released_at || b.updated_at || 0);
          const dateB = new Date(a.event_last_released_at || a.updated_at || 0);
          return dateA.getTime() - dateB.getTime();
        });

        setConferences(confs);
      } catch (err) {
        console.error('Error fetching conferences:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchConferences();
  }, []);

  const handleSelect = useCallback((item: ConferenceSummary) => {
    onSelectEvent(item.acronym);
  }, [onSelectEvent]);

  const renderItem = useCallback((conference: ConferenceSummary) => (
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
      title={t('Events')}
      items={conferences}
      loading={loading}
      error={error}
      selectedIndex={selectedIndex}
      setSelectedIndex={setSelectedIndex}
      onClose={onClose}
      onSelect={handleSelect}
      onFocusSidebar={onFocusSidebar}
      sidebarFocused={sidebarFocused}
      emptyMessage={t('No events found')}
      renderItem={renderItem}
      className="eventsListView"
      itemClassName="eventsListView__item"
      selectedItemClassName="eventsListView__item--selected"
    />
  );
});

export default EventsListView;
