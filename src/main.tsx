import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Global } from '@emotion/react';
import { MAX_ROOM_PLAYERS, PLAYER_NAME_LIMIT, RACE_TARGET, playerName, type Player, type RoomMode } from '../shared/game';
import { CardArt } from './CardArt';
import { GameBoard } from './GameBoard';
import { HallOfFame, Practice } from './Practice';
import { Action, styles } from './styles';
import { activeName, preferredName, useRoom } from './room';

const locationAtLoad = new URL(location.href);
const invited = locationAtLoad.searchParams.get('room');
const initialPage = invited ? 'join' : locationAtLoad.pathname.replace(/^\/|\/$/g, '') || 'home';
const sample = [0, 1, 2].map(count => ({ count, color: count, shape: count, fill: count }));
const examples = [0, 1, 2].map(count => ({ count, color: 2, shape: 0, fill: 0 }));
const modes = {
  classic: { title: '한 덱', description: '덱을 다 쓰고 가능한 SET이 없어지면 종료' },
  race: { title: `무한 모드 · ${RACE_TARGET} SET 선승`, description: `덱을 이어서 사용하고, 개인 SET ${RACE_TARGET}개를 먼저 찾으면 승리` },
};
const roomModes = ['classic', 'race'] as const;

function Home() {
  return <section className="home">
    <div className="home-copy">
      <h1>세 장이 모이면<br /><em>하나의 SET.</em></h1>
      <p>같은 보드에 모여, 누구보다 먼저 패턴을 찾아보세요.</p>
      <div className="actions">
        <Action href="/create">방 만들기</Action>
        <Action href="/join" data-secondary>코드로 입장</Action>
      </div>
      <nav className="play-tools" aria-label="연습 메뉴">
        <a className="quiet" href="/play">혼자 연습하기 <span aria-hidden="true">↗</span></a>
        <a className="quiet" href="/records">명예의 전당</a>
      </nav>
    </div>
    <div className="hero-art" aria-hidden="true">
      <div className="hero-disc" />
      <div className="hero-spark spark-one">✦</div><div className="hero-spark spark-two">✧</div>
      {sample.map((card, i) => <div className={`hero-card hero-card-${i}`} key={i}><CardArt card={card} /></div>)}
    </div>
  </section>;
}

