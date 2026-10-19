import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AdaptiveQuality, parseQualityRequest, PIXELS_1080P, PIXELS_720P, QUALITY_PRESETS, resolveBacking,
} from '../src/core/quality.ts';

const VIEW_W = 960;
const VIEW_H = 540;

test('1080p 视口 dpr=1 时不被截断', () => {
  const b = resolveBacking(VIEW_W, VIEW_H, 2, 1, PIXELS_1080P);
  assert.equal(b.width, 1920);
  assert.equal(b.height, 1080);
  assert.equal(b.capped, false);
});

test('dpr=2 时 backing 被限制到像素上限内', () => {
  const b = resolveBacking(VIEW_W, VIEW_H, 2, 2, PIXELS_1080P);
  assert.ok(b.width * b.height <= PIXELS_1080P);
  assert.equal(b.capped, true);
  assert.equal(b.width, 1920);
  assert.equal(b.height, 1080);
});

test('high 档不设上限，低档更小', () => {
  const hi = resolveBacking(VIEW_W, VIEW_H, 2, 2, QUALITY_PRESETS.high.maxPixels);
  const lo = resolveBacking(VIEW_W, VIEW_H, 2, 2, QUALITY_PRESETS.low.maxPixels);
  assert.equal(hi.width, 3840);
  assert.equal(hi.height, 2160);
  assert.ok(lo.width * lo.height <= PIXELS_720P);
  assert.ok(lo.width < hi.width);
});

test('任意窗口尺寸下都不超过上限，且保持 16:9', () => {
  for (const css of [0.5, 1, 1.333, 2, 3.5, 6]) {
    for (const dpr of [1, 1.5, 2, 3]) {
      const b = resolveBacking(VIEW_W, VIEW_H, css, dpr, PIXELS_1080P);
      assert.ok(b.width * b.height <= PIXELS_1080P + 4096, `css=${css} dpr=${dpr} ${b.width}x${b.height}`);
      assert.ok(Math.abs(b.width / b.height - VIEW_W / VIEW_H) < 0.01);
      assert.ok(b.width >= 1 && b.height >= 1);
    }
  }
});

test('画质档位只动渲染参数', () => {
  for (const mode of ['high', 'med', 'low'] as const) {
    const q = QUALITY_PRESETS[mode];
    assert.equal(q.mode, mode);
    assert.ok(q.bgLayers >= 1 && q.bgLayers <= 3);
  }
  assert.equal(QUALITY_PRESETS.low.bgLayers, 2);
  assert.equal(QUALITY_PRESETS.low.ambient, false);
  assert.equal(QUALITY_PRESETS.low.postFx, false);
});

test('?q= 解析', () => {
  assert.equal(parseQualityRequest('low'), 'low');
  assert.equal(parseQualityRequest('HIGH'), 'high');
  assert.equal(parseQualityRequest('auto'), 'auto');
  assert.equal(parseQualityRequest(null), null);
  assert.equal(parseQualityRequest('ultra'), null);
});

test('自适应只降不升，且到最低档后不再切换', () => {
  const a = new AdaptiveQuality(['high', 'med', 'low']);
  assert.equal(a.current, 'high');
  // 稳定 16ms：不降档
  for (let i = 0; i < a.window; i++) assert.equal(a.sample(16), null);
  assert.equal(a.current, 'high');
  // 持续 40ms：降到 med
  let next: string | null = null;
  for (let i = 0; i < a.window + a.cooldownFrames + 10; i++) { const r = a.sample(40); if (r) { next = r; break; } }
  assert.equal(next, 'med');
  assert.equal(a.current, 'med');
  // 再持续掉帧：降到 low
  next = null;
  for (let i = 0; i < a.window + a.cooldownFrames + 10; i++) { const r = a.sample(40); if (r) { next = r; break; } }
  assert.equal(next, 'low');
  // 已经最低：不再切换
  for (let i = 0; i < a.window * 3; i++) assert.equal(a.sample(80), null);
  assert.equal(a.current, 'low');
});

test('自适应在预算内不会因为单帧尖峰降档', () => {
  const a = new AdaptiveQuality(['high', 'med', 'low']);
  for (let i = 0; i < a.window * 2; i++) assert.equal(a.sample(14), null);
  assert.equal(a.current, 'high');
});

test('单帧卡顿（切层/GC/回前台）不算稳定掉帧', () => {
  const a = new AdaptiveQuality(['high', 'med', 'low']);
  for (let i = 0; i < a.window; i++) {
    assert.equal(a.sample(i % 10 === 0 ? 400 : 14), null);
  }
  assert.equal(a.current, 'high');
});
