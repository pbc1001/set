import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { INITIAL_SIZE, keyAt, type Play } from '../shared/game';
import { CardArt, describeCard } from './CardArt';

interface Props {
  play: Play;
  version: number;
  pending: boolean;
  spectator: boolean;
  practice?: boolean;
  standings?: ReactNode;
  message: string;
  finder?: string;
  goal?: number;
  remoteSelections?: { id: number; name: string; cards: number[] }[];
  select?: (positions: number[]) => void;
  returnsToLobby: boolean;
  claim: (positions: number[]) => void;
}

export function GameBoard({ play, version, pending, spectator, practice, standings, message, finder, goal, remoteSelections, select, returnsToLobby, claim }: Props) {
  const [display, setDisplay] = useState(play);
  const [selected, setSelected] = useState<number[]>([]);
  const [burst, setBurst] = useState<number[]>([]);
  const [celebrating, setCelebrating] = useState(false);
  const lastVersion = useRef(version);

  useLayoutEffect(() => {
    if (lastVersion.current === version) return;
    const positions = version === lastVersion.current + 1 ? play.event.positions : undefined;
    lastVersion.current = version;
    setSelected([]);
    setBurst([]);
    setCelebrating(!!positions?.length);
    if (!positions?.length) {
      setDisplay(play);
      return;
    }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) setDisplay(play);
    else setBurst(positions);
    const replacement = window.setTimeout(() => {
      setDisplay(play);
      setBurst([]);
    }, 485);
    const end = window.setTimeout(() => setCelebrating(false), 790);
    return () => { window.clearTimeout(replacement); window.clearTimeout(end); };
    // The board revision owns the animation, including while a name is saved.
  }, [version]);

  const locked = spectator || pending || burst.length > 0 || display.finished;
  const hasCards = display.slots.some(card => card !== null);
  const columns = 4 + Math.max(0, (display.slots.length - INITIAL_SIZE) / 3);
  const positions = Array.from({ length: columns * 3 }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return column < 4 ? row * 4 + column : INITIAL_SIZE + (column - 4) * 3 + row;
  });

  function choose(position: number) {
    if (locked || !display.slots[position]) return;
    const next = selected.includes(position) ? selected.filter(slot => slot !== position) : [...selected, position];
    if (next.length === 3) {
      clearSelection();
      claim(next);
    } else {
      setSelected(next);
      select?.(next);
    }
  }

  function clearSelection() {
    setSelected([]);
    select?.([]);
  }

  useEffect(() => {
    if (spectator || pending) return;
    const shortcut = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target instanceof HTMLInputElement) return;
      if (event.key === 'Escape') {
        clearSelection();
        return;
      }
      const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : event.key.toUpperCase();
      const position = display.slots.findIndex((card, slot) => card && keyAt(slot) === key);
      if (position >= 0) {
        event.preventDefault();
        choose(position);
      }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  });

  return <section className="table" aria-labelledby="board-title">
    <div className="table-bar board-heading">
      <h1 id="board-title">{practice ? '무한 연습' : '게임 보드'}</h1>
      <dl className="board-stats">
        {goal && <div><dt>개인 목표</dt><dd>{goal} SET</dd></div>}
        <div><dt>찾은 SET</dt><dd>{play.found}</dd></div>
        <div><dt>남은 덱</dt><dd>{play.cardsLeft}</dd></div>
      </dl>
      {spectator ? <span className="connection" role="status">관전 중</span> : <span className="selection" aria-label={`선택한 카드 ${selected.length}장`}>
        {Array.from({ length: 3 }, (_, index) => <i key={index} data-filled={index < selected.length} />)}
        {selected.length} / 3
      </span>}
    </div>
    {(hasCards || celebrating) && <div className="board-area" data-empty={!hasCards}>
      {hasCards && <div className="board" role="group" aria-label="카드" style={{ '--columns': columns } as CSSProperties}>
        {positions.map((position, index) => {
          const card = display.slots[position];
          if (!card) return <div key={position} aria-hidden="true" />;
          const key = keyAt(position);
          const order = burst.indexOf(position);
          const others = remoteSelections?.filter(player => player.cards.includes(card.id)) ?? [];
          const description = `${spectator ? '' : `${key}, `}${describeCard(card)}`;
          return <button key={card.id} type="button" className="playing-card" data-extra={position >= INITIAL_SIZE}
            data-burst={order >= 0} tabIndex={spectator ? -1 : undefined} aria-keyshortcuts={spectator ? undefined : key}
            aria-pressed={spectator ? undefined : selected.includes(position)} aria-disabled={locked}
            aria-label={others.length ? `${description}, ${others.map(player => player.name).join(', ')} 선택 중` : description} onClick={() => choose(position)}
            style={{ '--delay': `${order * 45}ms`, gridColumn: index % columns + 1, gridRow: Math.floor(index / columns) + 1 } as CSSProperties}>
            {!spectator && <kbd aria-hidden="true">{key}</kbd>}<CardArt card={card} />
            {!!others.length && <span className="card-selectors" aria-hidden="true">
              {others.map(player => <span key={player.id} data-player={player.id} title={player.name}>{player.name}</span>)}
            </span>}
          </button>;
        })}
      </div>}
      {celebrating && <div className="celebration" aria-hidden="true">
        <div className="celebration-label"><strong>SET!</strong>{finder && <span>{finder}</span>}</div>
        {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
      </div>}
    </div>}
    {display.finished ? <div className="game-result" role="status">
      <strong>게임 종료</strong>
      <span>{goal ? `${finder} 님이 SET ${goal}개를 먼저 찾아 승리했어요.` : <>
        {finder && `${finder} 님이 마지막 SET을 찾았어요. `}총 SET {display.found}개. {hasCards ? '남은 카드에 가능한 SET이 없어요.' : '모든 카드를 사용했어요.'}
      </>}{returnsToLobby && ' 잠시 후 대기실로 돌아가요.'}</span>
      {standings}
    </div> : <div className="table-bar table-foot">
      <p role="status">{selected.length ? `카드 ${3 - selected.length}장을 더 선택하세요.` : message}</p>
      {!spectator && <button type="button" className="text-button" disabled={!selected.length} onClick={clearSelection}><kbd>ESC</kbd> 선택 해제</button>}
    </div>}
  </section>;
}
