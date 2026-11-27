import { MAX_ROOM_PLAYERS, PLAYER_NAME_LIMIT, RACE_TARGET, boardView, createGame, isSet, normalizePlayerName, playerName, replaceEndlessSet, replaceSet, type Game, type GameEvent, type Player, type RoomMode, type RoomSession, type RoomState } from '../shared/game.ts';

type Member = Player & { token: string; selected?: number[] };
const RESULTS_DURATION_MS = 4_000;

export interface Room {
  version: number;
  boardVersion: number;
  players: Member[];
  game: Game | null;
  mode?: RoomMode;
  event: GameEvent;
  returnToLobbyAt?: number;
  roundResult?: Player[];
  departed?: Member[];
}

function publicPlayer({ id, score, name }: Member): Player { return name ? { id, score, name } : { id, score }; }

function saveRoundResult(room: Room) {
  room.roundResult = room.players.map(publicPlayer)
    .sort((a, b) => b.score - a.score || a.id - b.id);
}

function clearGame(room: Room) {
  room.game = null;
  room.event = { added: 0 };
  delete room.returnToLobbyAt;
  delete room.departed;
  for (const player of room.players) delete player.selected;
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
    players: room.players.map(publicPlayer),
    selections: room.players.flatMap(({ id, selected }) => selected?.length ? [{ player: id, cards: selected }] : []),
    play: game && boardView(game, event),
    mode: room.mode ?? 'classic',
    roundResult: room.roundResult,
  };
}

function addPlayer(room: Room, name?: string, previous?: Member) {
  const occupied = new Set(room.players.map(member => member.id));
  let id = previous?.id ?? 1;
  if (occupied.has(id)) id = 1;
  while (occupied.has(id)) id++;
  const player: Member = { id, name, token: previous?.token ?? crypto.randomUUID(), score: previous?.score ?? 0 };
  room.players.push(player);
  return player;
}

function session(code: string, room: Room, player?: Member): RoomSession {
  const state = snapshot(room);
  return player ? { code, room: state, id: player.id, token: player.token }
    : { code, room: state, id: null, token: null };
}

export function createRoom(code: string, name?: string) {
  const room: Room = { version: 0, boardVersion: 0, players: [], game: null, event: { added: 0 } };
  return { room, session: session(code, room, addPlayer(room, name)) };
}

export const nameError = `이름을 ${PLAYER_NAME_LIMIT}자 이내로 입력해 주세요.`;
export const roomPath = /^\/api\/rooms\/([a-f0-9]{12})\/(join|start|reset|claim|select|leave|mode|state|live)$/;
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
    const name = normalizePlayerName(body.name);
    if (body.name !== undefined && !name) return error(400, nameError);
    const matchesName = (member: Member) => name === null || member.name?.toLowerCase() === name.toLowerCase();
    const members = [...room.players, ...(room.departed ?? [])];
    const previous = room.departed?.find(member => member.token === body.token && matchesName(member));
    if (player && (matchesName(player) || !player.name)) {
      let changed = false;
      if (!player.name && name) {
        if (members.some(member => member !== player && matchesName(member))) return error(409, '이 방에서 이미 사용 중인 이름이에요.');
        player.name = name;
        changed = true;
      }
      if (player.selected?.length) {
        delete player.selected;
        changed = true;
      }
      if (changed) room.version++;
      return { status: 200, body: session(code, room, player), changed };
    }
    if ((!previous && room.game) || room.game?.finished || room.players.length >= MAX_ROOM_PLAYERS || body.spectate === true) {
      return { status: 200, body: session(code, room), changed: false };
    }
    if (name && !previous && members.some(matchesName)) return error(409, '이 방에서 이미 사용 중인 이름이에요.');
    if (previous) room.departed = room.departed?.filter(member => member !== previous);
    const guest = addPlayer(room, previous?.name ?? name ?? undefined, previous);
    room.version++;
    return { status: 200, body: session(code, room, guest), changed: true };
  }

  if (action === 'leave') {
    if (player) {
      room.players.splice(room.players.indexOf(player), 1);
      if (room.game && !room.game.finished) {
        delete player.selected;
        (room.departed ??= []).push(player);
      }
      if (!room.players.length && room.game) clearGame(room);
      room.version++;
    }
    return { status: 200, body: { room: snapshot(room) }, changed: Boolean(player) };
  }

  if (!player) return error(403, '플레이어로 참가해야 게임을 조작할 수 있어요.');
  if (body.boardVersion !== room.boardVersion) return error(409, '보드가 바뀌었어요. 새 조합을 찾아보세요.', true);
  if (action === 'mode') {
    if (player.id !== room.players[0].id) return error(403, '방장만 게임 모드를 바꿀 수 있어요.');
    if (room.game) return error(409, '게임 모드는 대기실에서만 바꿀 수 있어요.', true);
    const { mode } = body;
    if (mode !== 'classic' && mode !== 'race') return error(400, '지원하지 않는 게임 모드예요.');
    const changed = mode !== (room.mode ?? 'classic');
    if (changed) {
      room.mode = mode;
      room.version++;
    }
    return { status: 200, body: { room: snapshot(room) }, changed };
  }
  if ((action === 'start') !== !room.game) {
    return error(409, room.game ? '이미 게임이 시작됐어요.' : '아직 게임을 시작하지 않았어요.', true);
  }
  if (room.game?.finished) return error(409, '게임이 끝났어요. 잠시 후 대기실로 돌아가요.', true);

  if (action === 'select') {
    const { cards } = body;
    if (!Array.isArray(cards) || cards.length > 2 || new Set(cards).size !== cards.length
      || !cards.every(id => Number.isInteger(id) && room.game!.slots.some(card => card?.id === id))) {
      return error(400, '보드에 있는 카드만 선택할 수 있어요.');
    }
    const current = player.selected ?? [];
    const changed = current.length !== cards.length || current.some((id, index) => id !== cards[index]);
    if (changed) {
      player.selected = cards;
      room.version++;
    }
    return { status: 200, body: { room: snapshot(room) }, changed };
  }

  if (action === 'start' || action === 'reset') {
    if (player.id !== room.players[0].id) return error(403, '방장만 게임을 시작할 수 있어요.');
    Object.assign(room, createGame());
    delete room.roundResult;
    delete room.departed;
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
    player.score++;
    const race = room.mode === 'race';
    const reachedTarget = race && player.score >= RACE_TARGET;
    const event = race && !reachedTarget ? replaceEndlessSet(game, positions) : { added: replaceSet(game, positions) };
    if (reachedTarget) game.finished = true;
    room.event = { ...event, player: player.id, playerName: playerName(player), positions };
    if (game.finished) {
      saveRoundResult(room);
      room.returnToLobbyAt = Date.now() + RESULTS_DURATION_MS;
    }
  }

  for (const member of room.players) delete member.selected;
  room.boardVersion++;
  room.version++;
  return { status: 200, body: { room: snapshot(room) }, changed: true };
}
