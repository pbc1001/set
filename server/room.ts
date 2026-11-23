import { MAX_ROOM_PLAYERS, createGame, isSet, replaceSet, type Game, type GameEvent, type Player, type RoomSession, type RoomState } from '../shared/game.ts';

type Member = Player & { token: string };
const RESULTS_DURATION_MS = 4_000;

export interface Room {
  version: number;
  boardVersion: number;
  players: Member[];
  game: Game | null;
  event: GameEvent;
  returnToLobbyAt?: number;
}

export function returnToLobby(room: Room) {
  if (!room.game?.finished || (room.returnToLobbyAt ?? 0) > Date.now()) return false;

  room.game = null;
  room.event = { added: 0 };
  delete room.returnToLobbyAt;
  room.boardVersion++;
  room.version++;
  return true;
}

export function snapshot(room: Room): RoomState {
  const { game, event } = room;
  return {
    version: room.version,
    boardVersion: room.boardVersion,
    players: room.players.map(({ id, score }) => ({ id, score })),
    play: game && { slots: game.slots, found: game.found, finished: game.finished, cardsLeft: game.deck.length, event },
  };
}

function addPlayer(room: Room) {
  const player = { id: room.players.length + 1, token: crypto.randomUUID(), score: 0 };
  room.players.push(player);
  return player;
}

function session(code: string, room: Room, player: Member): RoomSession {
  return { code, id: player.id, token: player.token, room: snapshot(room) };
}

export function createRoom(code: string) {
  const room: Room = { version: 0, boardVersion: 0, players: [], game: null, event: { added: 0 } };
  return { room, session: session(code, room, addPlayer(room)) };
}

export const roomPath = /^\/api\/rooms\/([a-f0-9]{12})\/(join|start|reset|claim|state|live)$/;
export const missingRoom = { error: '이 코드의 방을 찾을 수 없어요.' };

export function parseBody(text: string) {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function applyRoomAction(room: Room, code: string, action: string, body: Record<string, unknown>) {
  const player = room.players.find(member => member.token === body.token);
  const error = (status: number, message: string, withRoom = false) => ({
    status, body: { error: message, ...(withRoom ? { room: snapshot(room) } : {}) }, changed: false,
  });

  if (action === 'join') {
    if (player) return { status: 200, body: session(code, room, player), changed: false };
    if (room.players.length >= MAX_ROOM_PLAYERS) return error(409, `방이 가득 찼어요. 최대 ${MAX_ROOM_PLAYERS}명까지 입장할 수 있어요.`);
    const guest = addPlayer(room);
    room.version++;
    return { status: 200, body: session(code, room, guest), changed: true };
  }

  if (!player) return error(403, '방에 다시 입장해 주세요.');
  if (body.boardVersion !== room.boardVersion) return error(409, '보드가 바뀌었어요. 새 조합을 찾아보세요.', true);
  if ((action === 'start') !== !room.game) {
    return error(409, room.game ? '이미 게임이 시작됐어요.' : '아직 게임을 시작하지 않았어요.', true);
  }
  if (room.game?.finished) return error(409, '게임이 끝났어요. 잠시 후 대기실로 돌아가요.', true);

  if (action === 'start' || action === 'reset') {
    if (player.id !== 1) return error(403, '방장만 게임을 시작할 수 있어요.');
    Object.assign(room, createGame());
    for (const member of room.players) member.score = 0;
  } else {
    const game = room.game!;
    const { cards } = body;
    if (!Array.isArray(cards) || cards.length !== 3 || new Set(cards).size !== 3 || !cards.every(Number.isInteger)) {
      return error(400, '서로 다른 카드 세 장을 선택하세요.');
    }
    const positions = cards.map(id => game.slots.findIndex(card => card?.id === id));
    const [first, second, third] = positions.map(position => game.slots[position]);
    if (!first || !second || !third) return error(409, '카드가 바뀌었어요.', true);
    if (!isSet(first, second, third)) return error(422, 'SET이 아니에요. 다른 세 장을 골라 보세요.');
    room.event = { added: replaceSet(game, positions), player: player.id, positions };
    player.score++;
    if (game.finished) room.returnToLobbyAt = Date.now() + RESULTS_DURATION_MS;
  }

  room.boardVersion++;
  room.version++;
  return { status: 200, body: { room: snapshot(room) }, changed: true };
}
