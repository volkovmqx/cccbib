import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { GET_RECENT_CONFERENCES } from '../data';
import { Player } from './Player';
import { ListView } from './ListView';
import { formatSeconds } from '../helpers/helpers';

import '../styles.css';

export const PopularView = React.memo(function PopularView({ onClose, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const { loading, error, data } = useQuery(GET_RECENT_CONFERENCES, {
    variables: { offset: 0 },
    fetchPolicy: 'cache-first',
  });

  const videos = useMemo(() => {
    if (!data || !data.conferencesRecent) return [];

    const allVideos = [];
    data.conferencesRecent.forEach(conference => {
      conference.lectures.nodes.forEach(lecture => {
        allVideos.push({
          ...lecture,
          conference_title: conference.title,
          conference_updated_at: conference.eventLastReleasedAt || conference.updatedAt,
        });
      });
    });

    allVideos.sort((a, b) => {
      const viewDiff = (b.viewCount || 0) - (a.viewCount || 0);
      if (viewDiff !== 0) return viewDiff;
      const dateA = new Date(a.conference_updated_at || 0);
      const dateB = new Date(b.conference_updated_at || 0);
      return dateB - dateA;
    });

    return allVideos.slice(0, 100);
  }, [data]);

  const handleSelect = useCallback((item) => {
    setSelectedVideo(item);
    setIsPlayerFullscreen(true);
  }, [setIsPlayerFullscreen]);

  const renderItem = useCallback((video) => (
    <>
      {video.images.thumbUrl && (
        <img
          src={video.images.thumbUrl}
          alt={video.title}
          className="popularView__thumbnail"
          loading="lazy"
        />
      )}
      <div className="popularView__info">
        <div className="popularView__title">{video.title}</div>
        <div className="popularView__meta">
          {video.conference_title && <span>{video.conference_title}</span>}
          {video.duration && <span> • {formatSeconds(video.duration)}</span>}
          {video.viewCount && <span> • {video.viewCount.toLocaleString()} views</span>}
          {video.persons && video.persons.length > 0 && (
            <span> • {video.persons.join(', ')}</span>
          )}
        </div>
      </div>
    </>
  ), []);

  if (selectedVideo) {
    return (
      <div className="player-fullscreen-container">
        <Player
          event={selectedVideo}
          conferenceTitle={selectedVideo.conference_title}
          onClose={() => {
            setSelectedVideo(null);
            setIsPlayerFullscreen(false);
          }}
        />
      </div>
    );
  }

  return (
    <ListView
      title="Popular Videos"
      items={videos}
      loading={loading}
      error={error?.message}
      selectedIndex={selectedIndex}
      setSelectedIndex={setSelectedIndex}
      onClose={onClose}
      onSelect={handleSelect}
      onFocusSidebar={onFocusSidebar}
      sidebarFocused={sidebarFocused}
      disabled={!!selectedVideo}
      emptyMessage="No videos found"
      renderItem={renderItem}
      className="popularView"
      itemClassName="popularView__item"
      selectedItemClassName="popularView__item--selected"
    />
  );
});

export default PopularView;
