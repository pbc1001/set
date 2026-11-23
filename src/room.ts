import { useCallback, useEffect, useRef, useState } from 'react';
import type { Move, RoomSession, RoomState } from '../shared/game';

const apiOrigin = import.meta.env.VITE_API_ORIGIN || (import.meta.env.DEV ? location.origin : '');
const offline = '게임 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.';
const spectatorMark = 'spectator';

class RoomError extends Error {
  constructor(message: string, readonly room?: RoomState) { super(message); }
}

async function post<T>(path: string, body: object): Promise<T> {
  if (!apiOrigin) throw new RoomError('멀티플레이 서버 주소가 아직 연결되지 않았어요.');
  try {
    const response = await fetch(new URL(path, apiOrigin), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok) throw new RoomError(data.error ?? offline, data.room);
    return data;
  } catch (error) {
    if (error instanceof RoomError) throw error;
    throw new RoomError(offline);
  }
}

export function useRoom() {
  const [session, setSession] = useState<RoomSession | null>(null);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const moving = useRef(false);
  const code = session?.code;

  const update = useCallback((next: RoomState) => {
    setSession(current => {
      if (!current || next.version <= current.room.version) return current;
      const play = next.boardVersion === current.room.boardVersion ? current.room.play : next.play;
      return { ...current, room: { ...next, play } };
    });
  }, []);

  useEffect(() => {
    if (!code) return;
    let socket: WebSocket;
    let timer: number;
    const url = new URL(`/api/rooms/${code}/live`, apiOrigin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    function connect() {
      socket = new WebSocket(url);
      socket.onmessage = event => {
        update(JSON.parse(event.data) as RoomState);
        setOnline(true);
      };
      socket.onclose = () => {
        setOnline(false);
        timer = window.setTimeout(connect, 1600);
      };
    }

    connect();
    return () => {
      window.clearTimeout(timer);
      socket.onclose = null;
      socket.close();
    };
  }, [code, update]);

  async function enter(input?: string, takeSeat = false) {
    if (moving.current) return;
    const code = input?.trim().toLowerCase();
    if (input !== undefined && !/^[a-f0-9]{12}$/.test(code ?? '')) {
      setError('영문 A–F와 숫자로 된 12자리 방 코드를 입력하세요.');
      return;
    }
    moving.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = code && sessionStorage.getItem(`set-room:${code}`);
      const token = saved === spectatorMark ? null : saved;
      const spectate = saved === spectatorMark && !takeSeat;
      const next = await post<RoomSession>(code ? `/api/rooms/${code}/join` : '/api/rooms', { token, spectate });
      sessionStorage.setItem(`set-room:${next.code}`, next.token ?? spectatorMark);
      setSession(current => current?.code === next.code && current.room.version > next.room.version
        ? { ...next, room: current.room } : next);
    } catch (error) {
      setError(error instanceof RoomError ? error.message : offline);
    } finally {
      moving.current = false;
      setBusy(false);
    }
  }

  async function move(action: Move, cards: number[] = []) {
    if (!session || moving.current || (!session.token && action !== 'leave')) return;
    moving.current = true;
    setBusy(true);
    setError('');
    try {
      if (session.token) {
        const { room } = await post<{ room: RoomState }>(`/api/rooms/${session.code}/${action}`, {
          token: session.token, boardVersion: session.room.boardVersion, cards,
        });
        if (action !== 'leave') update(room);
      }
      if (action === 'leave') {
        sessionStorage.removeItem(`set-room:${session.code}`);
        location.assign('/');
      }
    } catch (error) {
      if (error instanceof RoomError && error.room) update(error.room);
      setError(error instanceof RoomError ? error.message : offline);
    } finally {
      moving.current = false;
      setBusy(false);
    }
  }

  return { session, online, busy, error, enter, move };
}
