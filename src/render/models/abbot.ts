// 守钟人 · 玄寂：沉钟寺最后一任住持。始钟裂开那夜，他把寺里最重的一口梵钟扣在自己背上，
// 誓言「钟不可停」，独自撞钟三百年，钟与骨肉长在了一起。他的脸从钟口里探出来，长眉白须。
// 兵器是撞钟用的巨木。二阶段钟身裂开、透出火光；「残响」是他留在渊底的回声，青白而虚。
import { clamp, lerp } from '../../core/math';
import { addGlow } from '../draw';
import { capsule, Clock, h01, ik, inWorld, rim, Rope, Xf, type Pt } from '../rig';

export interface AbbotView {
  x: number; y: number; facing: number;
  state: string; atk: string | null; t: number;
  hammer: number; bellGlow: number;
  phase: number; elite: boolean;
  leapStage: string; vx: number; vy: number;
  flash: boolean; dead: boolean; deadT: number;
  time: number;
}

const BASE = {
  robe: '#17110f', robeBack: '#0e0a09', robeRim: 'rgba(222,170,110,0.55)',
  kasaya: '#4a1613', kasayaGrid: 'rgba(214,168,82,0.18)', kasayaRim: '#c79a55',
  skin: '#3d3530', skinBack: '#26201c', skinRim: 'rgba(220,200,170,0.5)',
  bell: '#5b4527', bellLit: '#8f7040', bellDark: '#2e2213', bellHi: '#d9b26a', verdigris: 'rgba(86,150,118,0.55)',
  face: '#cfc4ae', faceShade: '#8d8270', beard: '#d9d3c5', eye: '255,140,60',
  wood: '#4a3320', woodGrain: 'rgba(20,12,6,0.55)', iron: '#2a2b30', rope: '#8c7650', bead: '#2e1d12',
  crack: '255,110,50',
};
const ECHO = {
  ...BASE,
  robe: '#0d1918', robeBack: '#081110', robeRim: 'rgba(160,240,220,0.55)',
  kasaya: '#1d3a36', kasayaGrid: 'rgba(170,240,220,0.45)', kasayaRim: '#9fe0cc',
  skin: '#24302e', skinBack: '#162020', skinRim: 'rgba(170,240,220,0.45)',
  bell: '#304c45', bellLit: '#4e7468', bellDark: '#14211e', bellHi: '#a8ead6', verdigris: 'rgba(150,230,200,0.35)',
  face: '#b8d8cf', faceShade: '#6f8d85', beard: '#cfeee6', eye: '170,255,230',
  wood: '#263431', woodGrain: 'rgba(5,12,10,0.6)', rope: '#6f8f86', crack: '150,255,220',
};
const C2 = (c: string) => (c.startsWith('#f4') ? '#fff' : 'rgba(214,168,82,0.6)');
const FLASH = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, /^\d/.test(v) ? v : '#f4efe6'])) as typeof BASE;

export class AbbotModel {
  private beard = [new Rope(6, 4.2), new Rope(5, 4), new Rope(5, 3.6)];
  private tat = [new Rope(5, 4.5), new Rope(5, 4.2), new Rope(4, 4.4), new Rope(5, 4)];
  private talis = [new Rope(5, 3.4), new Rope(4, 3.4)];
  private clock = new Clock();
  private walk = 0;
  /** 本帧巨木末端与眼睛的世界坐标（供闪光提示使用） */
  tip: Pt = { x: 0, y: 0 };
  eye: Pt = { x: 0, y: 0 };
  bellPt: Pt = { x: 0, y: 0 };

