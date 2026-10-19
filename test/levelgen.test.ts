import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHAPTERS } from '../src/data/chapters.ts';
import { ROOM_H, ROOM_W } from '../src/config.ts';
import { generateLevel } from '../src/world/levelgen.ts';

const cfg = CHAPTERS[0].levels[0];

function tiles(seed: number) {
  return generateLevel(cfg, seed).map.data.slice();
}

test('同一种子生成完全相同的关卡', () => {
  const a = generateLevel(cfg, 99);
  const b = generateLevel(cfg, 99);
  assert.deepEqual(Array.from(a.map.data), Array.from(b.map.data));
  assert.deepEqual(a.start, b.start);
  assert.equal(a.exitX, b.exitX);
  assert.equal(a.exitY, b.exitY);
  assert.equal(a.seed, b.seed);
});

test('不同种子生成不同关卡', () => {
  const a = tiles(99);
  const b = tiles(100);
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  assert.ok(diff > a.length * 0.01, `差异格子过少: ${diff}/${a.length}`);
});

test('地图尺寸与房间网格一致，起点站在地面上', () => {
  const d = generateLevel(cfg, 7);
  assert.equal(d.map.w, cfg.cols * ROOM_W);
  assert.equal(d.map.h, cfg.rows * ROOM_H);
  // start 是脚底坐标：站立格为空，脚下是实心地面
  const tx = Math.floor(d.start.x / 32);
  const standTy = Math.floor(d.start.y / 32) - 1;
  assert.notEqual(d.map.get(tx, standTy), 1, '站立格是实心');
  assert.equal(d.map.get(tx, standTy + 1), 1, '脚下没有地面');
});

test('普通关卡都包含出口坐标', () => {
  // 注意：这只验证生成结果里有出口；可达性由生成器内部的 BFS 校验保证，不在此重复证明。
  for (const seed of [1, 2, 3, 17, 99, 1234]) {
    const d = generateLevel(cfg, seed);
    assert.ok(d.exitX !== null && d.exitY !== null, `seed=${seed} 没有出口`);
  }
});

test('生成的敌人都在地图范围内', () => {
  for (const seed of [4, 5, 6]) {
    const d = generateLevel(cfg, seed);
    for (const s of d.spawns) {
      assert.ok(s.x >= 0 && s.x <= d.map.pxW, `seed=${seed} spawn.x=${s.x}`);
      assert.ok(s.y >= 0 && s.y <= d.map.pxH, `seed=${seed} spawn.y=${s.y}`);
    }
  }
});
