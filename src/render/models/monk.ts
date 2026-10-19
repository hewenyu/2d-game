// 失声僧：寺中僧人。始钟逆鸣那夜，他们的声音被收进了钟里，从此头上罩着一口铜钟，仍佝偻着做早课。
// 持月牙铲（一头月牙刃，一头平铲）。举铲时霸体，劈空后铲刃卡进地里，有很长的硬直。
import { clamp, lerp } from '../../core/math';
import { addGlow, bellPath, glint } from '../draw';
import { capsule, Clock, h01, ik, inWorld, rim, Rope, Xf, type Pt } from '../rig';

export interface MonkView {
  x: number; y: number; facing: number;
  state: string; t: number; wind: number;
  walk: number; vx: number;
  flash: boolean; dead: boolean; deadT: number;
  time: number; seed: number;
}

const PAL = {
  robe: '#191412', robeBack: '#100c0b', robeRim: 'rgba(206,160,110,0.55)',
  kasaya: '#45291a', kasayaDark: 'rgba(16,9,5,0.4)', kasayaRim: '#9c6f42', kasayaBorder: 'rgba(196,150,80,0.6)',
  bronze: '#55452a', bronzeHi: '#b8914f', verdigris: 'rgba(90,150,118,0.55)',
  skin: '#4f4a45', skinBack: '#2c2826', skinRim: 'rgba(200,190,170,0.5)',
  wood: '#3a2a1c', iron: '#7a7f88', ironHi: '#d3d6db', rust: 'rgba(120,58,28,0.6)',
  bead: '#3a2414', glow: '255,150,70',
};
const FLASH = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, k === 'glow' ? v : '#f4efe6'])) as typeof PAL;

export class MonkModel {
  private tat = [new Rope(4, 3), new Rope(4, 2.8), new Rope(3, 2.6)];
  private clock = new Clock();

