import { beforeEach, expect, test, vi } from 'vitest';
import { talk } from '../../../tests/fixtures';
import { FakeSocket, published } from '../../../tests/mqtt';
import { getSetting, setSetting } from '@/shared/config';
import { notifyNowPlaying, setNowPlayingReader } from '@/widgets/player/model/nowPlaying';
import { buildMqttState, clearMqtt, setMqtt, startMqtt } from './mqtt';

const URL = 'ws://192.0.2.10:9001';
const playing = { event: talk(), playing: true, running: true, position: 61.6, duration: 600, rate: 1.5 };
const last = () => FakeSocket.instances[FakeSocket.instances.length - 1];
const messages = () => published(last()).map(({ topic, payload, retain }) => ({ topic, payload, retain }));
let stop: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  setSetting('remoteControl', 'on');
  for (const key of ['mqttUrl', 'mqttUser', 'mqttPassword'] as const) setSetting(key, '');
  setNowPlayingReader(null);
});

const connected = () => {
  stop = startMqtt();
  expect(setMqtt(URL, 'user', 'secret')).toBe(true);
  last().open();
  last().accept();
};

test('only ws and wss broker addresses with a short login and a user name for the password are accepted', () => {
  stop = startMqtt();
  for (const args of [['http://broker:9001'], ['ws://user:pass@broker:9001'], ['ws://broker:9001#x'], ['nonsense'], [null], [5], [URL, 5], [URL, 'u'.repeat(300)], [URL, undefined, 'password without user'], [URL, 'user', 'p'.repeat(300)]] as unknown[][]) {
    expect(setMqtt(...(args as [unknown])), JSON.stringify(args)).toBe(false);
  }
  expect(getSetting('mqttUrl')).toBe('');
  expect(FakeSocket.instances).toHaveLength(0);
  expect(setMqtt('wss://broker.example/mqtt')).toBe(true);
  expect(last().url).toBe('wss://broker.example/mqtt');
  stop();
});

test('the state says idle without a talk and describes the talk with the position in milliseconds, the speed and the time while one plays', () => {
  vi.setSystemTime(new Date('2026-11-01T10:00:00.400Z'));
  const ts = 1793527200.4;
  expect(buildMqttState()).toEqual({ state: 'idle', ts });
  setNowPlayingReader(() => playing);
  expect(buildMqttState()).toEqual({
    state: 'playing', title: 'Test talk', link: 'https://media.ccc.de/v/talk', conference: 'Test conference', speakers: ['Speaker'],
    thumb: 'https://static.media.ccc.de/thumb.svg', position: 61.6, duration: 600, rate: 1.5, ts,
  });
  setNowPlayingReader(() => ({ ...playing, playing: false, event: talk({ slug: undefined }) }));
  expect(buildMqttState()).toMatchObject({ state: 'paused', link: null });
  setNowPlayingReader(() => ({ ...playing, running: false }));
  expect(buildMqttState()).toMatchObject({ state: 'paused' });
});

test('on connect it says online, announces the sensor to Home Assistant and sends the state, all retained', () => {
  setNowPlayingReader(() => playing);
  connected();
  const sent = messages();
  expect(sent.map((message) => message.topic)).toEqual(['cccbib/availability', 'homeassistant/sensor/cccbib/config', 'cccbib/state']);
  expect(sent.every((message) => message.retain)).toBe(true);
  expect(sent[0].payload).toBe('online');
  expect(JSON.parse(sent[1].payload)).toMatchObject({
    unique_id: 'cccbib', state_topic: 'cccbib/state', json_attributes_topic: 'cccbib/state', availability_topic: 'cccbib/availability', value_template: '{{ value_json.state }}',
  });
  expect(JSON.parse(sent[2].payload)).toMatchObject({ state: 'playing', title: 'Test talk', position: 61.6 });
  stop();
});

