import { useLayoutEffect, useRef } from 'react';
import type { Card } from '../shared/game';

type Art = Omit<Card, 'id'>;

const COLORS = ["#16744b", "#bf3140", "#723eb2"];
const COLOR_NAMES = ["초록색", "빨간색", "보라색"];
const SHAPE_NAMES = ["타원", "마름모", "물결"];
const FILL_NAMES = ["채움", "줄무늬", "테두리"];
function makeShape(context: CanvasRenderingContext2D, shape: number, y: number) {
  context.beginPath();
  if (shape === 0) {
    context.roundRect(9, y - 10, 54, 20, 10);
  } else if (shape === 1) {
    context.moveTo(36, y - 11);
    context.lineTo(64, y);
    context.lineTo(36, y + 11);
    context.lineTo(8, y);
  } else {
    context.moveTo(10, y + 6);
    context.bezierCurveTo(5, y - 2, 13, y - 12, 24, y - 11);
    context.bezierCurveTo(34, y - 11, 42, y - 2, 52, y - 6);
    context.bezierCurveTo(59, y - 9, 61, y - 12, 63, y - 7);
    context.bezierCurveTo(68, y + 3, 59, y + 12, 48, y + 11);
    context.bezierCurveTo(38, y + 11, 29, y + 2, 19, y + 6);
    context.bezierCurveTo(15, y + 8, 12, y + 11, 10, y + 6);
  }
  context.closePath();
}

function drawSymbols(canvas: HTMLCanvasElement, card: Art) {
  const ratio = Math.max(2, window.devicePixelRatio || 1);
  canvas.width = 72 * ratio;
  canvas.height = 98 * ratio;
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(canvas.width / 72, canvas.height / 98);
  context.lineJoin = "round";
  context.fillStyle = COLORS[card.color];
  context.strokeStyle = COLORS[card.color];

  for (let i = 0; i <= card.count; i++) {
    const y = 49 + (i - card.count / 2) * 27;
    makeShape(context, card.shape, y);
    if (card.fill === 0) {
      context.fill();
      continue;
    }

    context.lineWidth = 2;
    context.stroke();
    if (card.fill === 1) {
      context.save();
      context.clip();
      context.beginPath();
      for (let x = 8; x <= 64; x += 3.2) {
        context.moveTo(x, y - 12);
        context.lineTo(x, y + 12);
      }
      context.lineWidth = .95;
      context.stroke();
      context.restore();
    }
  }
}


export function describeCard(card: Card) {
  return `${COLOR_NAMES[card.color]} ${SHAPE_NAMES[card.shape]} ${card.count + 1}개, ${FILL_NAMES[card.fill]}`;
}

export function CardArt({ card }: { card: Art }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (canvas.current) drawSymbols(canvas.current, card);
  }, [card]);
  return <canvas ref={canvas} aria-hidden="true" />;
}
