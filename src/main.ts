import { VIEW_H, VIEW_W } from './config';
import { initAudio } from './core/audio';
import { input } from './core/input';
import { Game } from './game/game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let scale = 1, dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  scale = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  canvas.width = Math.floor(VIEW_W * scale * dpr);
  canvas.height = Math.floor(VIEW_H * scale * dpr);
}
addEventListener('resize', resize);
resize();

input.attach(canvas);
input.onAnyKey = () => initAudio();
canvas.focus();

const game = new Game();
const STEP = 1 / 120;
let last = performance.now();

function frame(now: number) {
  // 半固定步长：把这一帧的真实时长均分成若干个不超过 STEP 的子步。
  // 纯固定步长在帧间隔抖动时会出现「这帧跑 1 步、下帧跑 3 步」，画面一顿一顿的。
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (dt > 0) {
    const n = Math.max(1, Math.ceil(dt / STEP - 0.01));
    for (let i = 0; i < n; i++) game.update(dt / n);
  }
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  game.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 供自动化测试使用
(window as unknown as { __game: Game }).__game = game;
