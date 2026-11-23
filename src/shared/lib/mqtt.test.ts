import type { Mock } from 'vitest';
import { beforeEach, expect, test, vi } from 'vitest';
import { decode, decodeConnect, FakeSocket, published } from '../../../tests/mqtt';
import { connectMqtt } from './mqtt';

const WILL = { topic: 'cccbib/availability', payload: 'offline' };
let onConnect: Mock<() => void>;

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  onConnect = vi.fn<() => void>();
  vi.stubGlobal('WebSocket', FakeSocket);
});

const connect = (extra = {}) => connectMqtt({ url: 'ws://broker:9001', clientId: 'cccbib', will: WILL, onConnect, ...extra });
const last = () => FakeSocket.instances[FakeSocket.instances.length - 1];
const ready = (extra = {}) => {
  const connection = connect(extra);
  last().open();
  last().accept();
  return connection;
};

test('it opens the mqtt subprotocol and says hello with a clean session, the will and the login', () => {
  connect({ username: 'user', password: 'secret' });
  const socket = last();
  expect(socket.url).toBe('ws://broker:9001');
  expect(socket.protocols).toBe('mqtt');
  expect(socket.binaryType).toBe('arraybuffer');
  expect(socket.sent).toHaveLength(0);
  socket.open();
  expect(decodeConnect(socket.sent[0])).toMatchObject({
    header: 0x10, protocol: 'MQTT', level: 4, flags: 0xe6, keepAlive: 60, clientId: 'cccbib', willTopic: 'cccbib/availability', willPayload: 'offline', username: 'user', password: 'secret',
  });
});

test('without a login the packet carries neither user name nor password, and a password needs a user name', () => {
  connect();
  last().open();
  expect(decodeConnect(last().sent[0])).toMatchObject({ flags: 0x26, username: undefined, password: undefined });
  connect({ password: 'lonely' });
  last().open();
  expect(decodeConnect(last().sent[0])).toMatchObject({ flags: 0x26, password: undefined });
});

test('after the acknowledgement it reports ready, publishes retained messages and keeps the connection alive', () => {
  const connection = connect();
  last().open();
  connection.publish('before', 'dropped', true);
  expect(last().sent).toHaveLength(1);
  last().accept();
  expect(onConnect).toHaveBeenCalledTimes(1);
  connection.publish('cccbib/state', '{"state":"idle"}', true);
  connection.publish('plain/topic', 'value');
  expect(published(last())).toEqual([
    { retain: true, type: 3, topic: 'cccbib/state', payload: '{"state":"idle"}' },
    { retain: false, type: 3, topic: 'plain/topic', payload: 'value' },
  ]);
  vi.advanceTimersByTime(30000);
  expect([...last().sent[last().sent.length - 1]]).toEqual([0xc0, 0]);
  for (let tick = 0; tick < 2; tick += 1) {
    last().receive(0xd0, 0);
    vi.advanceTimersByTime(30000);
  }
  expect(last().sent.filter((bytes) => bytes[0] === 0xc0)).toHaveLength(3);
  expect(FakeSocket.instances).toHaveLength(1);
});

test('a broker that stops answering the pings is given up on at the second ping and tried again, one that answers is not', () => {
  const connection = ready();
  const socket = last();
  vi.advanceTimersByTime(30000);
  expect(socket.sent.filter((bytes) => bytes[0] === 0xc0)).toHaveLength(1);
  vi.advanceTimersByTime(29999);
  expect(socket.readyState).toBe(1);
  vi.advanceTimersByTime(1);
  expect(socket.readyState).toBe(3);
  expect(socket.sent.filter((bytes) => bytes[0] === 0xc0)).toHaveLength(1);
  connection.publish('t', 'x');
  expect(published(socket)).toHaveLength(0);
  vi.advanceTimersByTime(2000);
  expect(FakeSocket.instances).toHaveLength(2);
  last().open();
  last().accept();
  expect(onConnect).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(30000);
  last().receive(0xd0, 0);
  vi.advanceTimersByTime(30000);
  expect(last().readyState).toBe(1);
  expect(FakeSocket.instances).toHaveLength(2);
});

test('long and non ASCII payloads get a correct remaining length and UTF-8', () => {
  const connection = ready();
  const long = 'x'.repeat(300);
  connection.publish('t', long, true);
  connection.publish('t', 'Grüße ☃', false);
  const [first, second] = last().sent.slice(1);
  expect(decode(first)).toMatchObject({ header: 0x31, length: 2 + 1 + 300, total: first.length });
  expect(first[1]).toBe(0xaf);
  expect(first[2]).toBe(0x02);
  expect(published(last())[0].payload).toBe(long);
  expect(published(last())[1].payload).toBe('Grüße ☃');
  expect(decode(second).total).toBe(second.length);
});

