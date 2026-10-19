// 浏览器回归检查：把「只在真实浏览器里才能验证」的行为固化成可重复的断言。
//   node tools/perf/regress.mjs [url]
// 覆盖：backing 像素上限、draw 无生成粒子副作用、粒子硬上限、出口光尘改由 update 生成、
//       练习局记录、输入生命周期、主循环预算。
// 页面会带上 ?debug（测试钩子只在 debug 下暴露）。只依赖 Playwright。

import { loadPlaywright } from './pw.mjs';

const base = process.argv[2] || 'http://localhost:5399/';
// 测试钩子只在 ?debug 下暴露；URL 可能已经带了 q 等参数。
const u = new URL(base);
if (!u.searchParams.has('debug')) u.searchParams.set('debug', '');
const url = u.toString();
const dpr = Number(process.env.DPR || 2);
const CAP = 512; // 与 src/render/particles.ts 的 MAX_PARTICLES 一致

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(400);

// 0. 测试钩子存在（说明 ?debug 生效）
const hooks = await page.evaluate(() => ({
  game: !!window.__game, quality: !!window.__quality, input: !!window.__input,
  loop: !!window.__loop, cap: window.__particleCap,
}));
check('?debug 下测试钩子可用', hooks.game && hooks.quality && hooks.input && hooks.loop, JSON.stringify(hooks));

// 1. backing store 像素上限：高 DPR 下不允许长到 4K 级别
const cap = await page.evaluate(() => {
  const cv = document.querySelector('canvas');
  const q = window.__quality;
  return { w: cv.width, h: cv.height, max: q.maxPixels === null ? Infinity : q.maxPixels, mode: q.mode };
});
check(
  `backing store 受像素上限约束 (dpr=${dpr})`,
  cap.w * cap.h <= cap.max,
  `${cap.w}x${cap.h}=${(cap.w * cap.h / 1e6).toFixed(2)}M <= ${(cap.max / 1e6).toFixed(2)}M mode=${cap.mode}`,
);

// 2. draw 不再有生成粒子的副作用：各种「只画不更新」的状态下狂画 6000 帧。
//    这里画进一块很小的离屏画布——我们只关心粒子计数这个副作用，不需要真像素；
//    否则 5 × 6000 次全分辨率绘制在软件光栅下要跑十几分钟。
const leak = await page.evaluate((states) => {
  const g = window.__game;
  const tiny = document.createElement('canvas');
  tiny.width = 240; tiny.height = 135;
  const c = tiny.getContext('2d');
  const out = {};
  for (const st of states) {
    g.startRun(99, 0);
    g.state = st;
    const before = g.level.particles.list.length;
    for (let i = 0; i < 6000; i++) g.draw(c);
    out[st] = { before, after: g.level.particles.list.length };
  }
  return out;
}, ['pause', 'read', 'dead', 'rest', 'victory']);
for (const st of ['pause', 'read', 'dead', 'rest', 'victory']) {
  const r = leak[st];
  check(`状态 ${st}：6000 次 draw 后粒子不增长`, r.after <= r.before, `${r.before} -> ${r.after}`);
}

// 3. 粒子硬上限：超额生成时截断，且保留最新的一批
const stress = await page.evaluate((cap) => {
  const L = window.__game.level;
  L.particles.list.length = 0;
  for (let i = 0; i < 1000; i++) L.particles.spawn({ x: i, y: 0, life: 5 });
  const list = L.particles.list;
  const newest = list[list.length - 1].x;
  const oldest = list[0].x;
  // 再生成一批，确认仍然有界
  for (let i = 0; i < 1000; i++) L.particles.spawn({ x: 1000 + i, y: 0, life: 5 });
  return { len: list.length, newest, oldest, again: L.particles.list.length, cap };
}, CAP);
check(
  `超额生成 1000 粒后仍被硬上限截断`,
  stress.len === stress.cap && stress.again === stress.cap,
  `len=${stress.len} again=${stress.again} cap=${stress.cap}`,
);
check(
  '上限截断保留最新粒子（顶掉最旧的）',
  stress.newest === 999 && stress.oldest === 1000 - stress.cap,
  `newest=${stress.newest} oldest=${stress.oldest}`,
);