function Panel({ title, children, navigation }: { title: string; children: ReactNode; navigation?: ReactNode }) {
  return <section className="route-panel">
    {navigation ?? <a className="quiet" href="/">홈으로</a>}
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

function ModeSettings({ mode, busy, change }: { mode: RoomMode; busy: boolean; change?: (mode: RoomMode) => void }) {
  if (!change) return <section className="mode-settings">
    <h2>게임 모드</h2><strong>{modes[mode].title}</strong><small>{modes[mode].description}</small>
  </section>;

  return <fieldset className="mode-settings mode-options" disabled={busy}>
    <legend>게임 모드</legend>
    {roomModes.map(option => <label key={option}>
      <input type="radio" name="game-mode" value={option} checked={mode === option} onChange={() => change(option)} />
      <span><strong>{modes[option].title}</strong><small>{modes[option].description}</small></span>
    </label>)}
  </fieldset>;
}

function Roster({ players, me, scores = false, goal }: { players: Player[]; me: number | null; scores?: boolean; goal?: number }) {
  return <ul className={scores ? 'roster compact-roster' : 'roster'} aria-label={scores ? '플레이어 점수' : '참가자 목록'}>{players.map(player => <li key={player.id}>
    <span>{scores && <i className="player-color" data-player={player.id} aria-hidden="true" />}{playerName(player)}{player.id === me ? ' (나)' : ''}</span>
    <strong>{scores ? <>{player.score}{goal && <small> / {goal}</small>}</> : player.id === players[0].id ? '방장' : '참가자'}</strong>
  </li>)}</ul>;
}

function RoundStandings({ players, title }: { players: Player[]; title: string }) {
  return <section className="round-standings">
    <h2>{title}</h2>
    <ol aria-label={title}>{players.map(player => {
      const rank = players.findIndex(other => other.score === player.score) + 1;
      const tied = players.filter(other => other.score === player.score).length > 1;
      return <li key={player.id} data-winner={rank === 1}>
        <strong>{tied && '공동 '}{rank}위</strong>
        <span>{playerName(player)}{rank === 1 && <small>승리</small>}</span>
        <b>{player.score} SET</b>
      </li>;
    })}</ol>
  </section>;
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

function App() {
  const { session, online, busy, error, enter, move, select } = useRoom();
  const [code, setCode] = useState(invited ?? '');
  const [name, setName] = useState(() => (invited && activeName(invited.toLowerCase())) || preferredName());
  const page = session ? session.room.play ? 'play' : 'lobby' : initialPage === 'lobby' ? 'join' : initialPage;
  const play = session?.room.play;
  const mode = session?.room.mode ?? 'classic';
  const goal = mode === 'race' ? RACE_TARGET : undefined;
  const roundResult = session?.room.roundResult;
  const spectator = session?.id === null;
  const isHost = Boolean(session && session.id === session.room.players[0]?.id);
  const leaveButton = <button className="quiet leave-button" type="button" disabled={busy} onClick={() => void move('leave')}>나가기</button>;

  useEffect(() => {
    if (invited && /^\/(lobby|play)\/?$/.test(locationAtLoad.pathname)) {
      const saved = activeName(invited.toLowerCase());
      if (saved) void enter(saved, invited);
    }
  }, []);
  useEffect(() => {
    if (!session) return;
    history.replaceState(null, '', `/${page}?room=${session.code}`);
    document.querySelector('main h1')?.scrollIntoView({ block: 'nearest' });
  }, [page, session?.code]);

  const extra = play?.event.newDeck ? ' 새 덱을 섞었어요.'
    : play?.event.added ? ` 가능한 SET이 없어 카드 ${play.event.added}장을 더 열었어요.` : '';
  const finder = play?.event.playerName ?? (play?.event.player ? `플레이어 ${play.event.player}` : '');
  const message = finder ? `${finder} 님이 SET을 찾았어요!${extra}` : extra.trim();
  const remoteSelections = session?.room.selections?.flatMap(({ player, cards }) => {
    if (player === session.id) return [];
    const member = session.room.players.find(({ id }) => id === player);
    return member ? [{ id: player, name: playerName(member), cards }] : [];
  });
  const nameField = <label className="room-field" htmlFor="room-name">이름
    <input id="room-name" name="nickname" placeholder="게임에 표시할 이름" autoComplete="nickname" required value={name}
      maxLength={PLAYER_NAME_LIMIT} onChange={event => setName(event.target.value)} />
  </label>;

  return <>
    <Global styles={styles} />
    <header className="topbar"><div className="shell topbar-inner">
      <a href="/" className="brand" aria-label="SET LAB 홈" onClick={event => {
        if (session) {
          event.preventDefault();
          void move('leave');
        }
      }}><b aria-hidden="true">✦</b><span>SET<span>LAB</span></span></a>
      {play && isHost && <button type="button" className="small-button" disabled={busy || play.finished} onClick={() => void move('reset')}>새 게임</button>}
    </div></header>
    <main className="shell">
      {page === 'home' && <Home />}
      {page === 'records' && <Panel title="명예의 전당"><HallOfFame /></Panel>}
      {page === 'create' && <Panel title="새 방 만들기">
        <p>대기실에서 초대 링크를 공유하고 게임을 시작하세요.</p>
        <form className="join-form" onSubmit={event => { event.preventDefault(); void enter(name); }}>
          {nameField}
          <Action as="button" type="submit" disabled={busy}>{busy ? '방을 만드는 중…' : '방 만들기'}</Action>
        </form>
        {error && <p className="notice" role="status">{error}</p>}
      </Panel>}
      {page === 'join' && <Panel title="코드로 입장">
        <p>친구에게 받은 12자리 방 코드를 입력하세요.</p>
        <form className="join-form" onSubmit={event => { event.preventDefault(); void enter(name, code); }}>
          <label className="room-field" htmlFor="room-code">방 코드
            <input id="room-code" placeholder="방 코드" required value={code} maxLength={12} autoComplete="off" onChange={event => setCode(event.target.value)} />
          </label>
          {nameField}
          <Action as="button" type="submit" disabled={busy}>{busy ? '입장 중…' : '입장'}</Action>
        </form>
        {error && <p className="notice" role="status">{error}</p>}
      </Panel>}
      {page === 'lobby' && session && <Panel title="대기실" navigation={leaveButton}>
        <Connection online={online} />
        <p>친구에게 방 코드나 초대 링크를 보내세요.</p>
        <RoomInvite code={session.code} />
        <h2 className="roster-title">참가자 <strong>{session.room.players.length} / {MAX_ROOM_PLAYERS}명</strong></h2>
        <Roster players={session.room.players} me={session.id} />
        {!!roundResult?.length && <RoundStandings players={roundResult} title="지난 게임 결과" />}
        <ModeSettings mode={mode} busy={busy} change={isHost ? mode => void move('mode', { mode }) : undefined} />
        {isHost && <Action as="button" type="button" disabled={busy} onClick={() => void move('start')}>게임 시작</Action>}
        {spectator && <>
          <p className="notice" role="status">관전 중</p>
          {session.room.players.length < MAX_ROOM_PLAYERS &&
            <Action as="button" type="button" disabled={busy} onClick={() => void enter(name, session.code, true)}>플레이어로 참가</Action>}
        </>}
        {!isHost && !spectator && <p className="notice" role="status">방장이 시작하면 자동으로 이동해요.</p>}
        {error && <p className="notice" role="status">{error}</p>}
      </Panel>}
      {page === 'play' && !session && <Practice><Rules /></Practice>}
      {session && play && <div className="play-layout">
        <GameBoard key={session.code} play={play} version={session.room.boardVersion} pending={busy} spectator={spectator} message={error || message} returnsToLobby
          finder={finder} goal={goal} remoteSelections={remoteSelections} select={positions => void select(positions.flatMap(position => play.slots[position]?.id ?? []))}
          standings={!!roundResult?.length && <RoundStandings players={roundResult} title="최종 순위" />}
          claim={positions => void move('claim', { cards: positions.flatMap(position => play.slots[position]?.id ?? []) })} />
        <aside className="play-details" aria-label="게임 정보">
          <Roster players={session.room.players} me={session.id} scores goal={goal} />
          <div className="play-tools">
            <Rules />
            <details className="play-detail">
              <summary>방 정보</summary>
              <RoomInvite code={session.code} />
            </details>
            <Connection online={online} />
            {leaveButton}
          </div>
        </aside>
      </div>}
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