  draw(ctx: CanvasRenderingContext2D, v: MonkView) {
    const dt = this.clock.tick(v.time);
    const C = v.flash ? FLASH : PAL;
    const f = v.facing;
    const base = ctx.getTransform();
    const root = new Xf().translate(v.x, v.y).scale(f, 1);

    // ---------- 姿态 ----------
    const st = v.state, t = v.t;
    const walking = Math.abs(v.vx) > 10;
    let bob = walking ? Math.abs(Math.sin(v.walk)) * 1.3 : Math.sin(v.time * 1.7 + v.seed) * 0.5;
    let lean = 0.32, drop = 0, headTilt = 0.35;
    let G: Pt, th: number, Lf = 21, Lb = 20;
    if (st === 'windup') {
      const k = clamp(t / v.wind, 0, 1), e = 1 - (1 - k) ** 2;
      lean = lerp(0.32, -0.22, e); headTilt = lerp(0.35, -0.25, e);
      G = { x: lerp(8, -1, e), y: lerp(-22, -37, e) }; th = lerp(-0.6, -2.55, e);
      bob = 0; drop = -1.5 * e;
    } else if (st === 'strike') {
      const k = clamp(t / 0.16, 0, 1), e = 1 - (1 - k) ** 3;
      lean = lerp(-0.22, 0.5, e); headTilt = lerp(-0.25, 0.5, e);
      G = { x: lerp(-1, 14, e), y: lerp(-37, -18, e) }; th = lerp(-2.55, 0.62, e);
      bob = 0; drop = 2 * e;
    } else if (st === 'recover') {
      const k = clamp(t / 0.62, 0, 1);
      lean = lerp(0.5, 0.36, k); headTilt = 0.5; drop = lerp(2, 0, k);
      G = { x: lerp(14, 11, k), y: lerp(-18, -19, k) }; th = lerp(0.62, 0.4, k);
      bob = Math.abs(Math.sin(v.time * 9)) * 0.8; // 喘
    } else if (st === 'stagger') {
      const k = clamp(t / 0.5, 0, 1);
      lean = -0.35 + k * 0.3; headTilt = -0.4 + k * 0.4;
      G = { x: 1, y: -30 }; th = -1.9; bob = 0;
    } else if (st === 'chase') {
      lean = 0.42; G = { x: 9, y: -21 - bob }; th = -0.55; Lf = 20; Lb = 17;
    } else {
      G = { x: 10, y: -21 - bob * 0.5 }; th = -Math.PI / 2 - 0.1 + Math.sin(v.walk) * 0.05;
    }
    let deadK = 0;
    if (v.dead) { deadK = clamp(v.deadT / 0.5, 0, 1); drop = 9 * deadK; lean = 0.32 + deadK * 0.8; headTilt = 0.9 * deadK + 0.35; }
    const hipY = -16 + drop - bob;
    const cs = Math.cos(lean), sn = Math.sin(lean);
    const hp = (x: number, y: number): Pt => ({ x: -1 + x * cs - y * sn, y: hipY + x * sn + y * cs });
    const W = (p: Pt) => root.apply(p.x, p.y);
    if (deadK > 0) { G = { x: G.x + deadK * 6, y: lerp(G.y, -3, deadK) }; th = lerp(th, 0.05, deadK); }
    const u = { x: Math.cos(th), y: Math.sin(th) };
    const head = { x: G.x + u.x * Lf, y: G.y + u.y * Lf }, butt = { x: G.x - u.x * Lb, y: G.y - u.y * Lb };

    // 腿
    let fF: Pt, fB: Pt;
    if (walking && st !== 'windup' && st !== 'strike') {
      fF = { x: 1 + Math.sin(v.walk) * 5, y: -Math.max(0, Math.cos(v.walk)) * 3 };
      fB = { x: -3 + Math.sin(v.walk + Math.PI) * 5, y: -Math.max(0, Math.cos(v.walk + Math.PI)) * 3 };
    } else if (st === 'strike' || st === 'recover') { fF = { x: 6, y: 0 }; fB = { x: -6, y: 0 }; }
    else { fF = { x: 2.5, y: 0 }; fB = { x: -4, y: 0 }; }
    const hipF = hp(1.5, 0), hipB = hp(-2, 0);
    const legF = ik(hipF.x, hipF.y, fF.x, fF.y, 9, 8.5, 1), legB = ik(hipB.x, hipB.y, fB.x, fB.y, 9, 8.5, 1);

    // 手
    const shF = hp(6, -12.5), shB = hp(2, -13.5);
    const hB = { x: G.x - u.x * 8, y: G.y - u.y * 8 };
    const armF = ik(shF.x, shF.y, G.x, G.y, 7.5, 7.5, -1), armB = ik(shB.x, shB.y, hB.x, hB.y, 7.5, 7.5, -1);

    // 布须
    const hemPts = [hp(-11, 1), hp(-6, 2), hp(-1, 2.5)];
    this.tat.forEach((r, i) => {
      const a = W(hemPts[i]);
      r.step(a.x, a.y, dt, { grav: 1000, damp: 0.9, stiff: 40, rest: (j) => ({ x: -f * j * 0.8, y: j * 2.8 }), wind: 60, time: v.time + i });
    });

    const alpha = v.dead ? Math.max(0, 1 - v.deadT / 0.9) : 1;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    root.set(ctx, base);

    // 背侧手臂、腿
    this.limb(ctx, shB, armB, 1.8, 1.2, C.skinBack, null);
    this.limb(ctx, hipB, legB, 1.9, 1.3, C.skinBack, null);
    // 布须（世界空间）
    inWorld(ctx, base, () => {
      this.tat.forEach((r, i) => { ctx.fillStyle = i === 2 ? C.robe : C.robeBack; ctx.fill(r.ribbon((k) => 4 - k * 1.5, 2.2, v.seed + i)); });
    });
    root.set(ctx, base);
    // 月牙铲（在身后的部分先画）
    this.spade(ctx, head, butt, u, C);

    // 内袍
    const robe = new Path2D();
    const r0 = hp(-6, -13), r1 = hp(6.5, -12), r2 = hp(9, -2), r3 = hp(11, 2.5), r4 = hp(-13, 1.5), r5 = hp(-10, -8);
    robe.moveTo(r0.x, r0.y);
    robe.quadraticCurveTo(hp(2, -16).x, hp(2, -16).y, r1.x, r1.y);
    robe.quadraticCurveTo(hp(10, -7).x, hp(10, -7).y, r2.x, r2.y);
    robe.lineTo(r3.x, r3.y);
    // 破烂下摆
    for (let i = 1; i <= 7; i++) {
      const k = i / 8, q = { x: lerp(r3.x, r4.x, k), y: lerp(r3.y, r4.y, k) };
      robe.lineTo(q.x, q.y + (i % 2 ? 2.2 + h01(i, v.seed) * 1.5 : -0.5));
    }
    robe.lineTo(r4.x, r4.y);
    robe.quadraticCurveTo(r5.x - 1, r5.y, r0.x, r0.y);
    robe.closePath();
    rim(ctx, robe, C.robe, C.robeRim, 0.9, 1);
    this.limb(ctx, hipF, legF, 2, 1.4, C.skin, C.skinRim);

    // 袈裟：斜披，田字格缝线，旧金镶边
    const kas = new Path2D();
    const k0 = hp(-7, -12), k1 = hp(5, -13.5), k2 = hp(9.5, -4), k3 = hp(7, -0.5), k4 = hp(-12, -1);
    kas.moveTo(k0.x, k0.y);
    kas.quadraticCurveTo(hp(0, -17).x, hp(0, -17).y, k1.x, k1.y);
    kas.lineTo(k2.x, k2.y); kas.lineTo(k3.x, k3.y); kas.lineTo(k4.x, k4.y);
    kas.quadraticCurveTo(hp(-12.5, -7).x, hp(-12.5, -7).y, k0.x, k0.y);
    kas.closePath();
    rim(ctx, kas, C.kasaya, C.kasayaRim, 0.8, 0.9);
    ctx.save(); ctx.clip(kas);
    ctx.strokeStyle = C.kasayaDark; ctx.lineWidth = 0.5;
    for (let gx = -14; gx <= 12; gx += 5.5) { const a = hp(gx, -18), b = hp(gx + 2, 3); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    for (let gy = -12; gy <= 2; gy += 6) { const a = hp(-14, gy), b = hp(12, gy - 3); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    // 补丁色差
    ctx.fillStyle = 'rgba(120,70,30,0.35)'; const pa = hp(-5, -8); ctx.fillRect(pa.x, pa.y, 4, 4);
    ctx.fillStyle = 'rgba(20,10,5,0.3)'; const pb = hp(2, -5); ctx.fillRect(pb.x, pb.y, 4, 4);
    ctx.restore();
    ctx.strokeStyle = C.kasayaBorder; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(k1.x, k1.y); ctx.lineTo(k2.x, k2.y); ctx.stroke();

    // 佛珠
    for (let i = 0; i < 8; i++) {
      const k = i / 7, q = hp(lerp(-4, 7, k), lerp(-12.5, -6.5, k) + Math.sin(k * Math.PI) * 2.5);
      ctx.fillStyle = C.bead; ctx.beginPath(); ctx.arc(q.x, q.y, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(220,170,110,0.5)'; ctx.fillRect(q.x - 0.5, q.y - 0.7, 0.6, 0.5);
    }

    // 铜钟头罩
    this.bellHead(ctx, hp(9, -18.5), headTilt + lean * 0.4, C, v);

    // 前臂（握铲）
    this.limb(ctx, shF, armF, 2.3, 1.4, C.skin, C.skinRim, C.robe);
    ctx.restore();

    // 出招闪光：月牙刃尖
    if (st === 'windup' && t > v.wind - 0.16 && !v.dead) {
      const k = 1 - (v.wind - t) / 0.16;
      const tip = root.apply(head.x + u.x * 3, head.y + u.y * 3);
      ctx.save(); ctx.setTransform(base);
      glint(ctx, tip.x, tip.y, 10 + k * 6, 1 - k * 0.3);
      ctx.restore();
    }
  }

  private limb(ctx: CanvasRenderingContext2D, a: Pt, l: { kx: number; ky: number; ex: number; ey: number }, r1: number, r2: number, fill: string, light: string | null, sleeve?: string) {
    const p = new Path2D();
    capsule(p, a.x, a.y, r1, l.kx, l.ky, r2);
    capsule(p, l.kx, l.ky, r2, l.ex, l.ey, r2 * 0.85);
    if (light) rim(ctx, p, fill, light, 0.5, 0.5); else { ctx.fillStyle = fill; ctx.fill(p); }
    if (sleeve) {
      // 宽袖口
      const s = new Path2D();
      const mx = lerp(a.x, l.kx, 0.9), my = lerp(a.y, l.ky, 0.9);
      capsule(s, a.x, a.y, 2.7, mx, my, 2.2);
      rim(ctx, s, sleeve, PAL.robeRim, 0.5, 0.6);
    }
    // 枯指
    ctx.strokeStyle = fill; ctx.lineWidth = 0.6;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(l.ex, l.ey); ctx.lineTo(l.ex + 1.8, l.ey + i * 0.9 + 1); ctx.stroke(); }
  }

  private spade(ctx: CanvasRenderingContext2D, head: Pt, butt: Pt, u: Pt, C: typeof PAL) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.wood; ctx.lineWidth = 1.9;
    ctx.beginPath(); ctx.moveTo(butt.x, butt.y); ctx.lineTo(head.x, head.y); ctx.stroke();
    // 铁箍
    ctx.strokeStyle = C.iron; ctx.lineWidth = 2.4;
    for (const k of [0.08, 0.92]) {
      const x = lerp(butt.x, head.x, k), y = lerp(butt.y, head.y, k);
      ctx.beginPath(); ctx.moveTo(x - u.x * 0.6, y - u.y * 0.6); ctx.lineTo(x + u.x * 0.6, y + u.y * 0.6); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    const n = { x: -u.y, y: u.x };
    // 月牙刃
    const c = { x: head.x + u.x * 2, y: head.y + u.y * 2 };
    const p = new Path2D();
    const a = Math.atan2(u.y, u.x);
    p.arc(c.x, c.y, 7.5, a - 1.95, a + 1.95);
    p.arc(c.x + u.x * 3.8, c.y + u.y * 3.8, 6, a + 1.45, a - 1.45, true);
    p.closePath();
    ctx.fillStyle = C.iron; ctx.fill(p);
    ctx.strokeStyle = C.ironHi; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(c.x + u.x * 3.8, c.y + u.y * 3.8, 6, a + 1.4, a - 1.4, true); ctx.stroke();
    ctx.fillStyle = C.rust; ctx.beginPath(); ctx.arc(c.x - n.x * 4 + u.x * 1, c.y - n.y * 4 + u.y * 1, 1.3, 0, Math.PI * 2); ctx.fill();
    // 平铲
    const b0 = { x: butt.x - u.x * 1, y: butt.y - u.y * 1 };
    ctx.fillStyle = C.iron;
    ctx.beginPath();
    ctx.moveTo(b0.x + n.x * 1.3, b0.y + n.y * 1.3);
    ctx.lineTo(b0.x - u.x * 5 + n.x * 3, b0.y - u.y * 5 + n.y * 3);
    ctx.lineTo(b0.x - u.x * 5.8 - n.x * 3, b0.y - u.y * 5.8 - n.y * 3);
    ctx.lineTo(b0.x - n.x * 1.3, b0.y - n.y * 1.3);
    ctx.closePath(); ctx.fill();
  }

  private bellHead(ctx: CanvasRenderingContext2D, c: Pt, tilt: number, C: typeof PAL, v: MonkView) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(tilt);
    const p = new Path2D();
    bellPath(p, 0, -8, 13, 14);
    const g = ctx.createLinearGradient(-6, 0, 6, 0);
    g.addColorStop(0, C.bronze); g.addColorStop(0.55, v.flash ? C.bronze : '#7a6238'); g.addColorStop(1, C.bronze);
    rim(ctx, p, g, C.bronzeHi, 0.7, 0.8);
    ctx.save(); ctx.clip(p);
    // 钟带与铭文
    ctx.strokeStyle = 'rgba(30,22,12,0.7)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-6, -3.5); ctx.lineTo(6, -3.5); ctx.moveTo(-6.5, 3.5); ctx.lineTo(6.5, 3.5); ctx.stroke();
    ctx.fillStyle = 'rgba(30,22,12,0.6)';
    for (let i = 0; i < 3; i++) ctx.fillRect(-3.5 + i * 2.6, -1.8, 1, 3.6);
    // 铜绿
    ctx.fillStyle = C.verdigris;
    ctx.beginPath(); ctx.moveTo(-4.6, -6); ctx.lineTo(-3.2, 5); ctx.lineTo(-1.8, -5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 钟纽
    ctx.strokeStyle = C.bronzeHi; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(0, -9.2, 1.5, Math.PI, 0); ctx.stroke();
    // 钟口里的黑暗与裂缝里透出的光
    ctx.fillStyle = '#050403';
    ctx.beginPath(); ctx.ellipse(0, 6, 6.2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
    const wind = v.state === 'windup';
    ctx.strokeStyle = wind ? '#ffd27a' : '#ff8a3a'; ctx.lineWidth = wind ? 1.1 : 0.8;
    ctx.beginPath(); ctx.moveTo(4.4, -5); ctx.lineTo(2.8, -1.5); ctx.lineTo(4.2, 0.8); ctx.lineTo(3.1, 3.5); ctx.stroke();
    ctx.restore();
    if (!v.dead) addGlow(ctx, c.x + 3.5, c.y - 1, wind ? 20 : 9, C.glow, wind ? 0.6 : 0.3);
  }
}
