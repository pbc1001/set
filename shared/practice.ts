import { createGame, replaceSet, type Game, type Play } from './game.ts';

export const RECORD_NAME_LIMIT = 24;

export interface PracticeRecord { name: string; score: number }
export interface PracticeSnapshot { id: string; play: Play; name: string | null; best: number }

export function replacePracticeSet(game: Game, positions: number[]) {
  const added = replaceSet(game, positions);
  if (!game.finished) return { added, positions, player: 1 };

  const { game: next, event } = createGame();
  Object.assign(game, next, { found: game.found });
  return { ...event, positions, player: 1, newDeck: true };
}
