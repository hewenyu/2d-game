import { VIEW_H, VIEW_W } from '../config';
import { input } from '../core/input';
import { addGlow, bellPath, seal, text } from '../render/draw';
import type { Game } from './game';
import type { Level } from './level';

export function drawHUD(ctx: CanvasRenderingContext2D, g: Game, L: Level) {
  const p = L.player, run = g.run!;
  // 生命：一道朱漆横梁上挂着的铜铃。碎掉的铃只剩暗色的壳，红绳松垂。
  const n = p.stats.maxHp, bx0 = 22, by = 14, gap = 28;
  ctx.fillStyle = '#3a1712'; ctx.fillRect(bx0 - 6, by - 4, n * gap + 6, 5);
  ctx.fillStyle = 'rgba(230,150,90,0.45)'; ctx.fillRect(bx0 - 6, by - 4, n * gap + 6, 1);
  ctx.fillStyle = '#8a6a3a'; ctx.fillRect(bx0 - 10, by - 6, 5, 9); ctx.fillRect(bx0 + n * gap - 1, by - 6, 5, 9);
  for (let i = 0; i < n; i++) {
    const x = bx0 + 12 + i * gap, full = i < p.hp;
    const sway = full ? Math.sin(L.time * 1.6 + i * 0.9) * 0.05 : 0.12;
    ctx.save(); ctx.translate(x, by); ctx.rotate(sway);
    ctx.strokeStyle = full ? '#b02a1e' : 'rgba(110,40,30,0.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 7); ctx.stroke();
    ctx.beginPath(); bellPath(ctx, 0, 7, 18, 20);
    if (full) {
      const grd = ctx.createLinearGradient(-9, 0, 9, 0);
      grd.addColorStop(0, '#5a3e1e'); grd.addColorStop(0.35, '#d8a957'); grd.addColorStop(0.6, '#a87a3a'); grd.addColorStop(1, '#3e2a14');
      ctx.fillStyle = grd; ctx.fill();
      ctx.strokeStyle = '#1a0f07'; ctx.lineWidth = 1.2; ctx.stroke();
      // 钟带、乳钉、钟舌
      ctx.strokeStyle = 'rgba(40,24,10,0.7)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(-6.5, 14); ctx.lineTo(6.5, 14); ctx.moveTo(-8, 22); ctx.lineTo(8, 22); ctx.stroke();
      ctx.fillStyle = 'rgba(255,225,160,0.8)';
      for (const dx of [-3.5, 0, 3.5]) { ctx.beginPath(); ctx.arc(dx, 18, 0.9, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(110,190,160,0.35)'; ctx.fillRect(-7, 23, 5, 2);
      ctx.fillStyle = '#1a0f07'; ctx.beginPath(); ctx.arc(Math.sin(L.time * 1.6 + i) * 1.2, 28.5, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(16,12,10,0.85)'; ctx.fill();
      ctx.strokeStyle = 'rgba(140,110,80,0.4)'; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.strokeStyle = 'rgba(140,110,80,0.5)';
      ctx.beginPath(); ctx.moveTo(-1, 9); ctx.lineTo(2, 15); ctx.lineTo(-2, 20); ctx.lineTo(1, 27); ctx.stroke();
    }
    ctx.restore();
  }
  // 灯油：一排小油灯，点着的有火苗
  for (let i = 0; i < p.stats.maxFlasks; i++) {
    const x = 30 + i * 22, y = 66, lit = i < p.flasks;
    ctx.fillStyle = lit ? '#7a5a30' : 'rgba(60,48,36,0.7)';
    ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.quadraticCurveTo(x, y + 8, x + 8, y); ctx.closePath(); ctx.fill();
    ctx.fillRect(x - 1.5, y + 3, 3, 4); ctx.fillRect(x - 4, y + 7, 8, 1.6);
    if (lit) {
      const fl = Math.sin(L.time * 9 + i * 2) * 0.6;
      addGlow(ctx, x, y - 5, 16, '255,170,80', 0.45);
      ctx.fillStyle = '#ffcf80';
      ctx.beginPath(); ctx.moveTo(x - 2.4, y - 1); ctx.quadraticCurveTo(x - 2, y - 7, x + fl, y - 11); ctx.quadraticCurveTo(x + 2.4, y - 6, x + 2.4, y - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff2d0'; ctx.beginPath(); ctx.ellipse(x, y - 3, 1, 2, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(160,150,140,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.quadraticCurveTo(x + 3, y - 7, x, y - 12); ctx.stroke();
    }
  }
  text(ctx, 'E', 30 + p.stats.maxFlasks * 22, 66, 11, 'rgba(220,200,170,0.5)', 'left');
  // 余烬
  addGlow(ctx, 30, 94, 12, '255,150,60', 0.6);
  ctx.fillStyle = '#ffd08a';
  ctx.beginPath(); ctx.moveTo(30, 87); ctx.quadraticCurveTo(35, 93, 30, 99); ctx.quadraticCurveTo(25, 93, 30, 87); ctx.fill();
  text(ctx, String(run.embers), 42, 94, 15, '#f1e3c6', 'left');
  // 刃
  if (L.blade.state !== 'hand') {
    const a = 0.55 + 0.45 * Math.sin(L.time * 6);
    text(ctx, L.blade.state === 'recall' ? '回锋…' : '刃离手 · 右键 / L 召回', 24, 118, 12, `rgba(255,214,140,${a})`, 'left');
  }
  // 位置
  seal(ctx, VIEW_W - 34, 30, 22, L.chapterName.charAt(0));
  text(ctx, L.chapterName, VIEW_W - 52, 22, 13, 'rgba(230,214,190,0.75)', 'right');
  text(ctx, `第 ${L.depth + 1} 层`, VIEW_W - 52, 42, 12, 'rgba(230,214,190,0.5)', 'right');
  // Boss 血条
  const b = g.boss;
  if (b && L.bossActive && (!b.dead || b.deadT < 2)) {
    const w = 520, x = (VIEW_W - w) / 2, y = VIEW_H - 40;
    seal(ctx, x + 10, y - 22, 20, b.elite ? '响' : '钟');
    text(ctx, b.displayName, x + 28, y - 18, 17, '#ece2cc', 'left');
    if (b.epithet) text(ctx, b.epithet, x + w, y - 16, 12, 'rgba(217,184,120,0.75)', 'right');
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 2, y - 2, w + 4, 12);
    const hk = Math.max(0, b.hp / b.maxHp);
    const hg = ctx.createLinearGradient(0, y, 0, y + 8);
    hg.addColorStop(0, b.elite ? '#3f8f7c' : '#a3271c'); hg.addColorStop(1, b.elite ? '#1d4a40' : '#5a120e');
    ctx.fillStyle = hg; ctx.fillRect(x, y, w * hk, 8);
    // 墨迹般参差的血条末端
    ctx.fillStyle = hg;
    for (let k = 0; k < 4; k++) ctx.fillRect(x + w * hk, y + k * 2, 2 + ((k * 7 + Math.floor(L.time * 6)) % 5), 2);
    ctx.strokeStyle = 'rgba(200,160,100,0.45)'; ctx.lineWidth = 1; ctx.strokeRect(x - 2.5, y - 2.5, w + 5, 13);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x - 7, y - 4, 5, 16); ctx.fillRect(x + w + 2, y - 4, 5, 16);
    if (!b.elite) { ctx.fillStyle = 'rgba(255,230,190,0.35)'; ctx.fillRect(x + w / 2, y - 3, 1, 14); }
    // 架势
    const stag = b.state === 'stagger';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y + 12, w, 3);
    ctx.fillStyle = stag ? '#ffd27a' : 'rgba(230,190,120,0.75)';
    ctx.fillRect(x, y + 12, w * (stag ? 1 : 1 - b.poise / b.maxPoise), 3);
  }
  // 横幅
  const bn = g.bannerMsg;
  if (bn) {
    const k = bn.t / bn.dur, a = Math.max(0, Math.min(1, k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1));
    ctx.globalAlpha = a;
    const grd = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, VIEW_H * 0.28 - 44, VIEW_W, 88);
    text(ctx, bn.title, VIEW_W / 2, VIEW_H * 0.28 - 8, 36, '#ece2cc');
    if (bn.sub) text(ctx, bn.sub, VIEW_W / 2, VIEW_H * 0.28 + 24, 14, '#d9b878');
    ctx.globalAlpha = 1;
  }
  // 台词
  const ln = g.lines.find((l) => l.t >= 0);
  if (ln) {
    const a = Math.max(0, Math.min(1, ln.t / 0.3, (ln.dur - ln.t) / 0.4));
    ctx.globalAlpha = a;
    const y = VIEW_H - 112;
    const grd = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    grd.addColorStop(0.2, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.5)'); grd.addColorStop(0.8, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, y - 18, VIEW_W, 36);
    text(ctx, ln.s, VIEW_W / 2, y, 17, '#f0dcb4');
    ctx.globalAlpha = 1;
  }
  if (g.toastMsg) {
    const t = g.toastMsg, a = Math.max(0, Math.min(1, Math.min(t.t / 0.15, (2 - t.t) / 0.3)));
    ctx.globalAlpha = a;
    ctx.font = '15px serif';
    text(ctx, t.s, VIEW_W / 2, VIEW_H - 92, 15, '#ffd890');
    ctx.globalAlpha = 1;
  }
  // 红色受击闪
  if (g.flashRed > 0 || (p.hp === 1 && !p.dead)) {
    const a = Math.max(g.flashRed * 0.6, p.hp === 1 ? 0.12 + 0.06 * Math.sin(L.time * 5) : 0);
    const grd = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 200, VIEW_W / 2, VIEW_H / 2, 560);
    grd.addColorStop(0, 'rgba(120,0,0,0)'); grd.addColorStop(1, `rgba(140,10,10,${a})`);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // 准星
  if (g.state === 'play' && input.mouseSeen) {
    const c = L.blade.state === 'hand' ? 'rgba(255,214,140,0.8)' : 'rgba(255,255,255,0.55)';
    ctx.strokeStyle = c; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(input.mouseX, input.mouseY, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(input.mouseX - 11, input.mouseY); ctx.lineTo(input.mouseX - 3, input.mouseY); ctx.moveTo(input.mouseX + 3, input.mouseY); ctx.lineTo(input.mouseX + 11, input.mouseY); ctx.stroke();
  }
}
