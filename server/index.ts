import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WebSocket, WebSocketServer } from 'ws';
import { normalizePlayerName } from '../shared/game.ts';
import { practiceAction, practicePath, type PracticeStorage } from './practice.ts';
import { applyRoomAction, createRoom, missingRoom, nameError, parseBody, returnToLobby, roomPath, snapshot, type Room } from './room.ts';

const databasePath = process.env.SET_DB_PATH || '.data/set-lab.sqlite';
if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS practice (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
const getPractice = db.prepare('SELECT value FROM practice WHERE key = ?');
const putPractice = db.prepare('INSERT INTO practice (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
const practiceStorage: PracticeStorage = {
  get(key) {
    const row = getPractice.get(key);
    return row ? JSON.parse(String(row.value)) : undefined;
  },
  put(key, value) { putPractice.run(key, JSON.stringify(value)); },
};
const allowedOrigins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', ...(process.env.SET_WEB_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean)]);
const channels = new Map<string, Set<WebSocket>>();
const sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 });
const pendingLobbyReturns = new Set<string>();

function scheduleLobbyReturn(code: string, deadline: number | undefined) {
  if (deadline === undefined || pendingLobbyReturns.has(code)) return;
  pendingLobbyReturns.add(code);
  setTimeout(() => {
    pendingLobbyReturns.delete(code);
    readRoom(code);
  }, Math.max(0, deadline - Date.now())).unref();
}

function readRoom(code: string): Room | null {
  const row = db.prepare('SELECT state FROM rooms WHERE code = ?').get(code);
  if (!row) return null;
  const room: Room = JSON.parse(String(row.state));
  if (returnToLobby(room)) saveRoom(code, room);
  else scheduleLobbyReturn(code, room.returnToLobbyAt);
  return room;
}

function saveRoom(code: string, room: Room) {
  db.prepare('INSERT INTO rooms (code, state) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET state = excluded.state')
    .run(code, JSON.stringify(room));
  scheduleLobbyReturn(code, room.returnToLobbyAt);
  const clients = channels.get(code);
  if (!clients?.size) return;
  const message = JSON.stringify(snapshot(room));
  for (const socket of clients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(message);
  }
}

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage) {
  const pieces: Buffer[] = [];
  let size = 0;
  for await (const piece of request as AsyncIterable<Buffer>) {
    size += piece.length;
    if (size > 4096) return null;
    pieces.push(piece);
  }
  return parseBody(Buffer.concat(pieces).toString('utf8'));
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Vary', 'Origin');
  if (origin && !allowedOrigins.has(origin)) return reply(response, 403, { error: '허용되지 않은 사이트 주소예요.' });
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }).end();
    return;
  }
  const path = request.url?.split('?')[0] ?? '';
  if (path === '/api/health' && request.method === 'GET') return reply(response, 200, { online: true });
  const route = roomPath.exec(path);
  const practice = practicePath.exec(path);
  if (!route && !practice && path !== '/api/rooms') return reply(response, 404, { error: '페이지를 찾을 수 없어요.' });

  try {
    if (practice) {
      const method = request.method ?? '';
      const body = method === 'POST' ? await readBody(request) : null;
      let result: ReturnType<typeof practiceAction>;
      db.exec('BEGIN');
      try {
        result = practiceAction(practice, method, body, practiceStorage);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return reply(response, result.status, result.body);
    }
    if (route?.[2] === 'state' && request.method === 'GET') {
      const room = readRoom(route[1]);
      return room ? reply(response, 200, { room: snapshot(room) }) : reply(response, 404, missingRoom);
    }
    if (request.method !== 'POST' || ['state', 'live'].includes(route?.[2] ?? '')) return reply(response, 405, { error: '지원하지 않는 요청이에요.' });
    const body = await readBody(request);
    if (!body) return reply(response, 400, { error: '요청을 읽을 수 없어요.' });
    if (!route) {
      const name = normalizePlayerName(body.name);
      if (body.name !== undefined && !name) return reply(response, 400, { error: nameError });
      let code: string;
      do { code = randomBytes(6).toString('hex'); } while (readRoom(code));
      const created = createRoom(code, name ?? undefined);
      saveRoom(code, created.room);
      return reply(response, 201, created.session);
    }

    const [, code, action] = route;
    const room = readRoom(code);
    if (!room) return reply(response, 404, missingRoom);
    const result = applyRoomAction(room, code, action, body);
    if (result.changed) saveRoom(code, room);
    return reply(response, result.status, result.body);
  } catch (error) {
    console.error(error);
    return reply(response, 500, { error: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' });
  }
});

server.on('upgrade', (request, socket, head) => {
  const route = roomPath.exec(request.url ?? '');
  const origin = request.headers.origin;
  if (route?.[2] !== 'live' || (origin && !allowedOrigins.has(origin))) return socket.destroy();
  const code = route[1];
  const room = readRoom(code);
  if (!room) return socket.destroy();

  sockets.handleUpgrade(request, socket, head, client => {
    const clients = channels.get(code) ?? new Set<WebSocket>();
    channels.set(code, clients);
    clients.add(client);
    client.on('error', () => client.terminate());
    client.on('close', () => {
      clients.delete(client);
      if (!clients.size) channels.delete(code);
    });
    client.send(JSON.stringify(snapshot(room)));
  });
});

const heartbeat = setInterval(() => {
  for (const clients of channels.values()) {
    for (const client of clients) if (client.readyState === WebSocket.OPEN) client.ping();
  }
}, 25_000);
heartbeat.unref();
server.listen(8787, '127.0.0.1', () => console.log('SET LAB API • http://127.0.0.1:8787'));
