import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_FRAME_SECONDS, MAX_SUBSTEPS, PHYSICS_STEP, planSubsteps } from '../src/core/loop.ts';

test('子步时长恒不超过 1/120 秒', () => {
  const inputs = [1 / 240, 1 / 120, 1 / 60, 1 / 30, 0.05, 0.099, 0.1, 0.25, 1, 12.5, 1e6];
  for (const dt of inputs) {
    const p = planSubsteps(dt);
    assert.ok(p.sub <= PHYSICS_STEP + 1e-12, `dt=${dt} sub=${p.sub}`);
    assert.ok(p.steps <= MAX_SUBSTEPS, `dt=${dt} steps=${p.steps}`);
    assert.ok(p.dt <= MAX_FRAME_SECONDS + 1e-12);
  }
});

test('60fps 与 30fps 分别拆成 2 / 4 个子步', () => {
  assert.equal(planSubsteps(1 / 60).steps, 2);
  assert.equal(planSubsteps(1 / 30).steps, 4);
  assert.ok(Math.abs(planSubsteps(1 / 60).sub - PHYSICS_STEP) < 1e-12);
});

test('超长帧被截断，且子步数封顶', () => {
  const p = planSubsteps(10);
  assert.equal(p.dt, MAX_FRAME_SECONDS);
  assert.equal(p.steps, MAX_SUBSTEPS);
  assert.ok(p.sub <= PHYSICS_STEP + 1e-12);
});

test('非正或非法时长不推进', () => {
  for (const dt of [0, -1, Number.NaN]) {
    const p = planSubsteps(dt);
    assert.equal(p.steps, 0);
    assert.equal(p.dt, 0);
  }
});

test('刚好一帧的抖动不会多跑一个子步', () => {
  // 边界必须严格：dt 只要超过 step 就不能只跑 1 个子步，否则 sub > 1/120。
  assert.equal(planSubsteps(PHYSICS_STEP).steps, 1);
  assert.equal(planSubsteps(PHYSICS_STEP).sub, PHYSICS_STEP);
  const over = planSubsteps(PHYSICS_STEP + 1e-9);
  assert.equal(over.steps, 2);
  assert.ok(over.sub <= PHYSICS_STEP);
  assert.equal(planSubsteps(PHYSICS_STEP * 2).steps, 2);
  assert.equal(planSubsteps(PHYSICS_STEP * 2 + 1e-9).steps, 3);
});

test('扫描 dt 全域：子步时长始终 <= 1/120', () => {
  for (let i = 1; i <= 12000; i++) {
    const dt = i * 1e-5; // 0.00001s .. 0.12s
    const p = planSubsteps(dt);
    assert.ok(p.sub <= PHYSICS_STEP, `dt=${dt} steps=${p.steps} sub=${p.sub}`);
    assert.ok(p.steps <= MAX_SUBSTEPS);
    assert.ok(p.steps * p.sub <= p.dt + 1e-12);
  }
  // 边界：刚好等于子步数上限对应的时间
  const edge = planSubsteps(PHYSICS_STEP * MAX_SUBSTEPS);
  assert.equal(edge.steps, MAX_SUBSTEPS);
  assert.equal(edge.dt, MAX_FRAME_SECONDS);
  assert.ok(edge.sub <= PHYSICS_STEP);
});
