import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Home } from '../components/Home';
import { Sidebar } from '../components/Sidebar';
import { Player } from '../components/Player';
import { useTranslation } from '../i18n';
import { onAppCommand, dispatchCommand, queuePlayerCommand } from '../remote';
import { fetchTalk } from '../helpers/remoteTalk';
import { applyListCommand, LIST_COMMANDS } from '../helpers/remoteLists';

const NOTICE_MS = 3500;
const PLAY_EXTRAS = ['aspect', 'subtitle', 'language'];

export default function App() {
  const t = useTranslation();
  const [sidebarFocused, setSidebarFocused] = useState(false);
  const [selectedItem, setSelectedItem] = useState('recent');
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const [remote, setRemote] = useState(null);
  const [notice, setNotice] = useState('');
  const remoteRef = useRef(null);
  const noticeTimerRef = useRef(null);
  remoteRef.current = remote;

  const showNotice = useCallback((message) => {
    setNotice(message);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(''), NOTICE_MS);
  }, []);

  const handleCommand = useCallback(async (command) => {
    if (LIST_COMMANDS.includes(command.cmd)) {
      const playing = remoteRef.current && remoteRef.current.talk.guid;
      const result = await applyListCommand(command, playing, (seconds) => dispatchCommand({ cmd: 'seek', to: seconds }));
      const notices = {
        none: t('Could not load this talk'),
        added: t('Added to watchlist: {title}', result),
        duplicate: t('Already in watchlist: {title}', result),
        removed: t('Removed from watchlist: {title}', result),
        progress: t('Progress saved: {title}', result),
        cleared: t('Progress cleared: {title}', result),
        watchlist: t('Watchlist updated ({count})', result),
        progressList: t('Progress updated ({count})', result),
      };
      showNotice(notices[result.kind]);
      return;
    }

    let talk;
    try {
      talk = await fetchTalk(command.link);
    } catch (err) {
      showNotice(t('Could not load this talk'));
      return;
    }

    if (command.cmd === 'play') {
      const extras = PLAY_EXTRAS.filter((key) => command[key] !== undefined).map((key) => ({ cmd: key, value: command[key] }));
      if (remoteRef.current && remoteRef.current.talk.guid === talk.guid) {
        if (Number.isFinite(command.start)) extras.push({ cmd: 'seek', to: command.start });
        extras.forEach(dispatchCommand);
        return;
      }
      extras.forEach(queuePlayerCommand);
      setIsPlayerFullscreen(false);
      setRemote({ talk, startAt: Number.isFinite(command.start) ? command.start : undefined });
    }
  }, [showNotice, t]);

  const handleCommandRef = useRef(handleCommand);
  handleCommandRef.current = handleCommand;
  useEffect(() => onAppCommand((command) => handleCommandRef.current(command)), []);
  useEffect(() => () => clearTimeout(noticeTimerRef.current), []);
  useEffect(() => {
    if (remote && window.__cccbibReady) window.__cccbibReady();
  }, [remote]);

  const fullscreen = isPlayerFullscreen || Boolean(remote);

  return (
    <div className={`appShell ${fullscreen ? 'appShell--fullscreen' : ''}`}>
      {!fullscreen && (
        <nav className="appShell__nav">
          <Sidebar
            selectedItem={selectedItem}
            onSelectItem={(item) => {
              setSelectedItem(item);
              setSidebarFocused(false);
            }}
            focused={sidebarFocused}
          />
        </nav>
      )}
      <main className="appShell__main">
        {remote ? (
          <div className="player-fullscreen-container">
            <Player
              key={remote.talk.guid}
              event={remote.talk}
              conferenceTitle={remote.talk.conference_title}
              startAt={remote.startAt}
              onClose={() => setRemote(null)}
            />
          </div>
        ) : (
          <Home
            selectedItem={selectedItem}
            onFocusSidebar={() => setSidebarFocused(true)}
            onSelectItem={(item) => setSelectedItem(item)}
            sidebarFocused={sidebarFocused}
            isPlayerFullscreen={isPlayerFullscreen}
            setIsPlayerFullscreen={setIsPlayerFullscreen}
          />
        )}
      </main>
      {notice && <div className="remote-notice">{notice}</div>}
    </div>
  );
}
