import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Global } from '@emotion/react';
import { createGame, isSet, replaceSet, type Game, type GameEvent, type Player } from '../shared/game';
import { CardArt } from './CardArt';
import { GameBoard, type Play } from './GameBoard';
import { Action, styles } from './styles';
import { useRoom } from './room';

const locationAtLoad = new URL(location.href);
const invited = locationAtLoad.searchParams.get('room');
const initialPage = invited ? 'join' : locationAtLoad.pathname.replace(/^\/|\/$/g, '') || 'home';
const sample = [0, 1, 2].map(count => ({ count, color: count, shape: count, fill: count }));
const examples = [0, 1, 2].map(count => ({ count, color: 2, shape: 0, fill: 0 }));

function Home() {
  return <section className="home">
    <div className="home-copy">
      <h1>세 장이 모이면<br /><em>하나의 SET.</em></h1>
      <p>같은 보드에 모여, 누구보다 먼저 패턴을 찾아보세요.</p>
      <div className="actions">
        <Action href="/create">방 만들기</Action>
        <Action href="/join" data-secondary>코드로 입장</Action>
      </div>
      <a className="quiet" href="/play">혼자 연습하기 <span aria-hidden="true">↗</span></a>
    </div>
    <div className="hero-art" aria-hidden="true">
      <div className="hero-disc" />
      <div className="hero-spark spark-one">✦</div><div className="hero-spark spark-two">✧</div>
      {sample.map((card, i) => <div className={`hero-card hero-card-${i}`} key={i}><CardArt card={card} /></div>)}
    </div>
  </section>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="route-panel">
    <a className="quiet" href="/">홈으로</a>
    <h1>{title}</h1>
    {children}
  </section>;
}

function RoomInvite({ code }: { code: string }) {
  const [notice, setNotice] = useState('');
  const [manual, setManual] = useState(false);
  const invite = new URL(`/join?room=${code}`, location.origin).href;
  return <>
    <div className="invite"><output aria-label="방 코드">{code.toUpperCase()}</output>
      <button className="small-button" type="button" onClick={async () => {
        try {
          await navigator.clipboard.writeText(invite);
          setNotice('초대 링크를 복사했어요.');
        } catch {
          setManual(true);
          setNotice('아래 링크를 복사해 주세요.');
        }
      }}>초대 링크 복사</button>
    </div>
    {manual && <input aria-label="초대 링크" readOnly value={invite} onFocus={event => event.target.select()} />}
    {notice && <p className="notice" role="status">{notice}</p>}
  </>;
}

function Connection({ online }: { online: boolean }) {
  return <span className="connection" data-online={online} role="status">{online ? '실시간 연결' : '연결 중'}</span>;
}

function Roster({ players, me, scores = false }: { players: Player[]; me: number; scores?: boolean }) {
  return <ul className={scores ? 'roster compact-roster' : 'roster'} aria-label={scores ? '플레이어 점수' : '참가자 목록'}>{players.map(player => <li key={player.id}>
    <span>플레이어 {player.id}{player.id === me ? ' (나)' : ''}</span>
    <strong>{scores ? player.score : player.id === 1 ? '방장' : '참가자'}</strong>
  </li>)}</ul>;
}

function Rules() {
  return <details className="play-detail">
    <summary>게임 규칙</summary>
    <p>카드를 클릭하거나 카드에 적힌 키로 선택하세요.</p>
    <p>세 카드의 개수, 색, 모양, 채움이 속성마다 <strong>모두 같거나 모두 다르면</strong> SET입니다.</p>
    <div className="examples" role="img" aria-label="보라색 타원이 각각 1개, 2개, 3개인 SET 예시">
      {examples.map(card => <div key={card.count}><CardArt card={card} /></div>)}
    </div>
    <p>가능한 SET이 없으면 카드 세 장을 더 열어요. 첫 추가 열은 <kbd>T</kbd> <kbd>G</kbd> <kbd>B</kbd>입니다.</p>
  </details>;
}

const playable = (game: Game, event: GameEvent): Play => ({ slots: game.slots, cardsLeft: game.deck.length, found: game.found, finished: game.finished, event });

