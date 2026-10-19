import { getSetting } from './settings';

const APP_COMMANDS = ['play', 'add', 'remove', 'progress', 'progress-set', 'progress-clear'];
const PLAYER_COMMANDS = ['pause', 'resume', 'toggle', 'seek', 'mute', 'aspect', 'subtitle', 'language', 'stop'];
const BACKLOG_MS = 20000;
const STARTUP_DUPLICATE_MS = 3000;

let appHandler = null;
let playerHandler = null;
const appBacklog = [];
let playerBacklog = [];
let startupKey = '';
let startupUntil = 0;

const fresh = (entry) => Date.now() - entry.at < BACKLOG_MS;

export function onAppCommand(handler) {
  appHandler = handler;
  appBacklog.splice(0).filter(fresh).forEach((entry) => handler(entry.command));
  return () => {
    if (appHandler === handler) appHandler = null;
  };
}

export function onPlayerCommand(handler) {
  playerHandler = handler;
  const waiting = playerBacklog.filter(fresh);
  playerBacklog = [];
  waiting.forEach((entry) => handler(entry.command));
  return () => {
    if (playerHandler === handler) playerHandler = null;
  };
}

// Held back until the next player mounts, so a command sent along with a new talk reaches the new player
export function queuePlayerCommand(command) {
  playerBacklog.push({ command, at: Date.now() });
}

export function dispatchCommand(command) {
  if (APP_COMMANDS.includes(command.cmd)) {
    if (appHandler) appHandler(command);
    else appBacklog.push({ command, at: Date.now() });
  } else if (playerHandler) {
    playerHandler(command);
  }
}

export function parseCommand(raw) {
  let params = raw;
  if (typeof params === 'string') {
    try {
      params = JSON.parse(params);
    } catch (err) {
      return null;
    }
  }
  if (!params || typeof params !== 'object') return null;
  const cmd = params.cmd || (params.link ? 'play' : null);
  if (!APP_COMMANDS.includes(cmd) && !PLAYER_COMMANDS.includes(cmd)) return null;
  return { ...params, cmd };
}

function receive(raw, atStartup) {
  if (getSetting('remoteControl') === 'off') return;
  const command = parseCommand(raw);
  if (!command) return;
  const key = JSON.stringify(command);
  if (!atStartup && key === startupKey && Date.now() < startupUntil) return;
  if (atStartup) {
    startupKey = key;
    startupUntil = Date.now() + STARTUP_DUPLICATE_MS;
  }
  dispatchCommand(command);
}

export function initRemote() {
  const system = window.webOSSystem || window.PalmSystem;
  if (system && system.launchParams) receive(system.launchParams, true);
  const onLaunch = (event) => receive(event.detail);
  document.addEventListener('webOSLaunch', onLaunch);
  document.addEventListener('webOSRelaunch', onLaunch);
}
