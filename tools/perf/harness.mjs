// 浏览器性能测量 harness（baseline 与 candidate 用同一个脚本，输出可成对比较）。
//
// 早期临时基准脚本的两个测量错误，本脚本修正：
//   1. 分段计时前把 canvas transform 重置成 1x，第 2 帧起的 bg/terrain/front 都在
//      1x 而不是真实设备缩放下绘制，数字被严重低估。这里每次绘制前都按 canvas 实际
//      backing store 反推缩放：setTransform(w/960, 0, 0, h/540, 0, 0)。用 backing 反推
//      而不是重算 scale*dpr，是为了在改了 backing 尺寸上限之后仍然测真实设备像素。
//   2. 旧脚本没有真实帧时间。这里用两个独立 page：isoPage 从 init 起关掉 rAF
//      （完全由脚本驱动 update/draw），livePage 保持原生 rAF 循环（测真实帧间隔）。
//      rAF 一旦被 patch，游戏自己的循环不会再被唤醒，所以两个场景必须用不同的 page。
//
// 计量口径：
//   isolated.*  —— 每个绘制段结束后用 getImageData(0,0,1,1) 强制光栅（flush=1），
//                  测的是「提交 + 光栅」的总时间；update 固定 2 个子步。
//   raf.*       —— 原生 rAF 循环，不 flush，测的是真实帧间隔（含排队/光栅/GPU 回压）、
//                  每帧 update 总和、单次 draw 与每帧子步数。两者口径不同，不要混着比。
//
// 用法：
//   node tools/perf/harness.mjs --url http://localhost:5391/ --dprs 1,2 --depths 0,2,3,5
//   node tools/perf/harness.mjs --url http://localhost:5399/ --q low --debug --json out.json
//   PW_MODULE=/abs/path/playwright/index.mjs node tools/perf/harness.mjs
//
// 范围：默认是 headless chromium（不带 channel/args）+ 强制读回，脚本不自动判定是否在用
// GPU；CH=chromium 之类可以覆盖成带 GPU 的浏览器，但那种结果必须由调用方自行声明。

import { loadPlaywright } from './pw.mjs';

const argv = process.argv.slice(2);
function arg(name, dflt) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
const has = (name) => argv.includes(`--${name}`);

function withParams(base, params) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

const baseUrl = arg('url', 'http://localhost:5391/');
const url = withParams(baseUrl, { q: arg('q', ''), debug: has('debug') ? '1' : '' });
const dprs = arg('dprs', '1,2').split(',').map(Number);
const depths = arg('depths', '0,2,3,5').split(',').map(Number);
const frames = Number(arg('frames', '60'));
const jsonPath = arg('json', '');
const channel = process.env.CH || '';
const launchArgs = (process.env.ARGS || '').split(' ').filter(Boolean);
const viewport = { width: Number(arg('vw', '1920')), height: Number(arg('vh', '1080')) };

const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const fmt = (arr) => (arr.length ? `${pct(arr, 0.5).toFixed(2)}/${pct(arr, 0.95).toFixed(2)}` : 'n/a');

// 页面内：按实际 backing store 反推 base transform，与 src/main.ts 的渲染路径一致。
const PAGE_HELPERS = `
  window.__perf = {
    base(ctx, cv) {
      const sx = cv.width / 960, sy = cv.height / 540;
      ctx.setTransform(sx, 0, 0, sy, 0, 0);
      return [sx, sy];
    },
    flush(ctx) { ctx.getImageData(0, 0, 1, 1); },
  };
`;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, channel: channel || undefined, args: launchArgs });
const env = {
  url,
  browserVersion: browser.version(),
  channel: channel || 'bundled-headless',
  args: launchArgs,
  headless: true,
  os: `${process.platform} ${process.arch} (${process.version})`,
  viewport,
  frames,
  flush: 'isolated segments only: getImageData(0,0,1,1); raf phase is submission-only',
  note: 'default: headless chromium + forced readback; GPU usage is not auto-detected',
};
console.log(JSON.stringify(env));

const results = [];

