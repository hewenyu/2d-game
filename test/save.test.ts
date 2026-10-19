import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSave, parseSave, recordLevelReached, recordVictory } from '../src/game/save.ts';

const TOTAL = 6;

test('练习局通关不写入任何记录', () => {
  const save = defaultSave();
  const changed = recordVictory(save, { practice: true, time: 1 }, TOTAL);
  assert.equal(changed, false);
  assert.deepEqual(save, { bestDepth: 0, bestTime: null, wins: 0 });
});

test('正常通关写入胜场、时间与满层记录', () => {
  const save = defaultSave();
  assert.equal(recordVictory(save, { practice: false, time: 120 }, TOTAL), true);
  assert.equal(save.wins, 1);
  assert.equal(save.bestTime, 120);
  assert.equal(save.bestDepth, TOTAL);
});

test('更好的通关时间才会覆盖最佳时间', () => {
  const save = defaultSave();
  recordVictory(save, { practice: false, time: 200 }, TOTAL);
  recordVictory(save, { practice: false, time: 150 }, TOTAL);
  assert.equal(save.bestTime, 150);
  recordVictory(save, { practice: false, time: 300 }, TOTAL);
  assert.equal(save.bestTime, 150);
  assert.equal(save.wins, 3);
});

test('进入新层时练习局不更新 bestDepth', () => {
  const save = defaultSave();
  assert.equal(recordLevelReached(save, { practice: true, depth: 4 }), false);
  assert.equal(save.bestDepth, 0);
  assert.equal(recordLevelReached(save, { practice: false, depth: 2 }), true);
  assert.equal(save.bestDepth, 2);
  assert.equal(recordLevelReached(save, { practice: false, depth: 1 }), false);
  assert.equal(save.bestDepth, 2);
});

test('损坏的存档回落到默认值', () => {
  assert.deepEqual(parseSave('{'), defaultSave());
  assert.deepEqual(parseSave(null), defaultSave());
  assert.deepEqual(parseSave(undefined), defaultSave());
  assert.deepEqual(parseSave('{"bestDepth":3}'), { bestDepth: 3, bestTime: null, wins: 0 });
});

test('字段类型不对时按默认值处理，不把字符串当数字', () => {
  assert.deepEqual(parseSave('{"wins":"31"}'), defaultSave());
  assert.deepEqual(parseSave('{"bestDepth":"5"}'), defaultSave());
  assert.deepEqual(parseSave('{"bestDepth":-5,"wins":-1}'), defaultSave());
  assert.deepEqual(parseSave('{"bestDepth":null,"wins":null,"bestTime":null}'), defaultSave());
  assert.deepEqual(parseSave('{"bestTime":-1}'), { bestDepth: 0, bestTime: null, wins: 0 });
  assert.deepEqual(parseSave('{"bestTime":"12"}'), { bestDepth: 0, bestTime: null, wins: 0 });
  assert.deepEqual(parseSave('"nope"'), defaultSave());
  assert.deepEqual(parseSave('123'), defaultSave());
  assert.deepEqual(parseSave('{"bestDepth":2.7,"wins":3.9,"bestTime":12.5}'), { bestDepth: 2, bestTime: 12.5, wins: 3 });
  assert.deepEqual(parseSave('{"bestDepth":1e309}'), defaultSave());
});
