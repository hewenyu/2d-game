import { DEBUG, VIEW_H, VIEW_W } from './config';
import { initAudio } from './core/audio';
import { input } from './core/input';
import { MAX_FRAME_SECONDS, MAX_SUBSTEPS, planSubsteps } from './core/loop';
import {
  AdaptiveQuality, applyQuality, DEFAULT_MODE, parseQualityRequest, quality, resolveBacking,
} from './core/quality';
import { Game } from './game/game';
import { MAX_PARTICLES } from './render/particles';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let scale = 1;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  scale = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  // 逻辑视口不变，只限制设备像素总数（高 DPR 大窗口下 backing 会长到 4K 级）。
  const b = resolveBacking(VIEW_W, VIEW_H, scale, dpr, quality.maxPixels);
  canvas.width = b.width;
  canvas.height = b.height;
}
addEventListener('resize', resize);
resize();

input.attach(canvas);
input.onAnyKey = () => initAudio();
canvas.focus();

const game = new Game();
const requested = parseQualityRequest(new URLSearchParams(location.search).get('q'));
const adaptive = requested === 'auto' ? new AdaptiveQuality(['high', 'med', 'low']) : null;
applyQuality(adaptive ? adaptive.current : (requested === null || requested === 'auto' ? DEFAULT_MODE : requested));
resize();

let last = performance.now();
/** 画质切换 / 回到前台后的稳定期帧数：这段时间的帧时间不喂给自适应 */
let warmup = adaptive ? 60 : 0;

function frame(now: number) {
  const interval = now - last;
  last = now;
  // 切到后台时不做模拟也不绘制：回来时重置时钟，避免补一大堆帧。
  if (document.hidden) { requestAnimationFrame(frame); return; }
  const plan = planSubsteps(interval / 1000);
  for (let i = 0; i < plan.steps; i++) game.update(plan.sub);
  // 用 backing store 反推缩放：像素上限生效时它不等于 scale * dpr。
  ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
  game.draw(ctx);
  // 自适应看的是真实帧间隔（含 rAF 排队、光栅与 GPU 回压），不是同步提交耗时：
  // 软件光栅下瓶颈在提交之后，只测同步时间会完全漏掉。
  if (adaptive && warmup > 0) warmup--;
  else if (adaptive) {
    const next = adaptive.sample(interval);
    if (next) { applyQuality(next); resize(); warmup = 60; }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 切到后台再回来时不要补一堆帧：重置时钟、清掉按住/缓冲的输入，并留出稳定期。
addEventListener('visibilitychange', () => {
  last = performance.now();
  warmup = 60;
  input.reset();
});

// 供自动化测试使用。__game 一直是公开的测试入口；其余钩子只在 ?debug 下暴露。
const testHooks = window as unknown as {
  __game: Game;
  __quality?: typeof quality;
  __loop?: { maxFrame: number; maxSubsteps: number };
  __input?: typeof input;
  __particleCap?: number;
};
testHooks.__game = game;
if (DEBUG) {
  testHooks.__quality = quality;
  testHooks.__loop = { maxFrame: MAX_FRAME_SECONDS, maxSubsteps: MAX_SUBSTEPS };
  testHooks.__input = input;
  testHooks.__particleCap = MAX_PARTICLES;
}
