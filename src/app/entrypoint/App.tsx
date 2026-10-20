import type { Talk } from '@/entities/talk';
import type { RemoteCommand } from '@/features/remote-control';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Screens } from '../routing/Screens';
import { Sidebar } from '@/widgets/sidebar';
import { Player } from '@/widgets/player';
import { useTranslation } from '@/shared/i18n';
import { onAppCommand, dispatchCommand, queuePlayerCommand } from '@/features/remote-control';
import { fetchTalk } from '@/entities/talk';
import { applyListCommand, LIST_COMMANDS } from '@/app/model';

const NOTICE_MS = 3500;
const PLAY_EXTRAS = ['aspect', 'subtitle', 'language'] as const;

export default function App() {
  const t = useTranslation();
  const [sidebarFocused, setSidebarFocused] = useState(false);
  const [selectedItem, setSelectedItem] = useState('recent');
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const [remote, setRemote] = useState<{ talk: Talk; startAt?: number } | null>(null);
  const [notice, setNotice] = useState('');
  const remoteRef = useRef<typeof remote>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  remoteRef.current = remote;

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
          <Screens
            selectedItem={selectedItem}
            onFocusSidebar={() => setSidebarFocused(true)}
            onSelectItem={(item) => setSelectedItem(item)}
            sidebarFocused={sidebarFocused}
            setIsPlayerFullscreen={setIsPlayerFullscreen}
          />
        )}
      </main>
      {notice && <div className="remote-notice">{notice}</div>}
    </div>
  );
}