// 4. 出口光尘：固定 seed 找到带出口的层，隔离计数 + 反向对照
const exitFx = await page.evaluate(() => {
  const g = window.__game;
  let seed = null;
  for (let s = 1; s <= 60; s++) {
    g.startRun(s, 0);
    if (g.level.data.exitX !== null && g.level.data.exitY !== null) { seed = s; break; }
  }
  if (seed === null) return { seed: null };
  const L = g.level;
  g.state = 'play';
  const run = (steps) => {
    L.particles.list.length = 0;
    for (let i = 0; i < steps; i++) L.update(1 / 120);
    return L.particles.list.length;
  };
  const withExit = run(240); // 2 秒
  const exitX = L.data.exitX, exitY = L.data.exitY;
  L.data.exitX = null; L.data.exitY = null;
  const withoutExit = run(240);
  L.data.exitX = exitX; L.data.exitY = exitY;
  return { seed, withExit, withoutExit, firstStep: run(1) };
});
check(
  '出口光尘由 update 按 dt 生成（反向对照为 0）',
  exitFx.seed !== null && exitFx.withExit > 0 && exitFx.withoutExit === 0,
  exitFx.seed === null ? '未找到带出口的种子' : `seed=${exitFx.seed} withExit=${exitFx.withExit} withoutExit=${exitFx.withoutExit}`,
);
check(
  '出口光尘速率与 dt 挂钩（单步不刷满）',
  exitFx.seed !== null && exitFx.firstStep <= 1,
  `1 步后 ${exitFx.firstStep} 粒`,
);

// 5. 练习局不计入记录（victory 里 bestDepth 被顶满的旧 bug）
const practice = await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('huifeng_save');
  g.save = { bestDepth: 0, bestTime: null, wins: 0 };
  g.startRun(99, 3); // depth > 0 => practice
  const isPractice = g.run.practice;
  g.victory();
  const afterPractice = JSON.parse(JSON.stringify(g.save));
  localStorage.removeItem('huifeng_save');
  g.save = { bestDepth: 0, bestTime: null, wins: 0 };
  g.startRun(99, 0);
  g.run.time = 42;
  g.victory();
  const afterReal = JSON.parse(JSON.stringify(g.save));
  return { isPractice, afterPractice, afterReal, stored: localStorage.getItem('huifeng_save') };
});
check(
  '练习局通关不写 bestDepth / wins',
  practice.isPractice && practice.afterPractice.bestDepth === 0 && practice.afterPractice.wins === 0,
  JSON.stringify(practice.afterPractice),
);
check(
  '正常通关写入满层与胜场',
  practice.afterReal.bestDepth === 6 && practice.afterReal.wins === 1 && practice.afterReal.bestTime === 42,
  JSON.stringify(practice.afterReal),
);

// 6. 输入生命周期：切后台 / 失焦后不留住按键（held + 缓冲）
const life = await page.evaluate(() => {
  const i = window.__input;
  const hold = () => dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
  hold();
  const heldBefore = i.held('left');
  dispatchEvent(new Event('visibilitychange'));
  const heldAfterVis = i.held('left');
  // 切后台时缓冲也应该被清掉：这里不再补按键，consume 必须是 false
  const consumedAfterVis = i.consume('left');
  hold();
  dispatchEvent(new Event('blur'));
  const heldAfterBlur = i.held('left');
  return { heldBefore, heldAfterVis, consumedAfterVis, heldAfterBlur };
});
check('切后台后按住状态与缓冲都被清空', life.heldBefore && !life.heldAfterVis && !life.consumedAfterVis, JSON.stringify(life));
check('失焦后按住状态被清空', !life.heldAfterBlur, `afterBlur=${life.heldAfterBlur}`);

// 7. 主循环预算常量
const loop = await page.evaluate(() => window.__loop);
check('单帧最多 0.1s / 12 个子步', loop.maxFrame === 0.1 && loop.maxSubsteps === 12, JSON.stringify(loop));

check('页面没有运行时错误', errors.length === 0, errors.join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
