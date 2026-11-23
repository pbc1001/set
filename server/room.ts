import { MAX_ROOM_PLAYERS, boardView, createGame, isSet, replaceSet, type Game, type GameEvent, type Player, type RoomSession, type RoomState } from '../shared/game.ts';

type Member = Player & { token: string };
const RESULTS_DURATION_MS = 4_000;

export interface Room {
  version: number;
  boardVersion: number;
  players: Member[];
  game: Game | null;
  event: GameEvent;
  returnToLobbyAt?: number;
  roundResult?: Player[];
}

function saveRoundResult(room: Room) {
  room.roundResult = room.players.map(({ id, score }) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id - b.id);
}

function clearGame(room: Room) {
  room.game = null;
  room.event = { added: 0 };
  delete room.returnToLobbyAt;
  room.boardVersion++;
}

export function returnToLobby(room: Room) {
  if (!room.game?.finished || (room.returnToLobbyAt ?? 0) > Date.now()) return false;

  if (!room.roundResult) saveRoundResult(room);
  clearGame(room);
  room.version++;
  return true;
}

export function snapshot(room: Room): RoomState {
  const { game, event } = room;
  return {
    version: room.version,
    boardVersion: room.boardVersion,
    players: room.players.map(({ id, score }) => ({ id, score })),
    play: game && boardView(game, event),
    roundResult: room.roundResult,
  };
}

function addPlayer(room: Room) {
  let id = 1;
  while (room.players.some(member => member.id === id)) id++;
  const player = { id, token: crypto.randomUUID(), score: 0 };
  room.players.push(player);
  return player;
}

function session(code: string, room: Room, player?: Member): RoomSession {
  const state = snapshot(room);
  return player ? { code, room: state, id: player.id, token: player.token }
    : { code, room: state, id: null, token: null };
}

export function createRoom(code: string) {
  const room: Room = { version: 0, boardVersion: 0, players: [], game: null, event: { added: 0 } };
  return { room, session: session(code, room, addPlayer(room)) };
}

export const roomPath = /^\/api\/rooms\/([a-f0-9]{12})\/(join|start|reset|claim|leave|state|live)$/;
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
    if (room.game || room.players.length >= MAX_ROOM_PLAYERS || body.spectate === true) {
      return { status: 200, body: session(code, room), changed: false };
    }
    const guest = addPlayer(room);
    room.version++;
    return { status: 200, body: session(code, room, guest), changed: true };
  }

  if (action === 'leave') {
    if (player) {
      room.players.splice(room.players.indexOf(player), 1);
      if (!room.players.length && room.game) clearGame(room);
      room.version++;
    }
    return { status: 200, body: { room: snapshot(room) }, changed: Boolean(player) };
  }

  if (!player) return error(403, '플레이어로 참가해야 게임을 조작할 수 있어요.');
  if (body.boardVersion !== room.boardVersion) return error(409, '보드가 바뀌었어요. 새 조합을 찾아보세요.', true);
  if ((action === 'start') !== !room.game) {
    return error(409, room.game ? '이미 게임이 시작됐어요.' : '아직 게임을 시작하지 않았어요.', true);
  }
  if (room.game?.finished) return error(409, '게임이 끝났어요. 잠시 후 대기실로 돌아가요.', true);

  if (action === 'start' || action === 'reset') {
    if (player.id !== room.players[0].id) return error(403, '방장만 게임을 시작할 수 있어요.');
    Object.assign(room, createGame());
    delete room.roundResult;
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
    if (game.finished) {
      saveRoundResult(room);
      room.returnToLobbyAt = Date.now() + RESULTS_DURATION_MS;
    }
  }

  room.boardVersion++;
  room.version++;
  return { status: 200, body: { room: snapshot(room) }, changed: true };
}
