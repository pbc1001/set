# SET LAB

React, TypeScript, Emotion, Vite를 사용하는 브라우저 카드 게임입니다. `shared/game.ts`의 규칙을 혼자 연습과 멀티플레이 서버가 함께 사용합니다.

## 노트북에서 실행

Node.js 22.13 이상에서 `npm ci`를 실행합니다. 터미널 두 개에서 아래 명령을 각각 실행하세요.

```powershell
npm run server
npm run dev
```

프런트는 `http://127.0.0.1:5173`, 게임 서버는 `http://127.0.0.1:8787`을 사용합니다. 방과 점수는 `.data/set-lab.sqlite`에 저장됩니다. Cloudflare 환경을 로컬에서 시험하려면 `npm run server` 대신 `npm run dev:worker`를 실행합니다. 브라우저에서 `/play`로 가면 게임 서버 없이 연습할 수 있습니다.

## Vercel과 Cloudflare Workers 배포

1. Cloudflare Workers Builds에서 GitHub 저장소의 `main` 브랜치를 연결합니다. Worker 이름은 `set-lab-api`, 루트는 저장소 루트, 배포 명령은 `npm run deploy:worker`입니다.
2. Vercel의 Production 환경변수 `VITE_API_ORIGIN`에 Worker의 HTTPS 주소를 설정합니다. npm 빌드 명령은 `npm run build`, 결과 폴더는 `build/web`입니다.
3. 프런트 주소가 바뀌면 `wrangler.jsonc`의 `WEB_ORIGINS`에 새 주소를 추가합니다.

Cloudflare Worker는 방마다 SQLite 기반 Durable Object를 사용해 방과 점수를 저장하고 WebSocket으로 변경을 보냅니다. 이 배포에서는 새 방을 만들어 사용합니다. 노트북과 터널 없이도 멀티플레이가 작동합니다.
