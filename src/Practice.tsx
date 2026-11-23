import { useEffect, useRef, useState, type ReactNode } from 'react';
import { boardView, createGame, isSet, type Game, type GameEvent } from '../shared/game';
import { RECORD_NAME_LIMIT, replacePracticeSet, type PracticeRecord, type PracticeSnapshot } from '../shared/practice';
import { GameBoard } from './GameBoard';
import { Action } from './styles';

const apiOrigin = import.meta.env.VITE_API_ORIGIN || (import.meta.env.DEV ? location.origin : '');
const unavailable = '기록 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.';

class PracticeError extends Error {
  constructor(message: string, readonly practice?: PracticeSnapshot) { super(message); }
}

async function request<T>(path: string, body?: object, timeout = 8000): Promise<T> {
  try {
    const response = await fetch(new URL(`/api/practice${path}`, apiOrigin), {
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeout),
    });
    const data = await response.json();
    if (!response.ok) throw new PracticeError(data.error ?? unavailable, data.practice);
    return data;
  } catch (error) {
    if (error instanceof PracticeError) throw error;
    throw new PracticeError(unavailable);
  }
}

type Run = { online: true; practice: PracticeSnapshot } | { online: false; id: string; game: Game; event: GameEvent };
type PracticeResponse = { practice: PracticeSnapshot; needsName?: boolean };

function RecordPrompt({ busy, score, error, save, dismiss, skip }: {
  busy: boolean; score: number; error: string; save: (name: string) => void; dismiss: () => void; skip: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} className="record-dialog" aria-labelledby="record-title" onCancel={event => {
    event.preventDefault();
    if (!busy) dismiss();
  }}>
    <h2 id="record-title">새 최고 기록!</h2>
    <p>찾은 SET {score}개. 명예의 전당에 남길 이름을 입력하세요.</p>
    <form onSubmit={event => { event.preventDefault(); save(name.trim()); }}>
      <label htmlFor="record-name">이름</label>
      <input id="record-name" autoComplete="off" maxLength={RECORD_NAME_LIMIT} required value={name} onChange={event => setName(event.target.value)} />
      <div className="actions">
        <Action as="button" type="submit" disabled={busy || !name.trim()}>등록하고 나가기</Action>
        <Action as="button" data-secondary type="button" disabled={busy} onClick={dismiss}>계속 연습</Action>
      </div>
    </form>
    <button className="quiet leave-button" type="button" disabled={busy} onClick={skip}>등록 없이 나가기</button>
    {error && <p className="notice" role="status">{error}</p>}
  </dialog>;
}

export function Practice({ children }: { children: ReactNode }) {
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const sending = useRef(false);

  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const { practice } = await request<PracticeResponse>('', {}, 3500);
      setRun({ online: true, practice });
    } catch {
      setRun({ online: false, id: crypto.randomUUID(), ...createGame() });
    } finally {
      setShowPrompt(false);
      setBusy(false);
      sending.current = false;
    }
  }

  useEffect(() => { void start(); }, []);

  if (!run) return <p className="route-panel" role="status">연습 게임을 준비하고 있어요.</p>;
  const practice = run.online ? run.practice : null;
  const play = run.online ? run.practice.play : boardView(run.game, run.event);
  const message = play.event.newDeck ? '덱을 새로 섞었어요.'
    : play.event.added ? `가능한 SET이 없어 카드 ${play.event.added}장을 더 열었어요.`
      : play.event.player ? 'SET 성공!' : '';

  async function update(path: 'claim' | 'finish', body: object) {
    if (!practice || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const next = await request<PracticeResponse>(`/${practice.id}/${path}`, body);
      setRun({ online: true, practice: next.practice });
      return next;
    } catch (error) {
      if (error instanceof PracticeError && error.practice) setRun({ online: true, practice: error.practice });
      setError(error instanceof PracticeError ? error.message : unavailable);
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }

  async function leave(body: { name?: string; skipRecord?: boolean } = {}) {
    if (sending.current) return;
    if (!practice) {
      location.assign('/');
      return;
    }

    const next = await update('finish', body);
    if (next?.needsName || (!next && !body.name && !body.skipRecord && play.found > practice.best)) {
      setShowPrompt(true);
      return;
    }
    if (next || !body.name) location.assign(next?.practice.name && body.name ? '/records' : '/');
  }

  function claim(positions: number[]) {
    if (!run || sending.current) return;
    const [first, second, third] = positions.map(position => play.slots[position]);
    if (!first || !second || !third || !isSet(first, second, third)) {
      setError('SET이 아니에요. 다른 세 장을 골라 보세요.');
      return;
    }
    if (run.online) {
      void update('claim', { cards: [first.id, second.id, third.id], version: play.found });
      return;
    }
    const game = { ...run.game, slots: [...run.game.slots], deck: [...run.game.deck] };
    setRun({ ...run, game, event: replacePracticeSet(game, positions) });
    setError('');
  }

  return <div className="play-layout">
    <div className="practice-toolbar">
      <a className="quiet" href="/records" target="_blank" rel="noopener" aria-label="명예의 전당 (새 탭)">명예의 전당 <span aria-hidden="true">↗</span></a>
      {practice && <span>최고 기록 <strong>{practice.best} SET</strong></span>}
      <div className="play-tools">
        <button className="small-button" type="button" disabled={busy} onClick={() => void start()}>새 게임</button>
        <button className="small-button" type="button" disabled={busy} onClick={() => void leave()}>나가기</button>
      </div>
    </div>
    <GameBoard key={run.online ? run.practice.id : run.id} play={play} version={play.found} pending={busy || showPrompt} spectator={false}
      practice message={error || message} returnsToLobby={false} claim={claim} />
    <aside className="play-details" aria-label="연습 정보">
      <div className="play-tools">
        {children}
        {!run.online && <span role="status">오프라인 연습 중 · 기록은 저장되지 않아요.</span>}
      </div>
    </aside>
    {showPrompt && <RecordPrompt score={play.found} busy={busy} error={error}
      save={name => void leave({ name })} dismiss={() => { setError(''); setShowPrompt(false); }}
      skip={() => void leave({ skipRecord: true })} />}
  </div>;
}

export function HallOfFame() {
  const [records, setRecords] = useState<PracticeRecord[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void request<{ records: PracticeRecord[] }>('/records').then(data => setRecords(data.records), () => setError(true));
  }, []);

  return <>
    {error && <p role="status">{unavailable}</p>}
    {!error && !records && <p role="status">기록을 불러오는 중이에요.</p>}
    {records?.length === 0 && <p>아직 등록된 기록이 없어요.</p>}
    {!!records?.length && <ol className="record-list" aria-label="연습 모드 순위">{records.map(({ name, score }, index) => <li key={index}>
      <span>{name}</span><strong>{score} SET</strong>
    </li>)}</ol>}
    <Action href="/play">혼자 연습하기</Action>
  </>;
}
