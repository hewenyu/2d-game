import { VIEW_H, VIEW_W } from '../config';
import { CAUSES, GENERAL_TIPS } from '../data/tips';
import { TOTAL_LEVELS } from '../data/chapters';
import { EPILOGUE, PROLOGUE, UPGRADE_LORE } from '../data/lore';
import { WandererModel } from '../render/models/wanderer';
import { addGlow, glint, seal, text } from '../render/draw';

const titleHero = new WandererModel();
import type { Game } from './game';
import { UPGRADES } from './upgrades';

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function dim(ctx: CanvasRenderingContext2D, a: number) { ctx.fillStyle = `rgba(6,4,3,${a})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }

/** 多行文本（\n 分行），居中 */
function para(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, lh = 1.7) {
  const ls = s.split('\n');
  ls.forEach((l, i) => text(ctx, l, x, y + (i - (ls.length - 1) / 2) * size * lh, size, color));
}

const PRO_STEP = 3.6;
/** 序章总时长 */
export const PROLOGUE_T = PROLOGUE.length * PRO_STEP + 1.2;

export function drawPrologue(ctx: CanvasRenderingContext2D, g: Game) {
  const t = g.stateT;
  dim(ctx, Math.min(0.9, t * 1.5));
  const i = Math.min(PROLOGUE.length - 1, Math.floor(t / PRO_STEP));
  const k = (t - i * PRO_STEP) / PRO_STEP;
  const last = i === PROLOGUE.length - 1;
  const a = Math.max(0, Math.min(1, k / 0.18, last ? 1 : (1 - k) / 0.18));
  ctx.globalAlpha = a;
  para(ctx, PROLOGUE[i], VIEW_W / 2, VIEW_H * 0.46, last ? 26 : 20, last ? '#f0d9a8' : '#e6dccb');
  ctx.globalAlpha = 1;
  // 进度：一排小钟点
  for (let j = 0; j < PROLOGUE.length; j++) {
    ctx.fillStyle = j <= i ? 'rgba(217,170,100,0.8)' : 'rgba(217,170,100,0.2)';
    ctx.beginPath(); ctx.arc(VIEW_W / 2 + (j - (PROLOGUE.length - 1) / 2) * 14, VIEW_H - 64, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  text(ctx, '按 空格 跳过', VIEW_W / 2, VIEW_H - 36, 11, 'rgba(220,200,170,0.4)');
}

/** 碑文阅读面板：竖排的碑文太难读，这里用横排、仿拓片的深色纸面 */
export function drawRead(ctx: CanvasRenderingContext2D, g: Game) {
  const st = g.reading;
  if (!st) return;
  const k = Math.min(1, g.stateT / 0.25);
  dim(ctx, 0.6 * k);
  ctx.globalAlpha = k;
  const w = 560, h = 96 + st.body.length * 30, x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2 - 10;
  const grd = ctx.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0, '#1b1612'); grd.addColorStop(1, '#100c09');
  ctx.fillStyle = grd; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(200,160,100,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
  ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x - 4, y - 4, w + 8, 4); ctx.fillRect(x - 4, y + h, w + 8, 4);
  text(ctx, st.title, VIEW_W / 2, y + 36, 18, '#e8c88c');
  seal(ctx, x + w - 34, y + 34, 22, '碑');
  st.body.forEach((l, i) => text(ctx, l, VIEW_W / 2, y + 78 + i * 30, 15, l.startsWith('（') ? 'rgba(200,180,150,0.55)' : '#e6dccb'));
  if (g.stateT > 0.25) text(ctx, '按 空格 / ↑ 合上', VIEW_W / 2, y + h + 26, 11, 'rgba(220,200,170,0.5)');
  ctx.globalAlpha = 1;
}

export function drawTitle(ctx: CanvasRenderingContext2D, g: Game) {
  const t = g.time;
  const grd = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.42, 60, VIEW_W / 2, VIEW_H / 2, 620);
  grd.addColorStop(0, 'rgba(0,0,0,0.05)'); grd.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // 剑客立于灯下
  addGlow(ctx, VIEW_W / 2, 330, 170, '255,170,90', 0.12);
  ctx.fillStyle = '#0a0705'; ctx.fillRect(VIEW_W / 2 - 120, 352, 240, 6);
  ctx.save(); ctx.translate(VIEW_W / 2, 352); ctx.scale(1.7, 1.7);
  titleHero.draw(ctx, { x: 0, y: 0, facing: 1, vx: 0, vy: 0, onGround: true, run: 0, dashT: 0, attackT: -1, attackDir: 'side', throwT: -1, throwAng: 0, healT: -1, hurtT: 0, bladeInHand: false, sx: 1, sy: 1, alpha: 1, dead: false, deadT: 0, time: t });
  ctx.restore();
  // 掷出的刃与金线
  const a = t * 0.8, bx = VIEW_W / 2 + Math.cos(a) * 150, by = 290 + Math.sin(a) * 40;
  ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,214,140,0.45)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(VIEW_W / 2 + 8, 320); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
  addGlow(ctx, bx, by, 18, '255,210,130', 0.35);
  ctx.strokeStyle = '#ffe4a6'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(bx - Math.cos(a + 1.6) * 14, by - Math.sin(a + 1.6) * 14); ctx.lineTo(bx + Math.cos(a + 1.6) * 14, by + Math.sin(a + 1.6) * 14); ctx.stroke();

  text(ctx, '回  锋', VIEW_W / 2, 128, 82, '#ece2cc');
  seal(ctx, VIEW_W / 2 + 132, 104, 30, '钟');
  text(ctx, '—— 沉 钟 寺 ——', VIEW_W / 2, 196, 20, '#d9a860');
  text(ctx, '刀是钟舌，丝是归途。掷出它，再唤它回来。', VIEW_W / 2, 398, 14, 'rgba(230,214,190,0.75)');
  const rows: [string, string][] = [
    ['A / D', '移动'], ['空格', '跳跃（按住跳更高）'], ['J / 左键', '斩击（W 上斩 · 空中 S 下劈）'],
    ['K / Shift', '冲刺（无敌）'], ['L / 右键', '掷刃 · 再按召回（鼠标瞄准）'], ['S', '下蹲（钻缝 · 蹲着冲刺是滑铲）'],
    ['E', '饮灯油'], ['W', '灯龛前休憩 · 碑前阅读'], ['Esc', '暂停'],
  ];
  rows.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = VIEW_W / 2 - 250 + col * 270, y = 426 + row * 19;
    text(ctx, k, x + 80, y, 12, '#d9a860', 'right');
    text(ctx, v, x + 92, y, 12, 'rgba(230,214,190,0.8)', 'left');
  });
  text(ctx, '按 空格 / 点击 走入山门', VIEW_W / 2, 524, 17, `rgba(236,226,204,${0.55 + 0.45 * Math.sin(t * 3)})`);
  const s = g.save;
  if (s.wins > 0 || s.bestDepth > 0) {
    const best = s.bestTime !== null ? `最佳通关 ${fmt(s.bestTime)} · ` : '';
    text(ctx, `${best}最深抵达第 ${Math.min(TOTAL_LEVELS, s.bestDepth + 1)} 层 · 通关 ${s.wins} 次`, VIEW_W - 20, VIEW_H - 16, 11, 'rgba(200,205,220,0.45)', 'right');
  }
}

export function drawDeath(ctx: CanvasRenderingContext2D, g: Game) {
  const k = Math.min(1, g.stateT / 0.8), run = g.run!;
  dim(ctx, 0.72 * k);
  ctx.globalAlpha = k;
  text(ctx, '灯  灭', VIEW_W / 2, 170, 60, '#b8352c');
  const c = CAUSES[run.cause] ?? ['未知', ''];
  text(ctx, `死于  ${c[0]}`, VIEW_W / 2, 238, 17, '#ece7db');
  text(ctx, c[1], VIEW_W / 2, 270, 14, '#d9b878');
  if (run.drop) text(ctx, `${run.drop.amount} 余烬遗落在你倒下之处 —— 再死一次便会失去`, VIEW_W / 2, 318, 13, 'rgba(255,190,120,0.85)');
  const b = g.boss;
  if (b && !b.dead && g.level?.bossActive) text(ctx, `${b.displayName}剩余 ${Math.ceil((b.hp / b.maxHp) * 100)}%`, VIEW_W / 2, 348, 15, '#cfd3dd');
  text(ctx, '提示：' + GENERAL_TIPS[run.deaths % GENERAL_TIPS.length], VIEW_W / 2, 380, 12, 'rgba(200,205,220,0.6)');
  text(ctx, `死亡 ${run.deaths} 次`, VIEW_W / 2, 412, 12, 'rgba(200,205,220,0.45)');
  if (g.stateT > 0.9) text(ctx, '按 空格 / 点击 —— 于灯前重燃', VIEW_W / 2, 460, 17, `rgba(236,231,219,${0.55 + 0.45 * Math.sin(g.time * 3)})`);
  ctx.globalAlpha = 1;
}

export function drawRest(ctx: CanvasRenderingContext2D, g: Game) {
  const run = g.run!;
  dim(ctx, 0.66);
  addGlow(ctx, VIEW_W / 2, 120, 260, '255,170,90', 0.12);
  text(ctx, '休 憩', VIEW_W / 2, 96, 38, '#ece7db');
  text(ctx, '生命与灯油已回满 · 游荡之物重新苏醒', VIEW_W / 2, 136, 13, 'rgba(210,215,228,0.65)');
  text(ctx, `余烬  ${run.embers}`, VIEW_W / 2, 168, 16, '#ffd890');
  UPGRADES.forEach((u, i) => {
    const y = 214 + i * 54, sel = g.menuSel === i, owned = run.owned[u.id], maxed = owned >= u.max, cost = u.cost(owned);
    if (sel) { ctx.fillStyle = 'rgba(255,214,140,0.08)'; ctx.fillRect(VIEW_W / 2 - 260, y - 22, 520, 46); ctx.strokeStyle = 'rgba(255,214,140,0.5)'; ctx.strokeRect(VIEW_W / 2 - 260, y - 22, 520, 46); }
    text(ctx, u.name, VIEW_W / 2 - 236, y - 6, 18, sel ? '#ffe2a6' : '#ece7db', 'left');
    text(ctx, u.desc, VIEW_W / 2 - 236, y + 13, 12, 'rgba(210,215,228,0.65)', 'left');
    text(ctx, '◆'.repeat(owned) + '◇'.repeat(u.max - owned), VIEW_W / 2 + 90, y, 13, '#d9b878', 'center');
    text(ctx, maxed ? '已满' : `${cost} 余烬`, VIEW_W / 2 + 236, y, 14, maxed ? 'rgba(200,205,220,0.5)' : run.embers >= cost ? '#ffd890' : 'rgba(200,120,100,0.8)', 'right');
  });
  const cur = UPGRADES[g.menuSel];
  if (cur && UPGRADE_LORE[cur.id]) text(ctx, '「' + UPGRADE_LORE[cur.id] + '」', VIEW_W / 2, VIEW_H - 58, 13, 'rgba(217,168,96,0.75)');
  const ly = 214 + UPGRADES.length * 54;
  const sel = g.menuSel === UPGRADES.length;
  text(ctx, '起身离开', VIEW_W / 2, ly, 17, sel ? '#ffe2a6' : 'rgba(236,231,219,0.7)');
  if (sel) glint(ctx, VIEW_W / 2 - 60, ly, 6, 0.8);
  text(ctx, 'W / S 选择 · 空格 / J 确认 · Esc 离开', VIEW_W / 2, VIEW_H - 30, 12, 'rgba(200,205,220,0.5)');
}

export function drawPause(ctx: CanvasRenderingContext2D, g: Game) {
  dim(ctx, 0.75);
  text(ctx, '暂  停', VIEW_W / 2, 130, 40, '#ece7db');
  const lines = [
    'A/D 移动 · 空格 跳跃 · K/Shift 冲刺（无敌）· 按住 S 下蹲（可钻一格高的缝，蹲着冲刺是滑铲）',
    'J/左键 斩击 · 按住 W 上斩 · 空中按住 S 下劈（命中可弹起）',
    'L/右键 掷刃（鼠标瞄准），再按召回：刃会撕裂金线路径上的敌人',
    '钉在墙上的刃可以站立 · E 饮灯油 · 灯龛前按 W 休憩',
  ];
  lines.forEach((l, i) => text(ctx, l, VIEW_W / 2, 200 + i * 28, 13, 'rgba(210,215,228,0.75)'));
  ['继续', '返回标题'].forEach((s, i) => text(ctx, (g.menuSel === i ? '›  ' : '') + s, VIEW_W / 2, 350 + i * 40, 18, g.menuSel === i ? '#ffe2a6' : 'rgba(236,231,219,0.6)'));
}

const EPI_STEP = 3.2;

export function drawVictory(ctx: CanvasRenderingContext2D, g: Game) {
  const t = g.stateT, run = g.run!;
  dim(ctx, Math.min(0.92, t / 1.5));
  // 尾声逐行浮现，最后一行停在中间，再淡出成结算
  const epiEnd = 1 + EPILOGUE.length * EPI_STEP;
  if (t < epiEnd + 1) {
    const fadeOut = Math.max(0, Math.min(1, (epiEnd + 1 - t)));
    EPILOGUE.forEach((l, i) => {
      const a = Math.max(0, Math.min(1, (t - 1 - i * EPI_STEP) / 1.2)) * fadeOut;
      if (a <= 0) return;
      ctx.globalAlpha = a;
      const last = i === EPILOGUE.length - 1;
      text(ctx, l, VIEW_W / 2, 150 + i * 46 + (last ? 20 : 0), last ? 22 : 17, last ? '#f0d9a8' : '#e6dccb');
    });
    ctx.globalAlpha = 1;
    if (t > 1.5) text(ctx, '按 空格 跳过', VIEW_W / 2, VIEW_H - 30, 11, 'rgba(220,200,170,0.35)');
    return;
  }
  const k = Math.min(1, (t - epiEnd - 1) / 1.2);
  ctx.globalAlpha = k;
  text(ctx, '万 钟 俱 寂', VIEW_W / 2, 170, 54, '#ece2cc');
  seal(ctx, VIEW_W / 2 + 168, 150, 28, '寂');
  text(ctx, '渊底，有人轻轻唤了他一声。', VIEW_W / 2, 232, 15, '#d9a860');
  text(ctx, `用时 ${fmt(run.time)}    灯灭 ${run.deaths} 次    挑战守钟人 ${run.bossTries} 次`, VIEW_W / 2, 300, 15, '#e6dccb');
  if (g.save.bestTime !== null) text(ctx, `最佳 ${fmt(g.save.bestTime)}`, VIEW_W / 2, 330, 13, 'rgba(220,200,170,0.6)');
  if (k >= 1) text(ctx, '按 空格 / 点击 返回标题', VIEW_W / 2, 420, 17, `rgba(236,226,204,${0.55 + 0.45 * Math.sin(g.time * 3)})`);
  ctx.globalAlpha = 1;
}

/** victory 状态下尾声的总时长（之后才显示结算） */
export const EPILOGUE_T = 1 + EPILOGUE.length * EPI_STEP + 1;