for (const dpr of dprs) {
  const isoPage = await browser.newPage({ viewport, deviceScaleFactor: dpr });
  await isoPage.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await isoPage.addInitScript(PAGE_HELPERS);
  await isoPage.goto(url, { waitUntil: 'load' });
  await isoPage.waitForTimeout(400);

  const livePage = await browser.newPage({ viewport, deviceScaleFactor: dpr });
  await livePage.addInitScript(PAGE_HELPERS);
  await livePage.goto(url, { waitUntil: 'load' });
  await livePage.waitForTimeout(400);

  for (const depth of depths) {
    const loadMs = await isoPage.evaluate((d) => {
      const a = performance.now();
      window.__game.startRun(99, d);
      return performance.now() - a;
    }, depth);
    await isoPage.waitForTimeout(700);

    const iso = await isoPage.evaluate((n) => {
      const g = window.__game;
      const cv = document.querySelector('canvas');
      const c = cv.getContext('2d');
      const { base, flush } = window.__perf;
      const L = g.level;
      const seg = { update: [], draw: [], back: [], terrain: [], front: [] };
      let transform = null;
      for (let i = 0; i < n; i++) {
        let a = performance.now();
        g.update(1 / 120); g.update(1 / 120);
        seg.update.push(performance.now() - a);
        transform = base(c, cv);
        a = performance.now(); g.draw(c); flush(c); seg.draw.push(performance.now() - a);
        base(c, cv);
        a = performance.now(); L.bg.drawBack(c, L.cam, L.time); flush(c); seg.back.push(performance.now() - a);
        base(c, cv);
        a = performance.now(); L.cam.begin(c); L.terrain.draw(c, L.cam); L.cam.end(c); flush(c); seg.terrain.push(performance.now() - a);
        base(c, cv);
        a = performance.now(); L.bg.drawFront(c, L.cam, L.time); flush(c); seg.front.push(performance.now() - a);
      }
      const layers = L.bg.layers.map((l) => [l.canvas.width, l.canvas.height]);
      return {
        seg, transform,
        backing: [cv.width, cv.height],
        css: [cv.style.width, cv.style.height],
        layers,
        layerMB: +(layers.reduce((s, [w, h]) => s + w * h * 4, 0) / 1e6).toFixed(1),
        map: [L.map.w, L.map.h],
        enemies: L.enemies.length,
        particles: L.particles.list.length,
        quality: window.__quality ? window.__quality.mode : null,
      };
    }, frames);

    // 真实循环：livePage 从未被打断过，rAF 保持原生。
    await livePage.evaluate((d) => { window.__game.startRun(99, d); }, depth);
    await livePage.waitForTimeout(700);
    const live = await livePage.evaluate(async (n) => {
      const g = window.__game;
      const gUp = g.update.bind(g);
      const gDr = g.draw.bind(g);
      const frameUpdate = [], drawMs = [], interval = [], steps = [];
      let accUpdate = 0, accSteps = 0, accDraw = 0;
      g.update = (dt) => { const a = performance.now(); gUp(dt); accUpdate += performance.now() - a; accSteps++; };
      g.draw = (c) => { const a = performance.now(); gDr(c); accDraw += performance.now() - a; };
      try {
        await new Promise((res) => {
          let last = 0, k = 0;
          const tick = (now) => {
            if (last) {
              interval.push(now - last);
              // 每帧归并一次：update 总和可能含多个子步，draw 是这一帧的那次
              frameUpdate.push(accUpdate);
              drawMs.push(accDraw);
              steps.push(accSteps);
            }
            // 第一帧没有 last，也要归零，否则前一帧的工作会被并进第二次采样
            accUpdate = 0; accSteps = 0; accDraw = 0;
            last = now;
            if (++k >= n + 5) res(); else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      } finally {
        g.update = gUp;
        g.draw = gDr;
      }
      const cv = document.querySelector('canvas');
      return { interval, frameUpdate, drawMs, steps, backing: [cv.width, cv.height] };
    }, frames);

    const row = {
      dpr,
      depth,
      loadMs,
      backing: iso.backing,
      transform: iso.transform.map((v) => +v.toFixed(3)),
      liveBacking: live.backing,
      quality: iso.quality,
      map: iso.map,
      enemies: iso.enemies,
      particles: iso.particles,
      layerMB: iso.layerMB,
      layers: iso.layers.map(([w, h]) => `${w}x${h}`).join(' '),
      isolated: {
        update2steps: fmt(iso.seg.update),
        draw: fmt(iso.seg.draw),
        back: fmt(iso.seg.back),
        terrain: fmt(iso.seg.terrain),
        front: fmt(iso.seg.front),
      },
      raf: {
        interval: fmt(live.interval),
        updatePerFrame: fmt(live.frameUpdate),
        draw: fmt(live.drawMs),
        stepsPerFrame: fmt(live.steps),
        fpsMedian: live.interval.length ? +(1000 / pct(live.interval, 0.5)).toFixed(0) : NaN,
      },
    };
    results.push(row);
    console.log(
      `dpr=${dpr} depth=${depth} backing=${row.backing.join('x')} transform=${row.transform.join('/')} ` +
      `q=${row.quality ?? 'n/a'} map=${row.map.join('x')} load=${loadMs.toFixed(0)}ms layers=${row.layerMB}MB`,
    );
    console.log(
      `  isolated med/p95  update(2 steps) ${row.isolated.update2steps}  draw ${row.isolated.draw}  ` +
      `back ${row.isolated.back}  terrain ${row.isolated.terrain}  front ${row.isolated.front}`,
    );
    console.log(
      `  raf      med/p95  frame ${row.raf.interval} (${row.raf.fpsMedian} fps)  ` +
      `update/frame ${row.raf.updatePerFrame}  draw ${row.raf.draw}  steps/frame ${row.raf.stepsPerFrame}`,
    );
  }

  await isoPage.close();
  await livePage.close();
}

await browser.close();

if (jsonPath) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(jsonPath, JSON.stringify({ env, results }, null, 2));
  console.log(`\nJSON -> ${jsonPath}`);
}
