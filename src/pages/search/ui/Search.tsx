import type { Talk } from '@/entities/talk';
import type { PageProps } from '@/shared/ui';
import React, { useState, useEffect, useRef } from 'react';
import { useWindowEvent } from '@/shared/lib';
import { formatSeconds } from '@/entities/talk';
import { useScrollIntoView } from '@/shared/lib';
import { searchLectures, getCachedSearch, normalizeQuery } from '../api/search';
import { Spinner } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

const SEARCH_DEBOUNCE_MS = 200;

const Search = React.memo(function Search({ onClose, onSelectEvent, onFocusSidebar, sidebarFocused }: PageProps & { onSelectEvent: (talk: Talk) => void }) {
  const t = useTranslation();
  const [query, setQuery] = useState('');
  const [submitCount, setSubmitCount] = useState(0);
  const [results, setResults] = useState<Talk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const submitNowRef = useRef(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!normalizeQuery(query)) {
      setResults([]);
      setLoading(false);
      setError(null);
      setSelectedIndex(0);
      return undefined;
    }

    const cached = getCachedSearch(query);
    if (cached) {
      setResults(cached);
      setLoading(false);
      setError(null);
      setSelectedIndex(0);
      return undefined;
    }

    const abortController = new AbortController();
    const delay = submitNowRef.current ? 0 : SEARCH_DEBOUNCE_MS;
    submitNowRef.current = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const found = await searchLectures(query, abortController.signal);
        if (abortController.signal.aborted) return;
        setResults(found);
        setError(null);
        setSelectedIndex(0);
        setLoading(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError' || abortController.signal.aborted) return;
        console.error('Search error details:', err);
        if ((err as Error).name === 'TypeError') {
          setError(t('Network error. Please check your internet connection or try again later.'));
        } else {
          setError((err as Error).message || t('An error occurred while searching'));
        }
        setLoading(false);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [query, submitCount]);

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
    } else if (e.key === 'Enter' && document.activeElement === inputRef.current) {
      submitNowRef.current = true;
      setSubmitCount((count) => count + 1);
    } else if (e.key === 'Enter' && results.length > 0) {
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
      <div>
        <div className={`searchInput ${query ? 'searchInput--filled' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            placeholder={t('Search media.ccc.de events...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="searchResults scrollable" ref={resultsContainerRef}>
          {loading && results.length === 0 && (
            <div className="center" style={{ height: 200 }}>
              <Spinner />
            </div>
          )}

          {error && (
            <div className="center" style={{ height: 200 }}>
              <p className="errorText">{t('Error: {message}', { message: error })}</p>
            </div>
          )}

          {!error && results.length > 0 && (
            <div className={loading ? 'searchResults__list--stale' : undefined}>
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
                      decoding="async"
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
      </div>
    </div>
  );
});

export default Search;
