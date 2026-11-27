export const INITIAL_SIZE = 12;
export const DECK_SIZE = 81;
export const MAX_ROOM_PLAYERS = 4;
export const PLAYER_NAME_LIMIT = 20;
export const RACE_TARGET = 30;
const attributes = ['count', 'color', 'shape', 'fill'] as const;
const columns = ['QAZ', 'WSX', 'EDC', 'RFV', 'TGB', 'YHN', 'UJM'];

export interface Card {
  id: number;
  count: number;
  color: number;
  shape: number;
  fill: number;
}

export interface Board {
  slots: (Card | null)[];
  found: number;
  finished: boolean;
}

export interface Game extends Board { deck: Card[] }
export interface Player { id: number; score: number; name?: string }
export interface GameEvent { added: number; player?: number; playerName?: string; positions?: number[]; newDeck?: boolean }
export interface PlayerSelection { player: number; cards: number[] }
export type RoomMode = 'classic' | 'race';
export interface Play extends Board { cardsLeft: number; event: GameEvent }
export interface RoomState {
  version: number;
  boardVersion: number;
  players: Player[];
  play: Play | null;
  mode?: RoomMode;
  roundResult?: Player[];
  selections?: PlayerSelection[];
}
export type RoomSession = { code: string; room: RoomState } & (
  { id: number; token: string } | { id: null; token: null }
);
export type Move = 'start' | 'reset' | 'claim' | 'leave' | 'mode';

export function normalizePlayerName(name: unknown) {
  if (typeof name !== 'string') return null;
  const normalized = name.trim().normalize('NFC');
  return normalized && normalized.length <= PLAYER_NAME_LIMIT && !/[\x00-\x1f\x7f]/.test(normalized) ? normalized : null;
}

export function playerName(player: Player) { return player.name ?? `플레이어 ${player.id}`; }

export function boardView(game: Game, event: GameEvent): Play {
  const { slots, found, finished, deck } = game;
  return { slots, found, finished, cardsLeft: deck.length, event };
}

export function keyAt(position: number) {
  if (position < INITIAL_SIZE) return columns[position % 4][Math.floor(position / 4)];
  const offset = position - INITIAL_SIZE;
  return columns[4 + Math.floor(offset / 3)][offset % 3];
}

export function isSet(first: Card, second: Card, third: Card) {
  return attributes.every(key => (first[key] + second[key] + third[key]) % 3 === 0);
}

function hasSet(slots: Board['slots']) {
  const cards = slots.filter(card => card !== null);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        if (isSet(cards[i], cards[j], cards[k])) return true;
      }
    }
  }
  return false;
}

function ensurePlayable(game: Game) {
  const before = game.slots.length;
  let canPlay = hasSet(game.slots);
  while (!canPlay && game.deck.length > 0) {
    game.slots.push(...game.deck.splice(-3));
    canPlay = hasSet(game.slots);
  }
  game.finished = !canPlay;
  return game.slots.length - before;
}

export function createGame(): { game: Game; event: GameEvent } {
  const deck = Array.from({ length: DECK_SIZE }, (_, id) => ({
    id, count: Math.floor(id / 27), color: Math.floor(id / 9) % 3, shape: Math.floor(id / 3) % 3, fill: id % 3,
  }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const game: Game = { deck, slots: deck.splice(-INITIAL_SIZE), found: 0, finished: false };
  return { game, event: { added: ensurePlayable(game) } };
}

export function replaceSet(game: Game, positions: number[]) {
  game.found++;
  for (const position of positions) game.slots[position] = null;
  if (game.slots.length > INITIAL_SIZE) {
    const extras = game.slots.splice(game.slots.length - 3).filter(card => card !== null);
    for (const card of extras) game.slots[game.slots.indexOf(null)] = card;
  } else {
    for (const position of positions) game.slots[position] = game.deck.pop() ?? null;
  }
  return ensurePlayable(game);
}

export function replaceEndlessSet(game: Game, positions: number[]) {
  const added = replaceSet(game, positions);
  if (!game.finished) return { added, positions };

  const { game: next, event } = createGame();
  Object.assign(game, next, { found: game.found });
  return { ...event, positions, newDeck: true };
}