  draw(ctx: CanvasRenderingContext2D, v: AbbotView) {
    const dt = this.clock.tick(v.time);
    const C = v.flash ? FLASH : v.elite ? ECHO : BASE;
    const f = v.facing;
    const base = ctx.getTransform();
    const root = new Xf().translate(v.x, v.y).scale(f, 1);
    const st = v.state, atk = v.atk, t = v.t;
    this.walk += Math.abs(v.vx) * dt * 0.028;

    // ---------- 姿态 ----------
    const walking = Math.abs(v.vx) > 20 && (st === 'idle' || (st === 'active' && atk === 'charge'));
    let bob = walking ? Math.abs(Math.sin(this.walk)) * 3 : Math.sin(v.time * 1.3) * 1.2;
    let lean = 0.12, drop = 0, headUp = 0, legsTuck = 0;
    let ha = v.hammer;
    let twoHand = false;
    const ease = (k: number) => 1 - (1 - clamp(k, 0, 1)) ** 2;
    switch (st) {
      case 'dormant': drop = 18; lean = 0.32; ha = Math.PI / 2 - 0.15; bob = Math.sin(v.time * 0.9) * 0.6; break;
      case 'intro': {
        const k = ease(t / 0.7);
        drop = lerp(18, 0, k); lean = lerp(0.32, 0.12, k);
        if (t > 0.7 && t < 1.6) { lean = -0.28; headUp = 1; }
        ha = lerp(Math.PI / 2 - 0.15, 1.2, k);
        break;
      }
      case 'windup':
        if (atk === 'sweep' || atk === 'sweepB') { lean = -0.14; twoHand = true; }
        else if (atk === 'leap') { drop = 12 * ease(t / 0.3); lean = 0.38; }
        else if (atk === 'charge') { lean = 0.55; drop = 6; bob = Math.sin(v.time * 30) * 0.8; }
        else if (atk === 'toll') { lean = 0.05; twoHand = true; ha = lerp(v.hammer, 0.9, ease(t / 0.5)); }
        else if (atk === 'debris') { lean = -0.18; twoHand = true; }
        break;
      case 'leap':
        legsTuck = v.leapStage === 'fall' ? 0.4 : 1; lean = v.leapStage === 'fall' ? 0.35 : 0.05; twoHand = true; bob = 0;
        break;
      case 'active':
        if (atk === 'sweep' || atk === 'sweepB') { lean = 0.34; twoHand = true; }
        else if (atk === 'land') { drop = 14; lean = 0.5; twoHand = true; }
        else if (atk === 'charge') { lean = 0.62; drop = 4; }
        else if (atk === 'toll') { lean = -0.12; twoHand = true; ha = lerp(0.9, -2.45, ease(t / 0.12)); }
        else if (atk === 'debris') { lean = 0.45; drop = 6; twoHand = true; }
        break;
      case 'recover': {
        const k = clamp(t / 0.7, 0, 1);
        if (atk === 'land') { drop = lerp(14, 0, k); lean = lerp(0.5, 0.15, k); }
        else if (atk === 'charge') lean = lerp(0.5, 0.12, k);
        else if (atk === 'toll') { ha = lerp(-2.45, 1.2, k); lean = lerp(-0.12, 0.12, k); }
        else lean = lerp(0.3, 0.12, k);
        bob = Math.abs(Math.sin(v.time * 5)) * 1.5;
        break;
      }
      case 'stun': drop = 20; lean = -0.32 + Math.sin(v.time * 9) * 0.04; ha = 1.5; headUp = 0.3; break;
      case 'stagger': drop = 17; lean = 0.55; ha = Math.PI / 2 - 0.2; bob = Math.sin(v.time * 6) * 0.8; break;
      case 'transition': {
        if (t < 0.5) { lean = lerp(0.12, -0.3, t / 0.5); headUp = t / 0.5; ha = lerp(v.hammer, -2.5, t / 0.5); twoHand = true; }
        else if (t < 1.2) { lean = -0.3; headUp = 1; ha = -2.5; twoHand = true; }
        else { const k = ease((t - 1.2) / 0.15); ha = lerp(-2.5, -3.2, k); lean = -0.15; twoHand = true; }
        break;
      }
    }
    let deadK = 0;
    if (v.dead) {
      deadK = clamp(v.deadT / 1.4, 0, 1);
      drop = 20 * Math.min(1, v.deadT / 0.6); lean = 0.12 + Math.max(0, v.deadT - 0.6) * 0.9; lean = Math.min(lean, 1.25); ha = Math.PI / 2;
    }
    const hipY = -36 + drop - bob;
    const cs = Math.cos(lean), sn = Math.sin(lean);
    const hp = (x: number, y: number): Pt => ({ x: x * cs - y * sn, y: hipY + x * sn + y * cs });
    const W = (p: Pt) => root.apply(p.x, p.y);
    const dir = { x: Math.cos(ha), y: Math.sin(ha) };

    // 腿
    let fF: Pt = { x: 15, y: 0 }, fB: Pt = { x: -15, y: 0 };
    if (walking) {
      const s = atk === 'charge' ? 1.4 : 1;
      fF = { x: 6 + Math.sin(this.walk) * 12 * s, y: -Math.max(0, Math.cos(this.walk)) * 7 };
      fB = { x: -6 + Math.sin(this.walk + Math.PI) * 12 * s, y: -Math.max(0, Math.cos(this.walk + Math.PI)) * 7 };
    }
    if (st === 'stagger' || st === 'dormant' || (v.dead && v.deadT > 0.3)) { fF = { x: 20, y: 0 }; fB = { x: -12, y: -2 }; }
    if (legsTuck > 0) { fF = { x: 14, y: hipY + 26 - legsTuck * 8 }; fB = { x: -10, y: hipY + 30 - legsTuck * 8 }; }
    const hipF = hp(10, 2), hipB = hp(-10, 2);
    const legF = ik(hipF.x, hipF.y, fF.x, fF.y, 19, 18, 1), legB = ik(hipB.x, hipB.y, fB.x, fB.y, 19, 18, 1);

    // 钟
    const beta = -1.3 + lean + (st === 'stun' ? Math.sin(v.time * 40) * 0.03 : 0) + headUp * -0.12;
    const bellC = hp(-8, -56);
    const bx = new Xf().translate(bellC.x, bellC.y).rotate(beta);
    const mouth = bx.apply(0, 31);
    const faceC = { x: mouth.x - 3 + headUp * 1, y: mouth.y + 4 - headUp * 2 };

    // 手臂
    const shF = hp(13, -34), shB = hp(-6, -38);
    const handF = { x: shF.x + dir.x * 31, y: shF.y + dir.y * 31 };
    const armF = ik(shF.x, shF.y, handF.x, handF.y, 18, 17, -1);
    const handB = twoHand ? { x: shF.x + dir.x * 16, y: shF.y + dir.y * 16 } : hp(-14, 10 + Math.sin(this.walk) * 2);
    const armB = ik(shB.x, shB.y, handB.x, handB.y, 18, 17, -1);
    const logA = { x: handF.x - dir.x * 14, y: handF.y - dir.y * 14 }, logB = { x: shF.x + dir.x * 94, y: shF.y + dir.y * 94 };

    // 布料
    const hemX = [-24, -12, 2, 16];
    this.tat.forEach((r, i) => {
      const a = W(hp(hemX[i], 23 + (i % 2) * 2));
      r.step(a.x, a.y, dt, { grav: 1000, damp: 0.9, stiff: 35, rest: (j) => ({ x: -f * j * 1.2, y: j * 4.2 }), wind: 70, time: v.time + i });
    });
    const chin = W({ x: faceC.x + 3, y: faceC.y + 7 });
    this.beard.forEach((r, i) => r.step(chin.x + f * (i - 1) * 1.6, chin.y, dt, { grav: 700, damp: 0.9, stiff: 30, rest: (j) => ({ x: -f * j * (1.2 + i * 0.6), y: j * 3.8 }), wind: 90, time: v.time + i * 1.3 }));
    const tp = [bx.apply(-14, 22), bx.apply(4, 29)];
    this.talis.forEach((r, i) => { const a = W(tp[i]); r.step(a.x, a.y, dt, { grav: 800, damp: 0.92, wind: 140, time: v.time + i * 2.1 }); });

    this.tip = W(logB); this.eye = W({ x: faceC.x + 3, y: faceC.y - 2 }); this.bellPt = W(bx.apply(0, 0));

    const alpha = v.dead ? Math.max(0, 1 - Math.max(0, v.deadT - 1) / 1.5) : 1;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    const hot = v.phase >= 2 || v.elite;

    // 布须（世界空间）
    inWorld(ctx, base, () => {
      this.tat.forEach((r, i) => { ctx.fillStyle = i % 2 ? C.robeBack : C.kasaya; ctx.fill(r.ribbon((k) => 9 - k * 4, 4, 11 + i)); });
    });
    root.set(ctx, base);

    // 后臂、后腿、前腿
    this.limb(ctx, shB, armB, 7.5, 6, C.skinBack, null, C.robeBack);
    this.fist(ctx, handB.x, handB.y, 6.5, C.skinBack);
    this.leg(ctx, hipB, legB, C, true);
    this.leg(ctx, hipF, legF, C, false);

    // 袍身
    const body = new Path2D();
    const P = [hp(-26, 24), hp(-30, -6), hp(-28, -32), hp(-12, -50), hp(12, -47), hp(27, -30), hp(31, -8), hp(28, 22)];
    body.moveTo(P[0].x, P[0].y);
    for (let i = 1; i < P.length; i++) { const q = P[i], m = P[i - 1]; body.quadraticCurveTo(m.x, m.y, (m.x + q.x) / 2, (m.y + q.y) / 2); }
    body.lineTo(P[7].x, P[7].y);
    for (let i = 1; i <= 7; i++) { const q = { x: lerp(P[7].x, P[0].x, i / 8), y: lerp(P[7].y, P[0].y, i / 8) }; body.lineTo(q.x, q.y + (i % 2 ? 5 + h01(i, 3) * 3 : 0)); }
    body.closePath();
    rim(ctx, body, C.robe, C.robeRim, 1.5, 1.5);
    // 袈裟：斜披，金线田相
    const kas = new Path2D();
    const K = [hp(-27, -26), hp(-8, -49), hp(14, -46), hp(29, -12), hp(26, 16), hp(4, 20), hp(-24, 8)];
    kas.moveTo(K[0].x, K[0].y); for (let i = 1; i < K.length; i++) kas.lineTo(K[i].x, K[i].y); kas.closePath();
    rim(ctx, kas, C.kasaya, C.kasayaRim, 1.2, 1.3);
    ctx.save(); ctx.clip(kas);
    ctx.strokeStyle = C.kasayaGrid; ctx.lineWidth = 0.9;
    for (let gx = -30; gx <= 30; gx += 13) { const a = hp(gx, -52), b = hp(gx + 4, 24); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    for (let gy = -44; gy <= 20; gy += 15) { const a = hp(-32, gy), b = hp(32, gy - 6); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.restore();

    // 梵钟
    this.bell(ctx, bx, root, base, C, v, hot);
    // 背钟的麻绳
    ctx.strokeStyle = C.rope; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const r1a = bx.apply(-6, -18), r1b = hp(26, -6), r2a = bx.apply(10, -24), r2b = hp(12, 10);
    for (const [a, b] of [[r1a, r1b], [r2a, r2b]] as [Pt, Pt][]) {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2 + 6, (a.y + b.y) / 2 - 2, b.x, b.y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(40,28,14,0.6)'; ctx.lineWidth = 0.8;
    for (const [a, b] of [[r1a, r1b], [r2a, r2b]] as [Pt, Pt][]) {
      for (let k = 0.05; k < 1; k += 0.07) {
        const x = (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * ((a.x + b.x) / 2 + 6) + k * k * b.x;
        const y = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * ((a.y + b.y) / 2 - 2) + k * k * b.y;
        ctx.beginPath(); ctx.moveTo(x - 1.2, y - 1.2); ctx.lineTo(x + 1.2, y + 1.2); ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';

    // 一百零八颗念珠（只画看得见的半圈）
    for (let i = 0; i < 11; i++) {
      const k = i / 10, q = hp(lerp(-2, 26, k), lerp(-44, -14, k) + Math.sin(k * Math.PI) * 6);
      ctx.fillStyle = C.bead; ctx.beginPath(); ctx.arc(q.x, q.y, 2.9, 0, Math.PI * 2); ctx.fill();
      if (hot && !v.flash) { ctx.fillStyle = `rgba(${C.crack},${0.5 + 0.3 * Math.sin(v.time * 4 + i)})`; ctx.beginPath(); ctx.arc(q.x, q.y, 1.3, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(230,190,130,0.45)'; ctx.fillRect(q.x - 1.2, q.y - 1.8, 1, 0.8); }
    }

    // 钟口里的脸
    this.face(ctx, faceC, C, v, hot, headUp);
    inWorld(ctx, base, () => {
      this.beard.forEach((r, i) => { ctx.fillStyle = i === 1 ? C.beard : C.faceShade; ctx.fill(r.ribbon((k) => (i === 1 ? 5 : 3.4) * (1 - k * 0.75), 3, 21 + i)); });
      // 钟上垂下的镇魂符
      this.talis.forEach((r, i) => {
        ctx.fillStyle = v.elite ? '#9fb8a8' : '#cfae5c';
        ctx.fill(r.ribbon(() => 4.2, 2, 31 + i));
        ctx.fillStyle = 'rgba(150,30,20,0.85)';
        for (let j = 1; j < r.n - 1; j++) ctx.fillRect(r.x[j] - 0.8, r.y[j] - 0.4, 1.6, 0.9);
      });
    });
    root.set(ctx, base);

    // 撞钟巨木 + 前臂
    this.log(ctx, logA, logB, dir, C, v, hot);
    this.limb(ctx, shF, armF, 8.5, 7, C.skin, C.skinRim, C.kasaya);
    this.fist(ctx, handF.x, handF.y, 7, C.skin);
    // 腕上的念珠
    const wx = lerp(armF.kx, armF.ex, 0.7), wy = lerp(armF.ky, armF.ey, 0.7);
    ctx.strokeStyle = C.bead; ctx.lineWidth = 2.4; ctx.setLineDash([2, 1]);
    ctx.beginPath(); ctx.ellipse(wx, wy, 6.5, 2.4, Math.atan2(armF.ey - armF.ky, armF.ex - armF.kx) + Math.PI / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // 二阶段：余烬从裂缝升起
    if (hot && !v.dead) {
      inWorld(ctx, base, () => {
        for (let i = 0; i < 10; i++) {
          const k = (v.time * 0.5 + i / 10) % 1;
          const p = this.bellPt;
          const x = p.x + (h01(i, 1) - 0.5) * 60 + Math.sin(v.time * 2 + i) * 6, y = p.y + 10 - k * 90;
          ctx.fillStyle = `rgba(${C.crack},${(1 - k) * 0.85})`;
          ctx.fillRect(x, y, 1.6, 1.6);
        }
      });
    }
    ctx.restore();
    void deadK;
  }

  // ---------- 部件 ----------
  private limb(ctx: CanvasRenderingContext2D, a: Pt, l: { kx: number; ky: number; ex: number; ey: number }, r1: number, r2: number, fill: string, light: string | null, sleeve: string) {
    const p = new Path2D();
    capsule(p, a.x, a.y, r1, l.kx, l.ky, r2);
    capsule(p, l.kx, l.ky, r2, l.ex, l.ey, r2 * 0.85);
    if (light) rim(ctx, p, fill, light, 1, 1); else { ctx.fillStyle = fill; ctx.fill(p); }
    // 宽袖
    const s = new Path2D();
    capsule(s, a.x, a.y, r1 + 1.5, lerp(a.x, l.kx, 0.75), lerp(a.y, l.ky, 0.75), r1 + 0.5);
    if (light) { rim(ctx, s, sleeve, C2(sleeve), 1, 1); } else { ctx.fillStyle = sleeve; ctx.fill(s); }
  }

  private fist(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + 1, y + i * 2.4); ctx.lineTo(x + r - 0.5, y + i * 2.4); ctx.stroke(); }
  }

  private leg(ctx: CanvasRenderingContext2D, hip: Pt, l: { kx: number; ky: number; ex: number; ey: number }, C: typeof BASE, back: boolean) {
    const p = new Path2D();
    capsule(p, hip.x, hip.y, 10, l.kx, l.ky, 8);
    capsule(p, l.kx, l.ky, 8, l.ex, l.ey - 4, 6.5);
    if (back) { ctx.fillStyle = C.skinBack; ctx.fill(p); }
    else rim(ctx, p, C.skin, C.skinRim, 1, 1);
    // 裹腿布
    ctx.save(); ctx.clip(p);
    ctx.strokeStyle = back ? 'rgba(90,80,70,0.35)' : 'rgba(170,150,120,0.5)'; ctx.lineWidth = 1.4;
    for (let k = 0.2; k < 0.95; k += 0.13) {
      const x = lerp(l.kx, l.ex, k), y = lerp(l.ky, l.ey, k);
      ctx.beginPath(); ctx.moveTo(x - 9, y - 2.5); ctx.lineTo(x + 9, y + 2.5); ctx.stroke();
    }
    ctx.restore();
    // 赤足
    ctx.fillStyle = back ? C.skinBack : C.skin;
    ctx.beginPath(); ctx.moveTo(l.ex - 7, l.ey); ctx.lineTo(l.ex + 11, l.ey); ctx.quadraticCurveTo(l.ex + 12, l.ey - 4, l.ex + 4, l.ey - 6); ctx.lineTo(l.ex - 6, l.ey - 6); ctx.closePath(); ctx.fill();
    if (!back) { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.7; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(l.ex + 6 + i * 1.7, l.ey); ctx.lineTo(l.ex + 6 + i * 1.7, l.ey - 1.8); ctx.stroke(); } }
  }

  private bell(ctx: CanvasRenderingContext2D, bx: Xf, root: Xf, base: DOMMatrix, C: typeof BASE, v: AbbotView, hot: boolean) {
    ctx.save();
    const m = root.clone(); m.a = 1; // 占位，下面直接组合
    void m;
    const full = new Xf(root.a, root.b, root.c, root.d, root.e, root.f);
    const comb = new DOMMatrix([full.a, full.b, full.c, full.d, full.e, full.f]).multiply(new DOMMatrix([bx.a, bx.b, bx.c, bx.d, bx.e, bx.f]));
    ctx.setTransform(base.multiply(comb));
    // 龙纽
    ctx.strokeStyle = C.bellHi; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -35, 6, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.fillStyle = C.bellDark; ctx.fillRect(-7, -33, 14, 4);
    const p = new Path2D();
    p.moveTo(-15, -30);
    p.quadraticCurveTo(0, -36, 15, -30);
    p.quadraticCurveTo(21, -24, 22, -6);
    p.quadraticCurveTo(23, 18, 29, 30);
    p.lineTo(30, 33); p.lineTo(-30, 33); p.lineTo(-29, 30);
    p.quadraticCurveTo(-23, 18, -22, -6);
    p.quadraticCurveTo(-21, -24, -15, -30);
    p.closePath();
    const g = ctx.createLinearGradient(-28, 0, 28, 0);
    g.addColorStop(0, C.bellDark); g.addColorStop(0.3, C.bellLit); g.addColorStop(0.55, C.bell); g.addColorStop(1, C.bellDark);
    ctx.fillStyle = g; ctx.fill(p);
    ctx.save(); ctx.clip(p);
    // 袈裟襷：纵横凸带
    ctx.strokeStyle = 'rgba(20,14,6,0.55)'; ctx.lineWidth = 2.2;
    for (const x of [-9, 9]) { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x * 1.25, 34); ctx.stroke(); }
    for (const y of [-13, 14]) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(30, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(230,200,140,0.25)'; ctx.lineWidth = 0.8;
    for (const x of [-8, 10]) { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x * 1.25, 34); ctx.stroke(); }
    // 乳（上段的钉）
    for (const sx of [-1, 1]) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const x = sx * (13 + c * 4 + r * 0.5), y = -27 + r * 4.5;
      ctx.fillStyle = 'rgba(15,10,4,0.6)'; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.6, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = v.flash ? '#fff' : C.bellHi; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    // 铭文
    ctx.fillStyle = 'rgba(20,14,6,0.55)';
    for (let i = 0; i < 6; i++) ctx.fillRect(-3, -9 + i * 3.6, 6, 1.4);
    // 撞座：莲花
    const glowK = v.bellGlow;
    ctx.save(); ctx.translate(16, 22);
    ctx.fillStyle = glowK > 0.05 ? `rgba(255,${200 - glowK * 80},120,${0.4 + glowK * 0.6})` : 'rgba(20,14,6,0.45)';
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.ellipse(0, -4, 1.6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 铜绿
    ctx.fillStyle = C.verdigris;
    ctx.beginPath(); ctx.moveTo(-18, -24); ctx.quadraticCurveTo(-14, 4, -17, 30); ctx.lineTo(-11, 30); ctx.quadraticCurveTo(-12, 0, -13, -26); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -32); ctx.quadraticCurveTo(7, -20, 5, -12); ctx.lineTo(8, -14); ctx.closePath(); ctx.fill();
    // 二阶段裂纹
    if (hot) {
      const a = 0.6 + 0.4 * Math.sin(v.time * 6);
      ctx.strokeStyle = `rgba(${C.crack},${a})`; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-4, -33); ctx.lineTo(-1, -20); ctx.lineTo(-6, -9); ctx.lineTo(0, 3); ctx.lineTo(-3, 16); ctx.lineTo(3, 33);
      ctx.moveTo(-1, -20); ctx.lineTo(8, -16); ctx.moveTo(0, 3); ctx.lineTo(-12, 8); ctx.stroke();
    }
    if (glowK > 0.01) { ctx.fillStyle = `rgba(255,120,60,${0.25 * glowK})`; ctx.fill(p); }
    ctx.restore();
    ctx.strokeStyle = C.bellHi; ctx.lineWidth = 1.4; ctx.stroke(p);
    // 钟口
    ctx.fillStyle = '#050403';
    ctx.beginPath(); ctx.ellipse(0, 33, 30, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.bellHi; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 33, 30, 5.5, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (hot || v.bellGlow > 0.01) {
      const c = this.bellPt;
      ctx.save(); ctx.setTransform(base);
      addGlow(ctx, c.x, c.y, 90, C.crack, (hot ? 0.18 : 0) + 0.45 * v.bellGlow);
      ctx.restore();
    }
  }

  private face(ctx: CanvasRenderingContext2D, c: Pt, C: typeof BASE, v: AbbotView, hot: boolean, headUp: number) {
    // 枯瘦的长脸，从钟口的黑暗里探出
    const p = new Path2D();
    p.moveTo(c.x - 4, c.y - 9);
    p.quadraticCurveTo(c.x + 6, c.y - 11, c.x + 8, c.y - 3);
    p.quadraticCurveTo(c.x + 9, c.y + 4, c.x + 5, c.y + 9);
    p.quadraticCurveTo(c.x - 1, c.y + 11, c.x - 4, c.y + 5);
    p.closePath();
    const g = ctx.createLinearGradient(c.x - 4, c.y - 9, c.x + 8, c.y + 8);
    g.addColorStop(0, C.faceShade); g.addColorStop(0.5, C.face); g.addColorStop(1, C.faceShade);
    ctx.fillStyle = g; ctx.fill(p);
    // 深陷的眼窝与眼中火
    ctx.fillStyle = '#120c08';
    ctx.beginPath(); ctx.ellipse(c.x + 4.5, c.y - 2.5, 2.4, 1.6, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x - 0.5, c.y - 2.2, 1.8, 1.4, -0.2, 0, Math.PI * 2); ctx.fill();
    const hotEye = v.state === 'windup' || (v.state === 'active' && v.atk === 'charge') || headUp > 0.5;
    if (!v.dead) {
      ctx.fillStyle = hotEye ? '#ffe0a0' : `rgb(${C.eye})`;
      ctx.beginPath(); ctx.arc(c.x + 4.8, c.y - 2.5, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(c.x - 0.3, c.y - 2.2, 0.8, 0, Math.PI * 2); ctx.fill();
      addGlow(ctx, c.x + 4, c.y - 2.5, hotEye ? 34 : hot ? 22 : 14, C.eye, hotEye ? 0.65 : 0.35);
    }
    // 皱纹、鼻、口
    ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(c.x + 6.5, c.y - 1); ctx.lineTo(c.x + 8.4, c.y + 2.5); ctx.lineTo(c.x + 6.5, c.y + 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x + 1, c.y + 5.5 + headUp); ctx.quadraticCurveTo(c.x + 4, c.y + 6.5 + headUp * 2, c.x + 6.5, c.y + 5.5 + headUp); ctx.stroke();
    if (headUp > 0.5) { ctx.fillStyle = '#120c08'; ctx.beginPath(); ctx.ellipse(c.x + 3.8, c.y + 6.6, 2.6, 1.4 + headUp, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(c.x - 2.5, c.y - 6); ctx.quadraticCurveTo(c.x + 1, c.y - 7, c.x + 3, c.y - 6.5); ctx.stroke();
    // 长寿眉：垂到颊边
    ctx.strokeStyle = C.beard; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    const sw = Math.sin(v.time * 2) * 0.8;
    ctx.beginPath(); ctx.moveTo(c.x + 6.5, c.y - 4.5); ctx.quadraticCurveTo(c.x + 1, c.y - 6.5, c.x - 6, c.y - 1 + sw); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x + 1.5, c.y - 4); ctx.quadraticCurveTo(c.x - 3, c.y - 4.5, c.x - 7.5, c.y + 2 + sw); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  private log(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, d: Pt, C: typeof BASE, v: AbbotView, hot: boolean) {
    const n = { x: -d.y, y: d.x };
    const r0 = 5.5, r1 = 7.5;
    const p = new Path2D();
    p.moveTo(a.x + n.x * r0, a.y + n.y * r0);
    p.lineTo(b.x + n.x * r1, b.y + n.y * r1);
    p.quadraticCurveTo(b.x + d.x * 3, b.y + d.y * 3, b.x - n.x * r1, b.y - n.y * r1);
    p.lineTo(a.x - n.x * r0, a.y - n.y * r0);
    p.quadraticCurveTo(a.x - d.x * 2.5, a.y - d.y * 2.5, a.x + n.x * r0, a.y + n.y * r0);
    p.closePath();
    rim(ctx, p, C.wood, C.robeRim, 1, 1);
    // 木纹
    ctx.save(); ctx.clip(p);
    ctx.strokeStyle = C.woodGrain; ctx.lineWidth = 0.8;
    for (const o of [-3.5, -0.5, 2.5, 5]) {
      ctx.beginPath(); ctx.moveTo(a.x + n.x * o, a.y + n.y * o);
      ctx.lineTo(lerp(a.x, b.x, 0.5) + n.x * (o + 0.8), lerp(a.y, b.y, 0.5) + n.y * (o + 0.8));
      ctx.lineTo(b.x + n.x * o * 1.2, b.y + n.y * o * 1.2); ctx.stroke();
    }
    // 铁箍
    for (const k of [0.32, 0.62, 0.86]) {
      const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k), r = lerp(r0, r1, k) + 0.8;
      ctx.strokeStyle = C.iron; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + n.x * r, y + n.y * r); ctx.lineTo(x - n.x * r, y - n.y * r); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,190,170,0.35)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x + n.x * r - d.x, y + n.y * r - d.y); ctx.lineTo(x - n.x * r - d.x, y - n.y * r - d.y); ctx.stroke();
    }
    // 撞头的磨损与青铜包头
    ctx.fillStyle = v.flash ? '#fff' : C.bell;
    ctx.beginPath(); ctx.moveTo(b.x - d.x * 9 + n.x * 8.5, b.y - d.y * 9 + n.y * 8.5); ctx.lineTo(b.x + n.x * 8.5, b.y + n.y * 8.5);
    ctx.lineTo(b.x - n.x * 8.5, b.y - n.y * 8.5); ctx.lineTo(b.x - d.x * 9 - n.x * 8.5, b.y - d.y * 9 - n.y * 8.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (hot) {
      ctx.strokeStyle = `rgba(${C.crack},0.7)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(lerp(a.x, b.x, 0.7), lerp(a.y, b.y, 0.7)); ctx.lineTo(lerp(a.x, b.x, 0.78) + n.x * 3, lerp(a.y, b.y, 0.78) + n.y * 3); ctx.lineTo(lerp(a.x, b.x, 0.9) - n.x * 2, lerp(a.y, b.y, 0.9) - n.y * 2); ctx.stroke();
    }
    // 握处缠绳
    ctx.strokeStyle = C.rope; ctx.lineWidth = 1.2;
    for (let k = 0.02; k < 0.22; k += 0.035) {
      const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k);
      ctx.beginPath(); ctx.moveTo(x + n.x * 6 - d.x * 1.5, y + n.y * 6 - d.y * 1.5); ctx.lineTo(x - n.x * 6 + d.x * 1.5, y - n.y * 6 + d.y * 1.5); ctx.stroke();
    }
  }
}