test('an acknowledgement split over two frames or followed by another packet is understood', () => {
  connect();
  last().open();
  last().receive(0x20, 2);
  expect(onConnect).not.toHaveBeenCalled();
  last().receive(0, 0);
  expect(onConnect).toHaveBeenCalledTimes(1);
  last().receive(0xd0, 0, 0xd0, 0);
  last().receive(0x30, 0xff);
  expect(onConnect).toHaveBeenCalledTimes(1);
  expect(FakeSocket.instances).toHaveLength(1);
});

test('a packet that declares more than 64 bytes is refused before its body arrives and the connection is tried again', () => {
  ready();
  last().receive(0x30, 64);
  expect(FakeSocket.instances).toHaveLength(1);
  last().receive(...new Array(64).fill(0));
  expect(FakeSocket.instances).toHaveLength(1);
  last().receive(0x30, 65);
  expect(last().readyState).toBe(3);
  vi.advanceTimersByTime(2000);
  expect(FakeSocket.instances).toHaveLength(2);
  expect(onConnect).toHaveBeenCalledTimes(1);
});

test('a length field of more than four bytes is refused, a shorter one that is still arriving is waited for', () => {
  ready();
  last().receive(0x30, 0x80, 0x80, 0x80);
  expect(FakeSocket.instances).toHaveLength(1);
  last().receive(0x80);
  expect(last().readyState).toBe(3);
  vi.advanceTimersByTime(2000);
  expect(FakeSocket.instances).toHaveLength(2);
});

test('refusals for the login stop for good and an unavailable server is tried again', () => {
  for (const code of [1, 2, 4, 5]) {
    FakeSocket.instances = [];
    const connection = connect();
    last().open();
    last().accept(code);
    vi.advanceTimersByTime(600000);
    expect(FakeSocket.instances, `code ${code}`).toHaveLength(1);
    expect(onConnect).not.toHaveBeenCalled();
    connection.publish('t', 'x');
    connection.close();
  }
  FakeSocket.instances = [];
  connect();
  last().open();
  last().accept(3);
  vi.advanceTimersByTime(2000);
  expect(FakeSocket.instances).toHaveLength(2);
});

test('a refused login is reported once and an unavailable server is not', () => {
  const onRefused = vi.fn();
  connect({ onRefused });
  last().open();
  last().accept(3);
  expect(onRefused).not.toHaveBeenCalled();
  vi.advanceTimersByTime(2000);
  last().open();
  last().accept(5);
  expect(onRefused).toHaveBeenCalledTimes(1);
});

test('a lost connection is retried after 2, 4, 8 up to 60 seconds and an acknowledgement starts the backoff again', () => {
  connect();
  for (const seconds of [2, 4, 8, 16, 32, 60, 60]) {
    const before = FakeSocket.instances.length;
    last().drop();
    vi.advanceTimersByTime(seconds * 1000 - 1);
    expect(FakeSocket.instances, `${seconds}`).toHaveLength(before);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances, `${seconds}`).toHaveLength(before + 1);
  }
  last().open();
  last().accept();
  last().drop();
  vi.advanceTimersByTime(2000);
  expect(FakeSocket.instances).toHaveLength(9);
});

test('a broker that never answers is given up on after 10 seconds and tried again', () => {
  connect();
  last().open();
  vi.advanceTimersByTime(9999);
  expect(last().readyState).toBe(1);
  vi.advanceTimersByTime(1);
  expect(FakeSocket.instances[0].readyState).toBe(3);
  vi.advanceTimersByTime(2000);
  expect(FakeSocket.instances).toHaveLength(2);
});

test('late events of a socket that has been given up on change nothing', () => {
  connect();
  const old = last();
  old.open();
  vi.advanceTimersByTime(10000);
  vi.advanceTimersByTime(2000);
  const fresh = last();
  expect(fresh).not.toBe(old);
  old.open();
  old.accept();
  old.drop();
  expect(onConnect).not.toHaveBeenCalled();
  expect(old.sent).toHaveLength(1);
  expect(FakeSocket.instances).toHaveLength(2);
});

test('an address that cannot be opened is retried', () => {
  vi.stubGlobal('WebSocket', class { constructor() { throw new Error('bad address'); } });
  const spy = vi.spyOn(globalThis, 'setTimeout');
  connect();
  expect(spy).toHaveBeenCalledWith(expect.any(Function), 2000);
});

test('closing says goodbye cleanly, stops the retries and ignores late frames', () => {
  const connection = ready();
  const socket = last();
  connection.close();
  expect([...socket.sent[socket.sent.length - 1]]).toEqual([0xe0, 0]);
  expect(socket.readyState).toBe(3);
  socket.drop();
  socket.receive(0x20, 2, 0, 0);
  vi.advanceTimersByTime(600000);
  expect(FakeSocket.instances).toHaveLength(1);
  expect(onConnect).toHaveBeenCalledTimes(1);
  connection.publish('t', 'x');
  expect(socket.sent.filter((bytes) => bytes[0] >> 4 === 3)).toHaveLength(0);
});

test('closing while the retry is waiting cancels it', () => {
  const connection = connect();
  last().drop();
  connection.close();
  vi.advanceTimersByTime(600000);
  expect(FakeSocket.instances).toHaveLength(1);
});
