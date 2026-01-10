import React, { useState, useRef, useEffect } from 'react';
import { useLocalStorage, useWindowEvent } from '@mantine/hooks';
import { Center, Text } from '@mantine/core';
import { LANGUAGES, SUBTITLE_LANGUAGES, SUBTITLE_SIZES, SUBTITLE_STYLES, PREVIEW_VIDEO_OPTIONS } from '../constants';
import { useScrollIntoView } from '../helpers/scrollHelpers';

const ACTION_OPTIONS = [
  { code: 'clearCache', name: 'Clear Cache' },
  { code: 'clearWatchlist', name: 'Clear Watchlist' },
];

export const Settings = React.memo(function Settings({ onClose, onFocusSidebar, sidebarFocused }) {
  const [language, setLanguage] = useLocalStorage({
    key: 'language',
    defaultValue: 'deu',
  });
  const [subtitleLanguage, setSubtitleLanguage] = useLocalStorage({
    key: 'subtitleLanguage',
    defaultValue: 'none',
  });
  const [subtitleSize, setSubtitleSize] = useLocalStorage({
    key: 'subtitleSize',
    defaultValue: 'medium',
  });
  const [subtitleStyle, setSubtitleStyle] = useLocalStorage({
    key: 'subtitleStyle',
    defaultValue: 'green',
  });
  const [previewVideo, setPreviewVideo] = useLocalStorage({
    key: 'previewVideo',
    defaultValue: 'on',
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSection, setActiveSection] = useState('audio'); // 'audio', 'subtitle', 'subtitleSize', 'subtitleStyle', 'previewVideo', or 'actions'
  const selectedItemRef = useRef(null);
  const gridRef = useRef(null);
  const [gridColumns, setGridColumns] = useState(4);

  // Clear cache removes Apollo cache and saved playback positions
  const handleAction = (actionCode) => {
    if (actionCode === 'clearCache') {
      localStorage.removeItem('apollo_schema_version');
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('playback_position_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.reload();
    } else if (actionCode === 'clearWatchlist') {
      localStorage.removeItem('watchlist');
      alert('Watchlist cleared');
    }
  };

  React.useEffect(() => {
    document.body.setAttribute('data-subtitle-style', subtitleStyle);
  }, [subtitleStyle]);

  // Calculate grid columns for arrow key navigation
  useEffect(() => {
    const calculateColumns = () => {
      if (gridRef.current) {
        const gridElement = gridRef.current;
        const gridComputedStyle = window.getComputedStyle(gridElement);
        const gridColumnCount = gridComputedStyle.getPropertyValue('grid-template-columns').split(' ').length;
        setGridColumns(gridColumnCount);
      }
    };

    calculateColumns();
    window.addEventListener('resize', calculateColumns);
    return () => window.removeEventListener('resize', calculateColumns);
  }, [activeSection]);

  useScrollIntoView(selectedItemRef, gridRef, [selectedIndex, activeSection], 'center');

  React.useEffect(() => {
    if (activeSection === 'audio') {
      const index = LANGUAGES.findIndex(opt => opt.code === language);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    } else if (activeSection === 'subtitle') {
      const index = SUBTITLE_LANGUAGES.findIndex(opt => opt.code === subtitleLanguage);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    } else if (activeSection === 'subtitleSize') {
      const index = SUBTITLE_SIZES.findIndex(opt => opt.code === subtitleSize);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    } else if (activeSection === 'subtitleStyle') {
      const index = SUBTITLE_STYLES.findIndex(opt => opt.code === subtitleStyle);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    } else if (activeSection === 'previewVideo') {
      const index = PREVIEW_VIDEO_OPTIONS.findIndex(opt => opt.code === previewVideo);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    } else if (activeSection === 'actions') {
      setSelectedIndex(0);
    }
  }, [language, subtitleLanguage, subtitleSize, subtitleStyle, previewVideo, activeSection]);

  useWindowEvent('keydown', (e) => {
    if (sidebarFocused) return;

    if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 461) {
      e.preventDefault();
      onClose();
      return;
    }

    let currentOptions;
    let columns = gridColumns;

    if (activeSection === 'audio') {
      currentOptions = LANGUAGES;
    } else if (activeSection === 'subtitle') {
      currentOptions = SUBTITLE_LANGUAGES;
    } else if (activeSection === 'subtitleSize') {
      currentOptions = SUBTITLE_SIZES;
    } else if (activeSection === 'subtitleStyle') {
      currentOptions = SUBTITLE_STYLES;
    } else if (activeSection === 'previewVideo') {
      currentOptions = PREVIEW_VIDEO_OPTIONS;
    } else if (activeSection === 'actions') {
      currentOptions = ACTION_OPTIONS;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % currentOptions.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (selectedIndex % columns === 0) {
        onFocusSidebar();
      } else {
        setSelectedIndex((prev) => prev - 1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = selectedIndex + columns;
      if (newIndex < currentOptions.length) {
        setSelectedIndex(newIndex);
      } else {
        if (activeSection === 'audio') {
          setActiveSection('subtitle');
          setSelectedIndex(0);
        } else if (activeSection === 'subtitle') {
          setActiveSection('subtitleSize');
          setSelectedIndex(0);
        } else if (activeSection === 'subtitleSize') {
          setActiveSection('subtitleStyle');
          setSelectedIndex(0);
        } else if (activeSection === 'subtitleStyle') {
          setActiveSection('previewVideo');
          setSelectedIndex(0);
        } else if (activeSection === 'previewVideo') {
          setActiveSection('actions');
          setSelectedIndex(0);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = selectedIndex - columns;
      if (newIndex >= 0) {
        setSelectedIndex(newIndex);
      } else {
        if (activeSection === 'subtitle') {
          setActiveSection('audio');
          const lastRow = Math.floor((LANGUAGES.length - 1) / columns) * columns;
          setSelectedIndex(lastRow);
        } else if (activeSection === 'subtitleSize') {
          setActiveSection('subtitle');
          const lastRow = Math.floor((SUBTITLE_LANGUAGES.length - 1) / columns) * columns;
          setSelectedIndex(lastRow);
        } else if (activeSection === 'subtitleStyle') {
          setActiveSection('subtitleSize');
          setSelectedIndex(0);
        } else if (activeSection === 'previewVideo') {
          setActiveSection('subtitleStyle');
          setSelectedIndex(0);
        } else if (activeSection === 'actions') {
          setActiveSection('previewVideo');
          setSelectedIndex(0);
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSection === 'audio') {
        setLanguage(LANGUAGES[selectedIndex].code);
      } else if (activeSection === 'subtitle') {
        setSubtitleLanguage(SUBTITLE_LANGUAGES[selectedIndex].code);
      } else if (activeSection === 'subtitleSize') {
        setSubtitleSize(SUBTITLE_SIZES[selectedIndex].code);
      } else if (activeSection === 'subtitleStyle') {
        setSubtitleStyle(SUBTITLE_STYLES[selectedIndex].code);
      } else if (activeSection === 'previewVideo') {
        setPreviewVideo(PREVIEW_VIDEO_OPTIONS[selectedIndex].code);
      } else if (activeSection === 'actions') {
        handleAction(ACTION_OPTIONS[selectedIndex].code);
      }
    }
  });

  return (
    <div className="settingsView">
      <div className="settingsView__header">
        <h2>Settings</h2>
      </div>
      <div className="settingsView__content">
        <div className="settingsView__section">
          <h3 className="settingsView__sectionTitle">Preferred Audio Language</h3>
          <p className="settingsView__sectionDescription">
            Select your preferred language for video playback. This will be used when available.
          </p>
          <div className="settingsView__languageList" ref={activeSection === 'audio' ? gridRef : null}>
            {LANGUAGES.map((option, index) => (
              <div
                key={option.code}
                ref={index === selectedIndex && activeSection === 'audio' ? selectedItemRef : null}
                className={`settingsView__languageItem ${index === selectedIndex && activeSection === 'audio' ? 'settingsView__languageItem--selected' : ''} ${option.code === language ? 'settingsView__languageItem--current' : ''}`}
                onClick={() => {
                  setLanguage(option.code);
                  setSelectedIndex(index);
                  setActiveSection('audio');
                }}
              >
                <span className="settingsView__languageName">{option.name}</span>
                {option.code === language && (
                  <span className="settingsView__currentBadge">Current</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="settingsView__section">
          <h3 className="settingsView__sectionTitle">Preferred Subtitle Language</h3>
          <p className="settingsView__sectionDescription">
            Select your preferred language for subtitles. This will be used when available.
          </p>
          <div className="settingsView__languageList" ref={activeSection === 'subtitle' ? gridRef : null}>
            {SUBTITLE_LANGUAGES.map((option, index) => (
              <div
                key={option.code}
                ref={index === selectedIndex && activeSection === 'subtitle' ? selectedItemRef : null}
                className={`settingsView__languageItem ${index === selectedIndex && activeSection === 'subtitle' ? 'settingsView__languageItem--selected' : ''} ${option.code === subtitleLanguage ? 'settingsView__languageItem--current' : ''}`}
                onClick={() => {
                  setSubtitleLanguage(option.code);
                  setSelectedIndex(index);
                  setActiveSection('subtitle');
                }}
              >
                <span className="settingsView__languageName">{option.name}</span>
                {option.code === subtitleLanguage && (
                  <span className="settingsView__currentBadge">Current</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="settingsView__section">
          <h3 className="settingsView__sectionTitle">Subtitle Size</h3>
          <p className="settingsView__sectionDescription">
            Choose the size of subtitles when displayed on video.
          </p>
          <div className="settingsView__languageList" ref={activeSection === 'subtitleSize' ? gridRef : null}>
            {SUBTITLE_SIZES.map((option, index) => (
              <div
                key={option.code}
                ref={index === selectedIndex && activeSection === 'subtitleSize' ? selectedItemRef : null}
                className={`settingsView__languageItem ${index === selectedIndex && activeSection === 'subtitleSize' ? 'settingsView__languageItem--selected' : ''} ${option.code === subtitleSize ? 'settingsView__languageItem--current' : ''}`}
                onClick={() => {
                  setSubtitleSize(option.code);
                  setSelectedIndex(index);
                  setActiveSection('subtitleSize');
                }}
              >
                <span className="settingsView__languageName">{option.name}</span>
                {option.code === subtitleSize && (
                  <span className="settingsView__currentBadge">Current</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="settingsView__section">
          <h3 className="settingsView__sectionTitle">Subtitle Style</h3>
          <p className="settingsView__sectionDescription">
            Choose the visual style for subtitles.
          </p>
          <div className="settingsView__languageList" ref={activeSection === 'subtitleStyle' ? gridRef : null}>
            {SUBTITLE_STYLES.map((option, index) => (
              <div
                key={option.code}
                ref={index === selectedIndex && activeSection === 'subtitleStyle' ? selectedItemRef : null}
                className={`settingsView__languageItem ${index === selectedIndex && activeSection === 'subtitleStyle' ? 'settingsView__languageItem--selected' : ''} ${option.code === subtitleStyle ? 'settingsView__languageItem--current' : ''}`}
                onClick={() => {
                  setSubtitleStyle(option.code);
                  setSelectedIndex(index);
                  setActiveSection('subtitleStyle');
                }}
              >
                <span className="settingsView__languageName">{option.name}</span>
                {option.code === subtitleStyle && (
                  <span className="settingsView__currentBadge">Current</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="settingsView__section">
          <h3 className="settingsView__sectionTitle">Preview Videos</h3>
          <p className="settingsView__sectionDescription">
            Control video previews when browsing content.
          </p>
          <div className="settingsView__languageList" ref={activeSection === 'previewVideo' ? gridRef : null}>
            {PREVIEW_VIDEO_OPTIONS.map((option, index) => (
              <div
                key={option.code}
                ref={index === selectedIndex && activeSection === 'previewVideo' ? selectedItemRef : null}
                className={`settingsView__languageItem ${index === selectedIndex && activeSection === 'previewVideo' ? 'settingsView__languageItem--selected' : ''} ${option.code === previewVideo ? 'settingsView__languageItem--current' : ''}`}
                onClick={() => {
                  setPreviewVideo(option.code);
                  setSelectedIndex(index);
                  setActiveSection('previewVideo');
                }}
              >
                <span className="settingsView__languageName">{option.name}</span>
                {option.code === previewVideo && (
                  <span className="settingsView__currentBadge">Current</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="settingsView__section">
          <h3 className="settingsView__sectionTitle">Actions</h3>
          <p className="settingsView__sectionDescription">
            Clear cached data or reset watchlist.
          </p>
          <div className="settingsView__languageList" ref={activeSection === 'actions' ? gridRef : null}>
            {ACTION_OPTIONS.map((option, index) => (
              <div
                key={option.code}
                ref={index === selectedIndex && activeSection === 'actions' ? selectedItemRef : null}
                className={`settingsView__languageItem settingsView__actionItem ${index === selectedIndex && activeSection === 'actions' ? 'settingsView__languageItem--selected' : ''}`}
                onClick={() => {
                  handleAction(option.code);
                }}
              >
                <span className="settingsView__languageName">{option.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="settingsView__section settingsView__about">
          <h3 className="settingsView__sectionTitle">About</h3>
          <p className="settingsView__sectionDescription" style={{ textAlign: 'center' }}>CCCBib made with ♥. {APP_ID} {APP_VERSION}.<br />Powered by media.ccc.de. Sponsor and help if you can!<br />Ewige Blumenkraft! ✿</p>
        </div>
      </div>
    </div>
  );
});

export default Settings;
