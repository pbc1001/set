import { css } from '@emotion/react';
import styled from '@emotion/styled';
import type { ComponentPropsWithoutRef } from 'react';

const action = css`
  display: inline-flex; justify-content: center; align-items: center; min-height: 47px;
  padding: 10px 18px; border: 1px solid var(--accent); border-radius: 10px;
  color: var(--accent-ink); background: var(--accent); font-weight: 800; text-decoration: none; white-space: nowrap;
  &:hover { background: #c8fbe7; border-color: #c8fbe7; }
  &[data-secondary] { background: var(--surface-raised); color: var(--ink); border-color: var(--line-strong); }
  &[data-secondary]:hover { background: #25343d; border-color: var(--accent); }
  &:disabled { opacity: .55; }
`;
const ActionLink = styled.a(action);
const ActionButton = styled.button(action);
type ActionProps = ComponentPropsWithoutRef<'a'> | (ComponentPropsWithoutRef<'button'> & { as: 'button' });
export function Action(props: ActionProps) {
  if ('as' in props) {
    const { as: _, ...button } = props;
    return <ActionButton {...button} />;
  }
  return <ActionLink {...props} />;
}

export const styles = css`
  :root {
    color-scheme: dark;
    --ink: #f0f5f3; --muted: #adc0c6; --background: #0e141a;
    --surface: #151f27; --surface-raised: #1d2a33; --line: #2b3b46; --line-strong: #455b66;
    --accent: #a4eed3; --accent-ink: #0e3028; --gold: #f1cb87; --card: #f7f5ed;
    --mono: 'Cascadia Mono', Consolas, monospace;
    font: 16px/1.6 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif;
    color: var(--ink); background: var(--background);
  }
  *, *::before, *::after { box-sizing: border-box; }
  body, h1, h2, p, dl, dd { margin: 0; }
  body { min-height: 100svh; background: radial-gradient(ellipse at 65% -16%, #20333c, transparent 58%); }
  a { color: inherit; }
  button, input { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: default; }
  :where(button, input, a):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  kbd { font: 750 .84em var(--mono); }
  h1, h2 { line-height: 1.13; }
  h2 { font-size: 1rem; letter-spacing: -.035em; }
  .shell { width: min(1200px, calc(100% - clamp(24px, 6vw, 72px))); margin-inline: auto; }
  .topbar { border-bottom: 1px solid var(--line); background: #0e141aa8; }
  .topbar-inner { display: flex; min-height: 68px; align-items: center; justify-content: space-between; }
  .brand { display: inline-flex; align-items: center; gap: 9px; font: 950 1.19rem system-ui; letter-spacing: -.075em; text-decoration: none; }
  .brand b { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 8px; color: var(--accent); background: #233c3b; border: 1px solid #416762; font-size: 1.15rem; }
  .brand span span { color: var(--accent); margin-left: 2px; }
  .quiet { font-size: .875rem; font-weight: 750; color: var(--muted); text-underline-offset: 4px; }
  .quiet:hover { color: var(--accent); }
  .actions { display: flex; gap: 9px; flex-wrap: wrap; margin: 26px 0 14px; }
  .small-button { padding: 7px 11px; min-height: 41px; border: 1px solid var(--line-strong); border-radius: 8px; background: var(--surface-raised); color: var(--ink); font-size: .875rem; font-weight: 750; white-space: nowrap; }
  .small-button:enabled:hover { background: #283840; border-color: var(--accent); }

  .home { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); gap: clamp(22px, 4vw, 55px); align-items: center; padding: clamp(32px, 6vw, 76px) 0; min-height: min(700px, calc(100svh - 68px)); }
  .home-copy h1 { font-size: clamp(2.5rem, 5.45vw, 5.1rem); line-height: 1.02; letter-spacing: -.085em; font-weight: 900; word-break: keep-all; }
  .home-copy em { font-style: normal; color: var(--accent); }
  .home-copy p { margin-top: 21px; color: var(--muted); word-break: keep-all; }
  .hero-art { display: grid; place-items: center; position: relative; overflow: hidden; min-height: clamp(300px, 39vw, 478px); isolation: isolate; border-radius: 25px; border: 1px solid #38505b; background: radial-gradient(#89c9c526 1px, transparent 1px), radial-gradient(ellipse at 53% 47%, #315e59, #17282f 72%); background-size: 17px 17px, auto; box-shadow: 0 24px 52px #080c1050; }
  .hero-disc { position: absolute; width: min(68%, 338px); aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 40% 24%, #c4e8cf, #79aaa0 70%, #5b9286); box-shadow: 0 0 0 14px #a4eed312, 0 0 0 30px #a4eed30a; }
  .hero-spark { position: absolute; color: var(--gold); font-size: 2.55rem; line-height: 1; }
  .spark-one { top: 12%; right: 13%; }.spark-two { bottom: 12%; left: 13%; font-size: 2.3rem; }
  .hero-card { grid-area: 1 / 1; display: grid; place-items: center; width: clamp(84px, 12vw, 153px); aspect-ratio: .74; border: 1px solid #fffdf3; border-radius: 13px; background: linear-gradient(150deg, #fcfaf1, #e9e8e0); box-shadow: 3px 5px 0 #55635e, 8px 15px 26px #101b20a0; }
  .hero-card canvas { width: 73%; height: auto; }
  .hero-card-0 { transform: translate(-76%, 6%) rotate(-18deg); }
  .hero-card-1 { z-index: 1; transform: translateY(-10%) rotate(1deg); }
  .hero-card-2 { transform: translate(77%, 8%) rotate(18deg); }

  .route-panel { width: min(100%, 477px); margin: clamp(25px, 9svh, 86px) auto 40px; padding: clamp(16px, 5vw, 32px); background: linear-gradient(145deg, #1b2931, var(--surface) 70%); border: 1px solid var(--line); border-radius: 19px; box-shadow: 0 18px 44px #080c1060; }
  .route-panel h1 { margin: 13px 0 10px; font-size: clamp(1.9rem, 5vw, 2.55rem); letter-spacing: -.07em; }
  .route-panel p { margin: 10px 0 17px; color: var(--muted); word-break: keep-all; }
  .route-panel > button { width: 100%; }
  .join-form, .invite { display: flex; align-items: center; gap: 8px; }
  input, output { width: 100%; min-width: 0; padding: 9px 10px; border: 1px solid var(--line-strong); border-radius: 8px; background: #101a21; color: var(--ink); }
  .join-form input { min-height: 47px; text-transform: uppercase; }
  .invite { align-items: stretch; flex-wrap: wrap; }
  .invite output { flex: 1 1 142px; width: auto; display: grid; align-items: center; font: 800 .9rem/1.4 var(--mono); color: var(--accent); letter-spacing: .045em; overflow-wrap: anywhere; }
  .invite .small-button { flex: 0 1 auto; max-width: 100%; }
  .invite + input { margin-top: 8px; }
  .notice { color: var(--muted); font-size: .875rem; margin-top: 9px; }
  .roster-title { display: flex; justify-content: space-between; margin-top: 20px; }
  .roster-title strong { color: var(--accent); }
  .roster { list-style: none; padding: 0; margin: 9px 0 14px; max-height: 220px; overflow: auto; }
  .roster li { display: flex; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: .875rem; }
  .roster strong { color: var(--accent); }
  .connection { display: inline-flex; align-items: center; gap: 6px; padding: 2px 7px; border: 1px solid var(--line-strong); border-radius: 99px; color: var(--muted); font-size: .8125rem; white-space: nowrap; }
  .connection[data-online='true'] { color: var(--accent); border-color: #416762; background: #223936; }
  .connection[data-online='true']::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }

  .play-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 9px; width: fit-content; max-width: 100%; margin-inline: auto; padding: 14px 0 28px; }
  .table { min-width: 0; background: radial-gradient(#a4eed31c 1px, transparent 1px), linear-gradient(143deg, #20333b, #16232c 75%); background-size: 14px 14px, auto; border: 1px solid #38505b; border-radius: 18px; padding: clamp(8px, 1.5vw, 15px); box-shadow: 0 16px 38px #080c1050; }
  .table-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 1px 2px 9px; }
  .board-heading { flex-wrap: wrap; }
  .board-heading h1 { font-size: 1rem; white-space: nowrap; }
  .board-stats { display: flex; flex-wrap: wrap; gap: 3px 10px; margin-left: auto; font-size: .8125rem; color: var(--muted); }
  .board-stats > div { display: flex; align-items: baseline; gap: 3px; white-space: nowrap; }
  .board-stats dd { color: var(--accent); font-weight: 800; font-variant-numeric: tabular-nums; }
  .table-foot { min-height: 39px; font-size: .875rem; margin: 9px 2px 0; color: var(--muted); }
  .table-foot p { min-width: 0; overflow-wrap: anywhere; }
  .selection { display: flex; align-items: center; gap: 5px; padding: 4px 8px; border: 1px solid var(--line-strong); border-radius: 7px; font: 750 .875rem/1.4 var(--mono); background: #16262d; }
  .selection i { width: 6px; height: 6px; border: 1px solid #93abae; border-radius: 50%; }
  .selection i[data-filled='true'] { border-color: var(--accent); background: var(--accent); }
  .board-area { position: relative; }
  .board { --card-width: clamp(96px, calc((100svh - 224px) * .238), 182px); display: grid; grid-template-columns: repeat(var(--columns), minmax(0, var(--card-width))); justify-content: center; gap: clamp(6px, .85vw, 12px); }
  .playing-card { position: relative; display: block; min-width: 0; width: 100%; aspect-ratio: 5 / 7; padding: 0; border: 1px solid #fcfaf0; border-radius: clamp(6px, 1vw, 12px); background: linear-gradient(142deg, #fffdf5, var(--card)); color: #263b40; box-shadow: 0 3px 0 #95a2a1; touch-action: manipulation; }
  @media (hover: hover) { .playing-card[aria-pressed='false'][aria-disabled='false']:hover { background: #e7f7ee; } }
  .playing-card[data-extra='true'] { border-color: #e4bb78; box-shadow: 0 3px 0 #a78350; }
  .playing-card[aria-pressed='true'] { border-color: #7fc9ad; background: #d2f1e2; box-shadow: inset 0 0 0 2px #437d6b, 0 3px 0 #669283; }
  .playing-card kbd { position: absolute; z-index: 1; top: 7px; left: 7px; min-width: 20px; padding: 2px 4px; border-radius: 4px; background: #dfe8e3; color: #314b49; }
  .playing-card[data-extra='true'] kbd { background: #f0dfbd; color: #62431e; }
  .playing-card[aria-pressed='true'] kbd { background: #246451; color: #fff; }
  .playing-card canvas { position: absolute; top: 54%; left: 50%; transform: translate(-50%, -50%); display: block; width: 96%; height: auto; max-height: 86%; object-fit: contain; }
  .text-button { border: 0; padding: 7px 0; background: transparent; color: var(--ink); white-space: nowrap; }
  .text-button:disabled { opacity: .65; }
  .text-button kbd, .play-detail kbd { padding: 2px 4px; border: 1px solid currentColor; border-radius: 4px; }
  .finished { grid-column: 1 / -1; padding: 30px 5px; text-align: center; }
  .playing-card[data-burst='true'] { animation: lift .38s var(--delay) ease-in both; z-index: 1; }
  .playing-card[data-burst='true']::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(115deg, transparent 35%, #f0fff8 50%, transparent 65%); background-size: 250% 100%; animation: sweep .36s var(--delay) ease-out both; }
  .celebration { position: absolute; z-index: 4; inset: 0; display: grid; place-items: center; pointer-events: none; overflow: hidden; }
  .celebration strong { z-index: 1; padding: .04em .24em .1em; border: 2px solid var(--accent); border-radius: .15em; color: var(--accent); background: #14272c; box-shadow: 0 0 38px #a4eed353; font: 950 clamp(3rem, 11vw, 7rem)/1 system-ui; letter-spacing: -.09em; animation: pop .79s ease-out both; }
  .celebration i { --x: 95px; --y: -90px; position: absolute; width: 18px; height: 18px; clip-path: polygon(50% 0,63% 36%,100% 50%,63% 63%,50% 100%,37% 63%,0 50%,37% 36%); background: var(--gold); animation: glitter .75s ease-out both; }
  .celebration i:nth-child(3) { --x: -110px; --y: -70px; }.celebration i:nth-child(4) { --x: 142px; --y: 48px; }.celebration i:nth-child(5) { --x: -136px; --y: 44px; }.celebration i:nth-child(6) { --x: 60px; --y: 105px; }.celebration i:nth-child(7) { --x: -79px; --y: 95px; }
  @keyframes lift { 30% { transform: translateY(-4px) scale(1.06); box-shadow: 0 0 23px #a4eed3; } to { transform: translateY(-20px) scale(.79); opacity: 0; } }
  @keyframes sweep { from { background-position: 110%; } to { background-position: -30%; } }
  @keyframes pop { 0% { transform: scale(.62) rotate(-8deg); opacity: 0; } 26%, 72% { transform: scale(1) rotate(-4deg); opacity: 1; } 100% { transform: scale(1.03) rotate(-4deg); opacity: 0; } }
  @keyframes glitter { 0% { opacity: 0; transform: scale(.25); } 34% { opacity: 1; } to { opacity: 0; transform: translate(var(--x), var(--y)) rotate(85deg); } }

  .play-details { min-width: 0; contain: inline-size; color: var(--muted); }
  .play-details .compact-roster { display: flex; flex-wrap: wrap; gap: 5px; margin: 0 0 7px; }
  .play-details .compact-roster li { gap: 6px; padding: 2px 7px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); font-size: .8125rem; }
  .play-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
  .play-detail { min-width: 0; font-size: .875rem; }
  .play-detail[open] { flex: 1 0 100%; padding: 0 10px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
  .play-detail summary { padding: 4px 0; cursor: pointer; color: var(--muted); font-weight: 700; }
  .play-detail summary:hover { color: var(--accent); }
  .play-detail p { margin-top: 6px; word-break: keep-all; }
  .play-detail .invite { max-width: 365px; margin-top: 5px; }
  .examples { display: grid; grid-template-columns: repeat(3, 1fr); max-width: 140px; gap: 5px; margin-top: 7px; }
  .examples > div { display: grid; place-items: center; border: 1px solid #ebeae4; border-radius: 6px; background: var(--card); }
  .examples canvas { display: block; width: auto; height: 36px; }

  @media (max-width: 660px) {
    .topbar-inner { min-height: 54px; }
    .home { grid-template-columns: 1fr; min-height: auto; gap: 25px; padding: 29px 0 36px; }
    .home-copy p { margin-top: 13px; }
    .actions { margin-top: 17px; }
    .actions > a { flex: 1; }
    .hero-art { min-height: 0; aspect-ratio: 1.55; border-radius: 16px; }
    .hero-disc { width: min(52%, 240px); }
    .hero-card { width: clamp(71px, 23vw, 122px); border-radius: 9px; }
    .hero-spark { font-size: 1.7rem; }
    .play-layout { width: 100%; padding-top: 9px; }
    .table { border-radius: 12px; }
    .board { grid-template-columns: repeat(var(--columns), minmax(44px, 1fr)); justify-content: safe center; gap: 5px; overflow-x: auto; padding: 3px 2px 4px; }
    .playing-card kbd { top: 3px; left: 3px; min-width: 16px; padding: 1px 3px; font-size: .75rem; }
    .playing-card:focus-visible { outline-offset: -2px; }
    .table-foot { flex-wrap: wrap; }
    .small-button { min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .celebration strong, .playing-card[data-burst='true'] { animation: none; }
    .celebration i { display: none; }
  }
`;
