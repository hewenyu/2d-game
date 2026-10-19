// 符蛾：寺里贴满了镇魂的黄符。钟声逆鸣之后，符纸自燃，烧剩的纸灰折成了蛾子的样子，循着活人的声音扑来。
// 翅膀是四张黄符，朱砂符文在蓄力时发亮；边缘是还没熄灭的余火。
import { clamp, lerp } from '../../core/math';
import { addGlow, glint } from '../draw';
import { Clock, h01, inWorld, Rope, Xf } from '../rig';

export interface MothView {
  x: number; y: number; facing: number;
  state: string; t: number; wind: number;
  ph: number; dvx: number; dvy: number;
  flash: boolean; dead: boolean; deadT: number;
  time: number; seed: number;
}

const PAPER = ['#d9b860', '#a9843a'];
const INK = 'rgba(158,34,24,0.9)';

export class MothModel {
  private tails = [new Rope(6, 2.6), new Rope(5, 2.4)];
  private clock = new Clock();
  /** 每张符的符文笔画（按种子固定） */
  private glyphs: number[][];

  constructor(seed = 1) {
    this.glyphs = [0, 1, 2, 3].map((w) => Array.from({ length: 6 }, (_, i) => Math.floor(h01(seed * 7 + w, i) * 4)));
  }

  draw(ctx: CanvasRenderingContext2D, v: MothView) {
    const dt = this.clock.tick(v.time);
    const f = v.facing;
    const base = ctx.getTransform();
    const st = v.state;
    const fast = st === 'windup' || st === 'dive';
    const flap = Math.sin(v.ph * (fast ? 40 : 17));
    const fold = st === 'windup' ? clamp(v.t / v.wind, 0, 1) : st === 'dive' ? 1 : 0;
    const charge = st === 'windup' ? fold : st === 'dive' ? 1 : 0;
    let rot = 0;
    if (st === 'dive') rot = Math.atan2(v.dvy, v.dvx * f);
    if (st === 'stagger') rot = Math.sin(v.t * 30) * 0.6;
    const deadK = v.dead ? clamp(v.deadT / 0.6, 0, 1) : 0;
    if (v.dead) rot = v.deadT * 6;
    const root = new Xf().translate(v.x, v.y).scale(f, 1).rotate(rot);

    // 纸尾（后翅末端垂下的符纸条）
    const tailRoots = [root.apply(-7, 2), root.apply(-5, 2.5)];
    this.tails.forEach((r, i) => r.step(tailRoots[i].x, tailRoots[i].y, dt, { grav: 300, damp: 0.92, stiff: 45, rest: (j) => ({ x: -f * j * 2.4, y: j * 1.2 }), wind: 160, time: v.time + i * 2 }));

    const alpha = v.dead ? 1 - deadK : 1;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;

    // 拖尾的灰烬
    inWorld(ctx, base, () => {
      for (let i = 0; i < 5; i++) {
        const k = ((v.time * 0.9 + i / 5 + v.seed) % 1);
        const x = v.x - f * (6 + k * 18) + Math.sin(i * 9 + v.time * 3) * 3, y = v.y + 4 + k * 22;
        ctx.fillStyle = `rgba(255,${150 + i * 15},80,${(1 - k) * 0.8})`;
        ctx.fillRect(x, y, 1.2, 1.2);
      }
      this.tails.forEach((r, i) => {
        ctx.fillStyle = i ? PAPER[1] : PAPER[0];
        ctx.fill(r.ribbon((k) => 2.6 - k * 1.2, 1.4, v.seed + i));
        ctx.fillStyle = INK; ctx.fillRect(r.x[2] - 0.5, r.y[2] - 0.5, 1, 1);
      });
    });
    root.set(ctx, base);

    // 远侧两翅
    const wa = lerp(-2.25 + flap * 0.6, -2.85, fold);
    this.wing(ctx, 0, -1.5, wa + 0.18, 18, 6.4, 0, v, charge, true);
    this.wing(ctx, -1, 0, wa + 0.75, 13, 5.6, 2, v, charge, true);

    // 躯干：卷起的符纸
    ctx.save();
    ctx.rotate(lerp(0.15, -0.2, fold));
    const body = new Path2D();
    body.moveTo(-8, -1.6); body.lineTo(5, -2.6); body.quadraticCurveTo(7.6, 0, 5, 2.4); body.lineTo(-8, 2.2); body.quadraticCurveTo(-9.8, 0.3, -8, -1.6);
    const g = ctx.createLinearGradient(0, -3, 0, 3);
    g.addColorStop(0, v.flash ? '#fff' : '#e3c472'); g.addColorStop(1, v.flash ? '#fff' : '#7e5f28');
    ctx.fillStyle = g; ctx.fill(body);
    ctx.strokeStyle = 'rgba(40,20,10,0.55)'; ctx.lineWidth = 0.5;
    for (let x = -6; x < 5; x += 2.4) { ctx.beginPath(); ctx.moveTo(x, -2.1); ctx.quadraticCurveTo(x + 0.8, 0, x, 2.1); ctx.stroke(); }
    ctx.fillStyle = INK; ctx.fillRect(-2, -2.3, 1.4, 4.6);
    // 焦黑的尾端
    ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.moveTo(-8, -1.6); ctx.lineTo(-6, -2); ctx.lineTo(-6.8, 0); ctx.lineTo(-5.6, 2.2); ctx.lineTo(-8, 2.2); ctx.quadraticCurveTo(-9.8, 0.3, -8, -1.6); ctx.fill();
    // 头：纸结与一只余火眼
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(7, -0.5, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = charge > 0.3 ? '#ffe2a0' : '#ff9a4a'; ctx.beginPath(); ctx.arc(7.8, -0.9, 0.9, 0, Math.PI * 2); ctx.fill();
    // 纸须触角
    ctx.strokeStyle = '#c9a457'; ctx.lineWidth = 0.6;
    const ant = lerp(1, 0.3, fold);
    ctx.beginPath(); ctx.moveTo(8, -2); ctx.quadraticCurveTo(11, -7 * ant, 13.5, -5.5 * ant); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, -2.2); ctx.quadraticCurveTo(8.5, -8 * ant, 11, -8.5 * ant); ctx.stroke();
    ctx.restore();

    // 近侧两翅
    this.wing(ctx, -1, 0.5, wa + 0.85, 13, 5.6, 3, v, charge, false);
    this.wing(ctx, 0, -1, wa, 19, 6.8, 1, v, charge, false);
    ctx.restore();

    // 腹中余火
    const c = root.apply(-1, 0);
    ctx.save(); ctx.setTransform(base);
    const bright = 0.3 + charge * 0.55;
    addGlow(ctx, c.x, c.y, 14 + bright * 24, '255,150,60', bright * (1 - deadK));
    if (st === 'windup' && v.t > v.wind - 0.2 && !v.dead) glint(ctx, c.x, c.y, 12, (v.t - (v.wind - 0.2)) / 0.2);
    ctx.restore();
  }

