import { replaceEndlessSet, type Game, type Play } from './game.ts';

export const RECORD_NAME_LIMIT = 24;

export interface PracticeRecord { name: string; score: number }
export interface PracticeSnapshot { id: string; play: Play; name: string | null; best: number }

export function replacePracticeSet(game: Game, positions: number[]) {
  return { ...replaceEndlessSet(game, positions), player: 1 };
}
