import { boardView, createGame, isSet, type Game, type GameEvent } from '../shared/game.ts';
import { RECORD_NAME_LIMIT, replacePracticeSet, type PracticeRecord, type PracticeSnapshot } from '../shared/practice.ts';

const recordKey = 'records';
const recordLimit = 10;
const runId = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export const practicePath = new RegExp(`^/api/practice(?:/(records|(${runId})/(claim|record)))?$`);

type Entry = PracticeRecord & { runId: string };
interface Run { game: Game; event: GameEvent; name: string | null }
export interface PracticeStorage {
  get<T>(key: string): T | undefined;
  put(key: string, value: Run | Entry[]): void;
}

export function practiceAction(match: RegExpExecArray, method: string, body: Record<string, unknown> | null, storage: PracticeStorage) {
  const [, section, id, action] = match;
  const error = (status: number, message: string) => ({ status, body: { error: message } });
  if (method !== (section === 'records' ? 'GET' : 'POST')) return error(405, '지원하지 않는 요청이에요.');

  let records = storage.get<Entry[]>(recordKey) ?? [];
  if (section === 'records') {
    return { status: 200, body: { records: records.map(({ name, score }) => ({ name, score })) } };
  }
  if (!body) return error(400, '요청을 읽을 수 없어요.');

  function snapshot(runId: string, run: Run): PracticeSnapshot {
    return { id: runId, play: boardView(run.game, run.event), name: run.name, best: records[0]?.score ?? 0 };
  }

  if (!id) {
    const id = crypto.randomUUID();
    const run = { ...createGame(), name: null };
    storage.put(id, run);
    return { status: 201, body: { practice: snapshot(id, run) } };
  }

  const run = storage.get<Run>(id);
  if (!run) return error(404, '연습 게임을 찾을 수 없어요. 새 게임을 시작해 주세요.');

  const conflict = (message: string) => ({ status: 409, body: { error: message, practice: snapshot(id, run) } });
  if (action === 'claim') {
    if (body.version !== run.game.found) return conflict('보드가 바뀌었어요. 새 조합을 찾아보세요.');
    const { cards } = body;
    if (!Array.isArray(cards) || cards.length !== 3 || new Set(cards).size !== 3 || !cards.every(Number.isInteger)) {
      return error(400, '서로 다른 카드 세 장을 선택하세요.');
    }
    const positions = cards.map(id => run.game.slots.findIndex(card => card?.id === id));
    const [first, second, third] = positions.map(position => run.game.slots[position]);
    if (!first || !second || !third || !isSet(first, second, third)) return error(422, 'SET이 아니에요. 다른 세 장을 골라 보세요.');
    run.event = replacePracticeSet(run.game, positions);
  } else {
    if (run.name) return { status: 200, body: { practice: snapshot(id, run) } };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > RECORD_NAME_LIMIT || /[\x00-\x1f\x7f]/.test(name)) {
      return error(400, `이름을 ${RECORD_NAME_LIMIT}자 이내로 입력해 주세요.`);
    }
    if (run.game.found <= (records[0]?.score ?? 0)) return conflict('새 최고 기록을 넘으면 이름을 올릴 수 있어요.');
    run.name = name;
  }

  storage.put(id, run);
  if (run.name) {
    const entry = { runId: id, name: run.name, score: run.game.found };
    records = [...records.filter(record => record.runId !== id), entry]
      .sort((a, b) => b.score - a.score).slice(0, recordLimit);
    storage.put(recordKey, records);
  }
  return { status: 200, body: { practice: snapshot(id, run) } };
}