test('changes of the playing talk are published once after a short pause', async () => {
  connected();
  const before = published(last()).length;
  setNowPlayingReader(() => playing);
  notifyNowPlaying();
  notifyNowPlaying();
  await vi.advanceTimersByTimeAsync(249);
  expect(published(last())).toHaveLength(before);
  await vi.advanceTimersByTimeAsync(1);
  expect(messages()[before]).toMatchObject({ topic: 'cccbib/state', retain: true });
  expect(JSON.parse(messages()[before].payload)).toMatchObject({ state: 'playing' });
  setNowPlayingReader(() => ({ ...playing, playing: false }));
  await vi.advanceTimersByTimeAsync(250);
  expect(JSON.parse(messages()[before + 1].payload).state).toBe('paused');
  setNowPlayingReader(null);
  await vi.advanceTimersByTimeAsync(250);
  expect(JSON.parse(messages()[before + 2].payload)).toMatchObject({ state: 'idle' });
  stop();
});

test('a hidden page publishes at once and a change nobody announced is found within seconds', async () => {
  connected();
  const before = published(last()).length;
  let running = true;
  setNowPlayingReader(() => ({ ...playing, running }));
  await vi.advanceTimersByTimeAsync(250);
  expect(JSON.parse(messages()[before].payload)).toMatchObject({ state: 'playing' });
  running = false;
  await vi.advanceTimersByTimeAsync(3000);
  expect(JSON.parse(messages()[before + 1].payload)).toMatchObject({ state: 'paused' });
  await vi.advanceTimersByTimeAsync(6000);
  expect(published(last())).toHaveLength(before + 2);
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  running = true;
  notifyNowPlaying();
  expect(JSON.parse(messages()[before + 2].payload)).toMatchObject({ state: 'playing' });
  hidden.mockRestore();
  stop();
});

test('turning Remote Control off says offline and disconnects, turning it on connects again', () => {
  connected();
  const first = last();
  setSetting('remoteControl', 'off');
  expect(messages().slice(-1)).toEqual([{ topic: 'cccbib/availability', payload: 'offline', retain: true }]);
  expect([...first.sent[first.sent.length - 1]]).toEqual([0xe0, 0]);
  vi.advanceTimersByTime(600000);
  expect(FakeSocket.instances).toHaveLength(1);
  setSetting('remoteControl', 'on');
  expect(FakeSocket.instances).toHaveLength(2);
  stop();
});

test('a new address replaces the connection, clearing forgets it and nothing connects without one', () => {
  stop = startMqtt();
  expect(FakeSocket.instances).toHaveLength(0);
  setMqtt(URL, 'user', 'secret');
  const first = last();
  first.open();
  first.accept();
  setMqtt(URL, 'user', 'other');
  expect(first.readyState).toBe(3);
  expect(FakeSocket.instances).toHaveLength(2);
  setMqtt(URL, 'user', 'other');
  expect(FakeSocket.instances).toHaveLength(2);
  const second = last();
  second.open();
  second.accept();
  clearMqtt();
  expect(second.readyState).toBe(3);
  expect(getSetting('mqttUrl')).toBe('');
  expect(getSetting('mqttUser')).toBe('');
  expect(getSetting('mqttPassword')).toBe('');
  notifyNowPlaying();
  vi.advanceTimersByTime(600000);
  expect(FakeSocket.instances).toHaveLength(2);
  stop();
});

test('the same address sent again connects again after the login was refused', () => {
  stop = startMqtt();
  setMqtt(URL, 'user', 'secret');
  last().open();
  last().accept(5);
  vi.advanceTimersByTime(600000);
  expect(FakeSocket.instances).toHaveLength(1);
  expect(setMqtt(URL, 'user', 'secret')).toBe(true);
  expect(FakeSocket.instances).toHaveLength(2);
  last().open();
  last().accept();
  expect(messages()[0]).toMatchObject({ topic: 'cccbib/availability', payload: 'online' });
  expect(setMqtt(URL, 'user', 'secret')).toBe(true);
  expect(FakeSocket.instances).toHaveLength(2);
  stop();
});

test('stopping closes the connection cleanly', () => {
  connected();
  const socket = last();
  stop();
  expect(socket.readyState).toBe(3);
  expect(messages().slice(-1)[0]).toMatchObject({ topic: 'cccbib/availability', payload: 'offline' });
});