  /** 一张符翅：以 (hx,hy) 为铰点、沿角度 a 展开的纸条 */
  private wing(ctx: CanvasRenderingContext2D, hx: number, hy: number, a: number, L: number, w: number, idx: number, v: MothView, charge: number, far: boolean) {
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(a);
    // 纸条略呈梯形，末端烧得参差
    const p = new Path2D();
    p.moveTo(0, -w * 0.32);
    p.lineTo(L * 0.82, -w / 2);
    for (let i = 0; i <= 5; i++) {
      const k = i / 5;
      p.lineTo(L * (0.86 + 0.14 * h01(idx * 5 + i, v.seed)), -w / 2 + w * k);
    }
    p.lineTo(0, w * 0.32);
    p.closePath();
    const g = ctx.createLinearGradient(0, 0, L, 0);
    if (v.flash) { g.addColorStop(0, '#fff'); g.addColorStop(1, '#fff'); }
    else if (far) { g.addColorStop(0, '#8a6c30'); g.addColorStop(1, '#5e4720'); }
    else { g.addColorStop(0, PAPER[0]); g.addColorStop(0.7, PAPER[1]); g.addColorStop(1, '#4a3418'); }
    ctx.fillStyle = g; ctx.fill(p);
    ctx.save(); ctx.clip(p);
    // 朱砂边框与符文
    const hot = charge > 0.2;
    ctx.strokeStyle = hot ? `rgba(255,${150 - charge * 60},70,${0.6 + charge * 0.4})` : far ? 'rgba(110,26,18,0.6)' : INK;
    ctx.lineWidth = 0.6;
    ctx.strokeRect(1.5, -w / 2 + 1, L * 0.78, w - 2);
    ctx.lineWidth = 0.8;
    const gl = this.glyphs[idx];
    for (let i = 0; i < gl.length; i++) {
      const x = 3 + i * (L * 0.7 / gl.length), s = w * 0.22;
      ctx.beginPath();
      switch (gl[i]) {
        case 0: for (const yy of [-s, 0, s]) { ctx.moveTo(x, yy); ctx.lineTo(x + 1.7, yy); } break; // 三
        case 1: ctx.rect(x, -s * 0.7, 1.7, s * 1.4); break; // 口
        case 2: ctx.moveTo(x + 1.6, -s); ctx.lineTo(x, -s * 0.3); ctx.lineTo(x + 1.6, s * 0.3); ctx.lineTo(x, s); break; // 雷纹
        default: ctx.moveTo(x, 0); ctx.lineTo(x + 1.8, 0); ctx.moveTo(x + 0.9, -s); ctx.lineTo(x + 0.9, s); break; // 十
      }
      ctx.stroke();
    }
    // 烧穿的小洞
    const hx2 = L * (0.45 + 0.2 * h01(idx, v.seed + 3)), hy2 = (h01(idx, v.seed + 9) - 0.5) * w * 0.4;
    ctx.fillStyle = '#120c08'; ctx.beginPath(); ctx.ellipse(hx2, hy2, 1.1, 0.8, 0, 0, Math.PI * 2); ctx.fill();
    // 焦边
    ctx.fillStyle = 'rgba(26,16,10,0.9)';
    ctx.fillRect(L * 0.84, -w, L * 0.3, w * 2);
    ctx.restore();
    // 余火描边（闪烁）
    const fl = 0.55 + 0.45 * Math.sin(v.time * 14 + idx * 2 + v.seed);
    ctx.strokeStyle = `rgba(255,${130 + charge * 80},60,${(far ? 0.35 : 0.75) * fl + charge * 0.25})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(L * 0.82, -w / 2);
    for (let i = 0; i <= 5; i++) ctx.lineTo(L * (0.84 + 0.14 * h01(idx * 5 + i, v.seed)), -w / 2 + w * (i / 5));
    ctx.stroke();
    ctx.restore();
  }
}
