export class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  binaryType = '';
  sent: Uint8Array[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string, public protocols?: string) { FakeSocket.instances.push(this); }
  send(data: Uint8Array) { this.sent.push(data); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(...bytes: number[]) { this.onmessage?.({ data: new Uint8Array(bytes).buffer }); }
  accept(code = 0) { this.receive(0x20, 2, 0, code); }
  drop() { this.readyState = 3; this.onclose?.(); }
}

const readLength = (bytes: Uint8Array) => {
  let length = 0;
  let multiplier = 1;
  let index = 1;
  let digit = 0;
  do {
    digit = bytes[index++];
    length += (digit & 127) * multiplier;
    multiplier *= 128;
  } while (digit & 128);
  return { length, start: index };
};

export function readText(bytes: Uint8Array, offset: number): [string, number] {
  const length = (bytes[offset] << 8) | bytes[offset + 1];
  return [new TextDecoder().decode(bytes.subarray(offset + 2, offset + 2 + length)), offset + 2 + length];
}

export function decode(bytes: Uint8Array) {
  const { length, start } = readLength(bytes);
  return { header: bytes[0], length, body: bytes.subarray(start, start + length), total: start + length };
}

export function decodeConnect(bytes: Uint8Array) {
  const { header, body, total } = decode(bytes);
  const [protocol, afterName] = readText(body, 0);
  const flags = body[afterName + 1];
  const keepAlive = (body[afterName + 2] << 8) | body[afterName + 3];
  const [clientId, afterId] = readText(body, afterName + 4);
  const [willTopic, afterTopic] = readText(body, afterId);
  const [willPayload, afterPayload] = readText(body, afterTopic);
  const [username, afterUser] = flags & 0x80 ? readText(body, afterPayload) : [undefined, afterPayload];
  const [password] = flags & 0x40 ? readText(body, afterUser) : [undefined];
  return { header, level: body[afterName], flags, keepAlive, protocol, clientId, willTopic, willPayload, username, password, total, size: bytes.length };
}

export function decodePublish(bytes: Uint8Array) {
  const { header, body } = decode(bytes);
  const [topic, offset] = readText(body, 0);
  return { retain: Boolean(header & 1), type: header >> 4, topic, payload: new TextDecoder().decode(body.subarray(offset)) };
}

export const published = (socket: FakeSocket) => socket.sent.filter((bytes) => bytes[0] >> 4 === 3).map(decodePublish);
