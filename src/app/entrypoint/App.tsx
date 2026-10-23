import type { Talk } from '@/entities/talk';
import type { RemoteCommand } from '@/features/remote-control';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Screens } from '../routing/Screens';
import { Sidebar } from '@/widgets/sidebar';
import { Player } from '@/widgets/player';
import { OfflineBanner } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { pointerMoved, useWheelNavigation } from '@/shared/lib';
import { onAppCommand, dispatchCommand, queuePlayerCommand } from '@/features/remote-control';
import { fetchTalk } from '@/entities/talk';
import { applyListCommand, LIST_COMMANDS } from '@/app/model';

const NOTICE_MS = 3500;
const PLAY_EXTRAS = ['aspect', 'subtitle', 'language'] as const;

export default function App() {
  const t = useTranslation();
  const [sidebarFocused, setSidebarFocused] = useState(false);
  useWheelNavigation(() => {
    if (sidebarFocused) return false;
    setSidebarFocused(true);
    return true;
  });
  const [selectedItem, setSelectedItem] = useState('recent');
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const [remote, setRemote] = useState<{ talk: Talk; startAt?: number } | null>(null);
  const [notice, setNotice] = useState('');
  const remoteRef = useRef<typeof remote>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  remoteRef.current = remote;

  const selectFromMenu = useCallback((item: string) => {
    setSelectedItem(item);
    setSidebarFocused(false);
  }, []);
  const focusSidebar = useCallback(() => setSidebarFocused(true), []);
  const closeRemote = useCallback(() => setRemote(null), []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(''), NOTICE_MS);
  }, []);

  const handleCommand = useCallback(async (command: RemoteCommand) => {
    if (LIST_COMMANDS.includes(command.cmd)) {
      const result = await applyListCommand(command, (seconds) => dispatchCommand({ cmd: 'seek', to: seconds }));
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
      const extras: RemoteCommand[] = PLAY_EXTRAS.filter((key) => command[key] !== undefined).map((key) => ({ cmd: key, value: command[key] }));
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
  useEffect(() => onAppCommand((command: RemoteCommand) => handleCommandRef.current(command)), []);
  useEffect(() => () => clearTimeout(noticeTimerRef.current), []);
  useEffect(() => {
    if (remote && window.__cccbibReady) window.__cccbibReady();
  }, [remote]);

  // A talk started from outside replaces the screens, one started on a screen plays over it
  const standalone = Boolean(remote);

  return (
    <>
      <OfflineBanner />
      <div className={`appShell ${standalone ? 'appShell--fullscreen' : ''} ${isPlayerFullscreen ? 'appShell--playing' : ''}`}>
        {!standalone && (
          <nav className="appShell__nav" onMouseMove={(e) => { if (pointerMoved(e) && !sidebarFocused) setSidebarFocused(true); }}>
            <Sidebar
              selectedItem={selectedItem}
              onSelectItem={selectFromMenu}
              focused={sidebarFocused}
            />
          </nav>
        )}
        <main className="appShell__main" onMouseMove={(e) => { if (pointerMoved(e) && sidebarFocused) setSidebarFocused(false); }}>
          {remote ? (
            <div className="player-fullscreen-container">
              <Player
                key={remote.talk.guid}
                event={remote.talk}
                conferenceTitle={remote.talk.conference_title}
                startAt={remote.startAt}
                onClose={closeRemote}
              />
            </div>
          ) : (
            <Screens
              selectedItem={selectedItem}
              onFocusSidebar={focusSidebar}
              onSelectItem={setSelectedItem}
              sidebarFocused={sidebarFocused}
              setIsPlayerFullscreen={setIsPlayerFullscreen}
            />
          )}
        </main>
        {notice && <div className="remote-notice">{notice}</div>}
      </div>
    </>
  );
}
