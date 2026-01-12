import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TextInput, Loader, Center, Box, Text, Stack } from '@mantine/core';
import { useDebouncedValue, useWindowEvent } from '@mantine/hooks';
import { formatSeconds } from '../helpers/helpers';
import { isDevelopment, useScrollIntoView } from '../helpers/scrollHelpers';

export const Search = React.memo(function Search({ onClose, onSelectEvent, onFocusSidebar, sidebarFocused }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 400);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsContainerRef = useRef(null);
  const selectedItemRef = useRef(null);

  const inputStyles = useMemo(() => ({
    input: {
      fontSize: '3rem',
      padding: '24px 32px',
      fontWeight: 'bold',
      backgroundColor: query ? '#25262b' : '#AAF40D',
      color: query ? '#fff' : '#000',
      border: 'none',
      '&:focus': {
        border: 'none',
        borderColor: 'transparent'
      },
      '&::placeholder': {
        color: query ? '#666' : '#000',
        fontWeight: 'bold'
      }
    }
  }), [query]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length === 0) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const abortController = new AbortController();

    const fetchResults = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use proxy in dev to avoid CORS
        const apiUrl = isDevelopment()
          ? `/api/public/events/search?q=${encodeURIComponent(debouncedQuery)}`
          : `https://api.media.ccc.de/public/events/search?q=${encodeURIComponent(debouncedQuery)}`;

        const response = await fetch(apiUrl, {
          signal: abortController.signal,
          headers: {
            'Accept': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText} (${response.status})`);
        }

        const data = await response.json();

        if (!data || !data.events) {
          throw new Error('Invalid API response format');
        }

        // Transform REST API response to match GraphQL format
        const transformedResults = data.events.map(event => ({
          guid: event.guid,
          title: event.title,
          description: event.description,
          duration: event.length || event.duration,
          viewCount: event.view_count,
          persons: event.persons || [],
          conference_title: event.conference_title,
          images: {
            thumbUrl: event.thumb_url,
            posterUrl: event.poster_url
          },
          videos: (event.recordings || [])
            .filter(r => r.mime_type && r.mime_type.includes('video'))
            .map(r => ({
              url: r.recording_url,
              mimeType: r.mime_type,
              language: event.original_language || 'eng',
              width: r.width,
              highQuality: r.high_quality
            })),
          subtitles: (event.recordings || [])
            .filter(r => r.mime_type && (r.mime_type.includes('text') || r.mime_type.includes('vtt')))
            .map(r => ({
              url: r.recording_url,
              mimeType: r.mime_type,
              language: r.language || 'eng'
            }))
        }));

        setResults(transformedResults);
        setSelectedIndex(0);
      } catch (err) {
        // Ignore abort errors - they're expected when query changes
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Search error details:', err);
        if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
          setError('Network error. Please check your internet connection or try again later.');
        } else {
          setError(err.message || 'An error occurred while searching');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchResults();

    return () => abortController.abort();
  }, [debouncedQuery]);

  useScrollIntoView(selectedItemRef, resultsContainerRef, selectedIndex);

  useWindowEvent('keydown', (e) => {
    if (sidebarFocused) return;

    if (e.key === 'Escape' || e.keyCode === 461) {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        // Blur input to exit keyboard mode on TV
        inputRef.current?.blur();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => {
          const newIndex = (prev - 1 + results.length) % results.length;
          // If wrapping to bottom, stay blurred; otherwise check if going back to input
          if (prev === 0) {
            inputRef.current?.focus();
          }
          return prev === 0 ? 0 : newIndex;
        });
      }
    } else if (e.key === 'Enter' && results.length > 0 && document.activeElement !== inputRef.current) {
      e.preventDefault();
      onSelectEvent(results[selectedIndex]);
    } else if (e.key === 'ArrowLeft') {
      const cursorPosition = inputRef.current?.selectionStart || 0;
      if (cursorPosition === 0 || document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.blur();
        onFocusSidebar();
      }
    }
  });

  return (
    <div className="searchContainer">
      <Stack spacing="md">
        <TextInput
          ref={inputRef}
          className="searchInput"
          size="lg"
          placeholder="Search media.ccc.de events..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          styles={inputStyles}
        />

        <div className="searchResults scrollable" ref={resultsContainerRef}>
          {loading && (
            <Center h={200}>
              <Loader color="#AAF40D" type="dots" size="xl" />
            </Center>
          )}

          {error && (
            <Center h={200}>
              <Text color="red" size="lg">
                Error: {error}
              </Text>
            </Center>
          )}

          {!loading && !error && results.length > 0 && (
            <div>
              {results.map((event, index) => (
                <div
                  key={event.guid}
                  ref={index === selectedIndex ? selectedItemRef : null}
                  className={`listItem ${index === selectedIndex ? 'listItem--selected' : ''}`}
                  onClick={() => onSelectEvent(event)}
                >
                  {event.images.thumbUrl && (
                    <img
                      src={event.images.thumbUrl}
                      alt={event.title}
                      className="thumbnail"
                      loading="lazy"
                    />
                  )}
                  <div className="itemInfo">
                    <div className="itemTitle">{event.title}</div>
                    <div className="itemMeta">
                      {event.conference_title && (
                        <span>{event.conference_title}</span>
                      )}
                      {event.duration && (
                        <span> • {formatSeconds(event.duration)}</span>
                      )}
                      {event.persons && event.persons.length > 0 && (
                        <span> • {event.persons.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Stack>
    </div>
  );
});

export default Search;