function App() {
  const { session, online, busy, error, enter, move } = useRoom();
  const [code, setCode] = useState(invited ?? '');
  const [solo, setSolo] = useState(() => ({ ...createGame(), version: 0 }));
  const [soloError, setSoloError] = useState('');
  const page = session ? session.room.play ? 'play' : 'lobby' : initialPage === 'lobby' ? 'join' : initialPage;
  const practice = useMemo(() => playable(solo.game, solo.event), [solo]);
  const play = session?.room.play ?? practice;
  const version = session?.room.boardVersion ?? solo.version;

  useEffect(() => { if (invited) void enter(invited); }, []);
  useEffect(() => {
    if (!session) return;
    history.replaceState(null, '', `/${page}?room=${session.code}`);
    document.querySelector('main h1')?.scrollIntoView({ block: 'nearest' });
  }, [page, session?.code]);

  function claim(positions: number[]) {
    const cards = positions.map(position => play.slots[position]!);
    if (session) {
      void move('claim', cards.map(card => card.id));
      return;
    }
    if (!isSet(cards[0], cards[1], cards[2])) {
      setSoloError('SET이 아니에요. 다른 세 장을 골라 보세요.');
      return;
    }
    const game = { ...solo.game, slots: [...solo.game.slots], deck: [...solo.game.deck] };
    const added = replaceSet(game, positions);
    setSolo({ game, event: { added, positions, player: 1 }, version: solo.version + 1 });
    setSoloError('');
  }

  const extra = play.event.added ? ` 가능한 SET이 없어 카드 ${play.event.added}장을 더 열었어요.` : '';
  const message = play.finished ? `게임 종료 · SET ${play.found}개를 찾았어요!` : play.event.player
    ? `${session ? `플레이어 ${play.event.player}의 SET!` : 'SET 성공!'}${extra}` : extra.trim();

  return <>
    <Global styles={styles} />
    <header className="topbar"><div className="shell topbar-inner">
      <a href="/" className="brand" aria-label="SET LAB 홈"><b aria-hidden="true">✦</b><span>SET<span>LAB</span></span></a>
      {page === 'play' && (!session || session.id === 1) && <button type="button" className="small-button" disabled={busy} onClick={() => {
        if (session) void move('reset');
        else { setSolo({ ...createGame(), version: solo.version + 1 }); setSoloError(''); }
      }}>새 게임</button>}
    </div></header>
    <main className="shell">
      {page === 'home' && <Home />}
      {page === 'create' && <Panel title="새 방 만들기">
        <p>대기실에서 초대 링크를 공유하고 게임을 시작하세요.</p>
        <Action as="button" type="button" disabled={busy} onClick={() => void enter()}>{busy ? '방을 만드는 중…' : '방 만들기'}</Action>
        {error && <p className="notice" role="status">{error}</p>}
      </Panel>}
      {page === 'join' && <Panel title="코드로 입장">
        <p>친구에게 받은 12자리 방 코드를 입력하세요.</p>
        <form className="join-form" onSubmit={event => { event.preventDefault(); void enter(code); }}>
          <input aria-label="방 코드" placeholder="방 코드" required value={code} maxLength={12} autoComplete="off" onChange={event => setCode(event.target.value)} />
          <Action as="button" type="submit" disabled={busy}>{busy ? '입장 중…' : '입장'}</Action>
        </form>
        {error && <p className="notice" role="status">{error}</p>}
      </Panel>}
      {page === 'lobby' && session && <Panel title="대기실">
        <Connection online={online} />
        <p>친구에게 방 코드나 초대 링크를 보내세요.</p>
        <RoomInvite code={session.code} />
        <h2 className="roster-title">참가자 <strong>{session.room.players.length}명</strong></h2>
        <Roster players={session.room.players} me={session.id} />
        {session.id === 1 ? <Action as="button" type="button" disabled={busy} onClick={() => void move('start')}>게임 시작</Action>
          : <p className="notice" role="status">방장이 시작하면 자동으로 이동해요.</p>}
        {error && <p className="notice" role="status">{error}</p>}
      </Panel>}
      {page === 'play' && <div className="play-layout">
        <GameBoard key={session?.code ?? 'solo'} play={play} version={version} pending={busy} message={error || soloError || message} claim={claim} />
        <aside className="play-details" aria-label="게임 정보">
          {session && <Roster players={session.room.players} me={session.id} scores />}
          <div className="play-tools">
            <Rules />
            {session && <>
              <details className="play-detail">
                <summary>방 정보</summary>
                <RoomInvite code={session.code} />
              </details>
              <Connection online={online} />
              <a className="quiet" href="/">나가기</a>
            </>}
          </div>
        </aside>
      </div>}
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
