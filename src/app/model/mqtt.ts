import type { MqttConnection } from '@/shared/lib';
import { getSetting, setSetting, subscribeSettings } from '@/shared/config';
import { connectMqtt } from '@/shared/lib';
import { readNowPlaying, subscribeNowPlaying } from '@/widgets/player';
import { talkLink } from './report';

const CLIENT_ID = 'cccbib';
const AVAILABILITY_TOPIC = 'cccbib/availability';
const STATE_TOPIC = 'cccbib/state';
const DISCOVERY_TOPIC = 'homeassistant/sensor/cccbib/config';
const DISCOVERY_CONFIG = JSON.stringify({
  name: 'CCCBib',
  unique_id: 'cccbib',
  icon: 'mdi:video',
  state_topic: STATE_TOPIC,
  value_template: '{{ value_json.state }}',
  json_attributes_topic: STATE_TOPIC,
  availability_topic: AVAILABILITY_TOPIC,
  device: { identifiers: ['cccbib'], name: 'CCCBib', manufacturer: 'CCCBib' },
});
const PUSH_DELAY_MS = 250;
const WATCH_MS = 3000;
const MAX_LOGIN_LENGTH = 256;

let connection: MqttConnection | null = null;
let current = '';
let lastKey = '';

export function buildMqttState() {
  const now = readNowPlaying();
  const ts = Math.round(Date.now()) / 1000;
  if (!now) return { state: 'idle', ts };
  const { event } = now;
  return {
    state: now.playing && now.running ? 'playing' : 'paused',
    title: event.title,
    link: talkLink(event),
    conference: event.conference_title,
    speakers: event.persons,
    thumb: event.images.thumbUrl || event.images.posterUrl,
    position: Math.round(now.position * 1000) / 1000,
    duration: Math.round(now.duration || event.duration),
    rate: now.rate,
    ts,
  };
}

const stateKey = (state: { state: string; link?: string | null; rate?: number }) => [state.state, state.link, state.rate].join('|');

const publishState = () => {
  if (!connection) return;
  const state = buildMqttState();
  lastKey = stateKey(state);
  connection.publish(STATE_TOPIC, JSON.stringify(state), true);
};

function disconnect() {
  if (!connection) return;
  connection.publish(AVAILABILITY_TOPIC, 'offline', true);
  connection.close();
  connection = null;
}

function sync() {
  const url = getSetting('mqttUrl');
  const username = getSetting('mqttUser');
  const password = getSetting('mqttPassword');
  const wanted = getSetting('remoteControl') === 'on' && url ? [url, username, password].join('\n') : '';
  if (wanted === current) return;
  disconnect();
  current = wanted;
  if (!wanted) return;
  const link: MqttConnection = connectMqtt({
    url,
    clientId: CLIENT_ID,
    username: username || undefined,
    password: password || undefined,
    will: { topic: AVAILABILITY_TOPIC, payload: 'offline' },
    onRefused: () => {
      if (connection === link) current = '';
    },
    onConnect: () => {
      link.publish(AVAILABILITY_TOPIC, 'online', true);
      link.publish(DISCOVERY_TOPIC, DISCOVERY_CONFIG, true);
      publishState();
    },
  });
  connection = link;
}

const validLogin = (value: unknown) => typeof value === 'string' && value.length <= MAX_LOGIN_LENGTH;

export function setMqtt(url: unknown, username?: unknown, password?: unknown) {
  if (typeof url !== 'string') return false;
  if ((username !== undefined && !validLogin(username)) || (password !== undefined && (!validLogin(password) || !username))) return false;
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') || parsed.username || parsed.password || parsed.hash) return false;
  } catch (err) {
    return false;
  }
  setSetting('mqttUrl', url);
  setSetting('mqttUser', (username as string) || '');
  setSetting('mqttPassword', (password as string) || '');
  sync();
  return true;
}

export function clearMqtt() {
  setSetting('mqttUrl', '');
  setSetting('mqttUser', '');
  setSetting('mqttPassword', '');
  sync();
}

export function startMqtt() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopSettings = subscribeSettings((key) => {
    if (key === 'remoteControl') sync();
  });
  const stopPlaying = subscribeNowPlaying(() => {
    clearTimeout(timer);
    if (document.hidden) publishState();
    else timer = setTimeout(publishState, PUSH_DELAY_MS);
  });
  const watch = setInterval(() => {
    if (connection && stateKey(buildMqttState()) !== lastKey) publishState();
  }, WATCH_MS);
  sync();
  return () => {
    stopSettings();
    stopPlaying();
    clearInterval(watch);
    clearTimeout(timer);
    disconnect();
    current = '';
  };
}
