export interface MqttOptions {
  url: string;
  clientId: string;
  username?: string;
  password?: string;
  will: { topic: string; payload: string };
  onConnect: () => void;
  onRefused?: () => void;
}

export interface MqttConnection {
  publish: (topic: string, payload: string, retain?: boolean) => void;
  close: () => void;
}

const KEEPALIVE_S = 60;
const PING_MS = 30000;
const CONNECT_TIMEOUT_MS = 10000;
const MAX_BACKOFF_S = 60;
const MAX_PACKET = 64;
const LENGTH_FIELD = 5;
const SOCKET_OPEN = 1;
const SERVER_UNAVAILABLE = 3;
const PINGRESP = 13;
const PINGREQ = new Uint8Array([0xc0, 0]);
const DISCONNECT = new Uint8Array([0xe0, 0]);
const encoder = new TextEncoder();

const text = (value: string) => {
  const bytes = Array.from(encoder.encode(value));
  return [bytes.length >> 8, bytes.length & 255, ...bytes];
};

const lengthBytes = (value: number) => {
  const bytes: number[] = [];
  let rest = value;
  do {
    let digit = rest % 128;
    rest = Math.floor(rest / 128);
    if (rest > 0) digit |= 128;
    bytes.push(digit);
  } while (rest > 0);
  return bytes;
};

const packet = (header: number, body: number[]) => new Uint8Array([header, ...lengthBytes(body.length), ...body]);

function connectPacket({ clientId, username, password, will }: MqttOptions) {
  const flags = 0x02 | 0x04 | 0x20 | (username ? 0x80 : 0) | (username && password ? 0x40 : 0);
  return packet(0x10, [
    0, 4, 77, 81, 84, 84, 4, flags, KEEPALIVE_S >> 8, KEEPALIVE_S & 255,
    ...text(clientId), ...text(will.topic), ...text(will.payload),
    ...(username ? text(username) : []), ...(username && password ? text(password) : []),
  ]);
}

const publishPacket = (topic: string, payload: string, retain: boolean) => packet(retain ? 0x31 : 0x30, [...text(topic), ...Array.from(encoder.encode(payload))]);

export function connectMqtt(options: MqttOptions): MqttConnection {
  let socket: WebSocket | null = null;
  let ready = false;
  let closed = false;
  let attempt = 0;
  let pending = new Uint8Array(0);
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let awaitingPong = false;

  const send = (bytes: Uint8Array<ArrayBuffer>) => {
    if (socket && socket.readyState === SOCKET_OPEN) socket.send(bytes);
  };

  const drop = () => {
    clearTimeout(connectTimer);
    clearInterval(pingTimer);
    ready = false;
    awaitingPong = false;
    const old = socket;
    socket = null;
    if (old) {
      try { old.close(); } catch (err) { /* already closed */ }
    }
  };

  const retry = () => {
    if (closed) return;
    const delay = Math.min(2 ** (attempt + 1), MAX_BACKOFF_S) * 1000;
    attempt += 1;
    retryTimer = setTimeout(open, delay);
  };

  const handle = (type: number, body: Uint8Array) => {
    if (type === PINGRESP) awaitingPong = false;
    if (type !== 2 || body.length < 2) return;
    if (body[1] === 0) {
      ready = true;
      attempt = 0;
      clearTimeout(connectTimer);
      pingTimer = setInterval(() => {
        if (awaitingPong) {
          drop();
          retry();
          return;
        }
        awaitingPong = true;
        send(PINGREQ);
      }, PING_MS);
      options.onConnect();
    } else {
      drop();
      if (body[1] === SERVER_UNAVAILABLE) retry();
      else {
        closed = true;
        if (options.onRefused) options.onRefused();
      }
    }
  };

  const receive = (data: unknown) => {
    if (!(data instanceof ArrayBuffer)) return;
    const incoming = new Uint8Array(data);
    const bytes = new Uint8Array(pending.length + incoming.length);
    bytes.set(pending);
    bytes.set(incoming, pending.length);
    let offset = 0;
    while (offset + 2 <= bytes.length) {
      let length = 0;
      let multiplier = 1;
      let index = offset + 1;
      let digit = 0;
      do {
        if (index >= bytes.length) break;
        digit = bytes[index++];
        length += (digit & 127) * multiplier;
        multiplier *= 128;
      } while (digit & 128 && index - offset < LENGTH_FIELD);
      if (digit & 128 ? index - offset >= LENGTH_FIELD : length > MAX_PACKET) {
        drop();
        retry();
        return;
      }
      if (digit & 128 || index + length > bytes.length) break;
      handle(bytes[offset] >> 4, bytes.subarray(index, index + length));
      offset = index + length;
      if (!socket) return;
    }
    pending = bytes.slice(offset);
  };

  function open() {
    let ws: WebSocket;
    try {
      ws = new WebSocket(options.url, 'mqtt');
    } catch (err) {
      retry();
      return;
    }
    ws.binaryType = 'arraybuffer';
    socket = ws;
    pending = new Uint8Array(0);
    connectTimer = setTimeout(() => {
      if (socket !== ws) return;
      drop();
      retry();
    }, CONNECT_TIMEOUT_MS);
    ws.onopen = () => {
      if (socket === ws) send(connectPacket(options));
    };
    ws.onmessage = (event) => {
      if (socket === ws) receive(event.data);
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      drop();
      retry();
    };
  }

  open();

  return {
    publish: (topic, payload, retain = false) => {
      if (ready) send(publishPacket(topic, payload, retain));
    },
    close: () => {
      closed = true;
      clearTimeout(retryTimer);
      if (ready) send(DISCONNECT);
      drop();
    },
  };
}
