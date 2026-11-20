import { DurableObject } from 'cloudflare:workers';
import { applyRoomAction, createRoom, missingRoom, parseBody, roomPath, snapshot, type Room as RoomData } from '../server/room.ts';

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  WEB_ORIGINS: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const unsupported = () => json({ error: '지원하지 않는 요청이에요.' }, 405);

async function readBody(request: Request) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return parseBody(body + decoder.decode());
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
}

export class Room extends DurableObject<Env> {
  async fetch(request: Request) {
    const [, , , code, action] = new URL(request.url).pathname.split('/');

    if (action === 'create') {
      const created = await this.ctx.storage.transaction(async tx => {
        if (await tx.get('room')) return null;
        const created = createRoom(code);
        await tx.put('room', created.room);
        return created.session;
      });
      return created ? json(created, 201) : json({ error: '이미 사용 중인 방 코드예요.' }, 409);
    }

    if (action === 'live' || action === 'state') {
      if (request.method !== 'GET') return unsupported();
      const room = await this.ctx.storage.get<RoomData>('room');
      if (!room) return json(missingRoom, 404);
      if (action === 'state') return json({ room: snapshot(room) });
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return unsupported();

      const { 0: client, 1: server } = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify(snapshot(room)));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method !== 'POST') return unsupported();
    const body = await readBody(request);
    if (!body) return json({ error: '요청을 읽을 수 없어요.' }, 400);

    const update = await this.ctx.storage.transaction(async tx => {
      const room = await tx.get<RoomData>('room');
      if (!room) return null;
      const result = applyRoomAction(room, code, action, body);
      if (result.changed) await tx.put('room', room);
      return { result, room };
    });
    if (!update) return json(missingRoom, 404);

    if (update.result.changed) {
      const message = JSON.stringify(snapshot(update.room));
      for (const socket of this.ctx.getWebSockets()) {
        if (socket.readyState === WebSocket.OPEN) socket.send(message);
      }
    }
    return json(update.result.body, update.result.status);
  }
}

async function route(request: Request, env: Env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/health' && request.method === 'GET') return json({ online: true });
  if (url.pathname === '/api/rooms') {
    if (request.method !== 'POST') return unsupported();
    if (!await readBody(request)) return json({ error: '요청을 읽을 수 없어요.' }, 400);

    for (let attempt = 0; attempt < 3; attempt++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, '0')).join('');
      url.pathname = `/api/rooms/${code}/create`;
      const result = await env.ROOMS.getByName(code).fetch(url, { method: 'POST' });
      if (result.status !== 409) return result;
    }
    return json({ error: '방 코드를 만들지 못했어요. 다시 시도해 주세요.' }, 503);
  }

  const match = roomPath.exec(url.pathname);
  return match ? env.ROOMS.getByName(match[1]).fetch(request) : json({ error: '페이지를 찾을 수 없어요.' }, 404);
}

export default {
  async fetch(request: Request, env: Env) {
    const origin = request.headers.get('Origin');
    if (origin && !env.WEB_ORIGINS.split(',').includes(origin)) {
      return json({ error: '허용되지 않은 사이트 주소예요.' }, 403);
    }

    let response: Response;
    try {
      response = request.method === 'OPTIONS' ? new Response(null, {
        status: 204,
        headers: { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      }) : await route(request, env);
    } catch (error) {
      console.error(error);
      response = json({ error: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' }, 500);
    }
    if (response.status === 101) return response;

    const headers = new Headers(response.headers);
    headers.set('Vary', 'Origin');
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
