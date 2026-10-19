// 主角「回锋者」：斗笠、蓑衣、绑腿草鞋的无名剑客。
// 斗笠下看不见脸，只有一点眼光；笠沿垂两条红绳。佩刀为环首青铜刀，以金丝系于腕上。
import { clamp, lerp } from '../../core/math';
import { addGlow } from '../draw';
import { capsule, Clock, h01, ik, inWorld, rim, Rope, Xf, type Pt } from '../rig';

export type AttackDir = 'side' | 'up' | 'down';

export interface WandererView {
  x: number; y: number; facing: number;
  vx: number; vy: number; onGround: boolean;
  run: number; dashT: number;
  attackT: number; attackDir: AttackDir;
  throwT: number; throwAng: number;
  healT: number; hurtT: number;
  bladeInHand: boolean;
  sx: number; sy: number;
  alpha: number;
  dead: boolean; deadT: number;
  time: number;
  /** 下蹲程度 0–1 */
  crouch?: number;
}

/** 出刀曲线：0 = 起手角，1 = 收刀角。0–0.035s 一口气斩过（命中判定从 0.025s 开始，此时刀已到位），略过头后慢慢回落 */
function swingCurve(t: number): number {
  if (t < 0.035) { const k = t / 0.035; return -0.05 + 1.17 * (1 - (1 - k) ** 2); }
  const k = clamp((t - 0.035) / 0.22, 0, 1);
  return 1.12 - 0.12 * (1 - (1 - k) ** 2);
}

const PAL = {
  robe: '#141820', robeBack: '#0c0f15', robeRim: 'rgba(214,186,136,0.6)',
  straw: '#2c2417', strawBack: '#1d180f', strawLine: 'rgba(168,138,86,0.5)', strawRim: '#a88d5a',
  hat: '#2f271a', hatWeave: 'rgba(184,154,98,0.55)', hatEdge: '#d2b47a',
  wrap: '#56524a', wrapLine: 'rgba(20,20,24,0.7)', sandal: '#4a3d27',
  cord: '#a12b22', cordHi: '#e0573f',
  face: '#07080b', eye: '#f6dc96',
  bronze: '#6f5c39', edge: '#f4dc9e', gold: '#cfa652',
};
const HURT = { ...PAL, robe: '#3b1518', robeBack: '#2a0f12', straw: '#3a1a14', hat: '#3a1a14' };

export class WandererModel {
  private cape = new Rope(6, 3.7);
  private cordA = new Rope(5, 2.6);
  private cordB = new Rope(4, 2.6);
  private clock = new Clock();

  draw(ctx: CanvasRenderingContext2D, v: WandererView) {
    if (v.alpha <= 0) return;
    const dt = this.clock.tick(v.time);
    const C = v.hurtT > 0 ? HURT : PAL;
    const f = v.facing;
    const base = ctx.getTransform();
    // 斩出的一瞬身体往前送一小步（纯视觉，不改碰撞）
    const lunge = v.attackT >= 0 && v.attackDir === 'side' ? 2.5 * clamp(v.attackT / 0.035, 0, 1) * (1 - clamp((v.attackT - 0.08) / 0.19, 0, 1)) : 0;
    const root = new Xf().translate(v.x + f * lunge, v.y).scale(f * v.sx, v.sy);

    // ---------- 姿态 ----------
    const air = !v.onGround && v.dashT <= 0;
    const moving = v.onGround && Math.abs(v.vx) > 30;
    const fwd = v.vx * f;
    let bob = moving ? Math.abs(Math.sin(v.run)) * 1.4 : Math.sin(v.time * 2.2) * 0.35;
    let lean = moving ? clamp(fwd / 250, -1, 1) * 0.18 : air ? clamp(fwd / 250, -1, 1) * 0.08 : 0;
    let drop = 0;
    const atk = v.attackT >= 0;
    // 出刀：爆发的一斩（0–0.035s）→ 身体随刀前压 → 慢慢收势
    const swing = atk ? swingCurve(v.attackT) : 0;
    const snap = atk ? clamp(v.attackT / 0.035, 0, 1) * (1 - clamp((v.attackT - 0.08) / 0.19, 0, 1)) : 0;
    if (atk) {
      const base = v.attackDir === 'side' ? 0.16 : v.attackDir === 'up' ? -0.1 : 0.12;
      lean += base * (0.6 + 0.9 * snap);
    }
    if (v.dashT > 0) { lean = 0.55; bob = 0; drop = 2; }
    const heal = v.healT >= 0;
    if (heal) { drop = 6; lean = 0.22; bob = 0; }
    if (v.hurtT > 0) lean = -0.3;
    // 下蹲：髋部压低、上身前探，斗笠压到膝上
    const ck = v.dead ? 0 : v.crouch ?? 0;
    if (ck > 0) { drop += 13 * ck; lean += 0.36 * ck; bob *= 1 - ck * 0.7; }
    let deadK = 0;
    if (v.dead) { deadK = clamp(v.deadT / 0.5, 0, 1); drop = 7 * deadK; lean = 0.25 + deadK * 0.9; }
    const hipY = -15 + drop - bob;
    const cs = Math.cos(lean), sn = Math.sin(lean);
    /** 髋部坐标系（随前倾旋转）→ 根坐标 */
    const hp = (x: number, y: number): Pt => ({ x: x * cs - y * sn, y: hipY + x * sn + y * cs });
    const W = (p: Pt) => root.apply(p.x, p.y);

    // 腿：脚的目标点
    let fF: Pt, fB: Pt;
    if (v.dead) { fF = { x: 5, y: 0 }; fB = { x: -6, y: -1 }; }
    else if (heal) { fF = { x: 5.5, y: 0 }; fB = { x: -7, y: -1.5 }; }
    else if (v.dashT > 0) { fF = { x: -1, y: -5 }; fB = { x: -10, y: -7 }; }
    else if (air) {
      if (v.vy < 0) { fF = { x: 4.5, y: -6 }; fB = { x: -3, y: -3.5 }; }
      else { fF = { x: 3, y: 0.5 }; fB = { x: -4, y: 1 }; }
    } else if (moving) {
      const leg = (ph: number): Pt => ({ x: Math.sin(ph) * 8, y: -Math.max(0, Math.cos(ph)) * 5 });
      fF = leg(v.run); fB = leg(v.run + Math.PI);
    } else { fF = { x: 3.5, y: 0 }; fB = { x: -3.5, y: 0 }; }
    if (ck > 0 && v.onGround && v.dashT <= 0 && !heal) {
      // 蹲姿的脚：前脚踏实、后脚跪低；挪动时步幅变小
      const st = moving ? 0.55 : 0;
      fF = { x: lerp(fF.x, 6.5, ck) * (1 - st) + fF.x * st * 0.6, y: fF.y * (1 - ck * 0.6) };
      fB = { x: lerp(fB.x, -7.5, ck) * (1 - st) + fB.x * st * 0.6, y: fB.y * (1 - ck * 0.6) };
    }
    const hipF = hp(1.5, 0), hipB = hp(-1.5, 0);
    const legF = ik(hipF.x, hipF.y, fF.x, fF.y, 8.5, 8, 1);
    const legB = ik(hipB.x, hipB.y, fB.x, fB.y, 8.5, 8, 1);

    // 手：目标点
    const shF = hp(2, -11), shB = hp(-1.5, -11.5);
    let hF: Pt, hB: Pt;
    let bladeAng: number | null = null;
    if (atk) {
      let a0: number, a1: number;
      if (v.attackDir === 'up') { a0 = -0.2; a1 = -Math.PI / 2 - 1.2; }
      else if (v.attackDir === 'down') { a0 = -0.3; a1 = Math.PI / 2 + 0.9; }
      else { a0 = -1.9; a1 = 0.7; }
      bladeAng = a0 + (a1 - a0) * swing;
      const reach = 9.5;
      hF = { x: shF.x + Math.cos(bladeAng) * reach, y: shF.y + Math.sin(bladeAng) * reach };
      hB = { x: shB.x - 4, y: shB.y + 7 };
    } else if (v.throwT >= 0) {
      const la = f > 0 ? v.throwAng : Math.PI - v.throwAng;
      hF = { x: shF.x + Math.cos(la) * 11, y: shF.y + Math.sin(la) * 11 };
      hB = { x: shB.x - 6, y: shB.y + 5 };
    } else if (heal) {
      hF = hp(6, -6); hB = hp(4, -5.5);
    } else if (v.hurtT > 0) {
      hF = hp(7, -15); hB = hp(-6, -14);
    } else if (v.dashT > 0) {
      hF = hp(3, -3); hB = hp(-9, -5);
    } else if (air && v.vy < 0) {
      hF = hp(6, -5); hB = hp(-6, -6);
    } else {
      const sw = moving ? Math.sin(v.run + Math.PI) * 4 : 0;
      hF = v.bladeInHand ? hp(4.5, -2) : hp(3 - sw * 0.5, -1);
      hB = hp(-2.5 + sw, -1.5);
    }
    const armF = ik(shF.x, shF.y, hF.x, hF.y, 6, 6.2, -1);
    const armB = ik(shB.x, shB.y, hB.x, hB.y, 6, 6.2, -1);

    // ---------- 布料 ----------
    const capeA = W(hp(-4.5, -11.5));
    const wind = moving || v.dashT > 0 ? 0 : 40;
    this.cape.step(capeA.x, capeA.y, dt, {
      grav: 700, damp: 0.9, stiff: 140, wind, time: v.time,
      rest: (i) => ({ x: -f * (1.4 + 1.1 * i), y: i * 3.3 }),
    });
    const hatTie = W(hp(-6, -21.5));
    this.cordA.step(hatTie.x, hatTie.y, dt, { grav: 700, damp: 0.93, wind: 120, time: v.time + 1 });
    const hatTie2 = W(hp(-3, -21));
    this.cordB.step(hatTie2.x, hatTie2.y, dt, { grav: 700, damp: 0.93, wind: 120, time: v.time + 2.3 });

    ctx.save();
    ctx.globalAlpha *= v.alpha;
    root.set(ctx, base);

    // 背侧手臂与腿（更暗）
    this.arm(ctx, shB, armB, C.robeBack, 'rgba(0,0,0,0)');
    this.leg(ctx, hipB, legB, C, true);

    // 蓑衣（世界空间）
    const F0 = W(hp(2.5, -12.5)), F1 = W(hp(1.5, 3));
    inWorld(ctx, base, () => this.drawCape(ctx, F0, F1, C, v, false));

    this.leg(ctx, hipF, legF, C, false);

    // 躯干（前身长衫）
    root.set(ctx, base);
    const torso = new Path2D();
    const t0 = hp(-3, -12.5), t1 = hp(4, -12), t2 = hp(5, -5), t3 = hp(4.5, 2), t4 = hp(-2, 1.5);
    torso.moveTo(t0.x, t0.y); torso.lineTo(t1.x, t1.y); torso.quadraticCurveTo(hp(6, -9).x, hp(6, -9).y, t2.x, t2.y);
    torso.lineTo(t3.x, t3.y); torso.lineTo(t4.x, t4.y); torso.closePath();
    rim(ctx, torso, C.robe, C.robeRim, 0.8, 0.9);
    // 腰带与结
    const b0 = hp(-3, -2.5), b1 = hp(5.2, -2.8);
    ctx.strokeStyle = '#3a2f22'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
    const kn = hp(4.6, -2.6);
    ctx.fillStyle = C.cord; ctx.beginPath(); ctx.arc(kn.x, kn.y, 1.1, 0, Math.PI * 2); ctx.fill();

    // 腰间环首刀
    if (v.bladeInHand && !atk && v.throwT < 0 && !v.dead) this.sheathed(ctx, hp);

    // 蓑衣上层（披肩）
    inWorld(ctx, base, () => this.drawCape(ctx, F0, F1, C, v, true));
    root.set(ctx, base);

    // 头、红绳、斗笠
    inWorld(ctx, base, () => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = C.cord; ctx.lineWidth = 1.1; this.cordA.line(ctx);
      ctx.lineWidth = 0.9; this.cordB.line(ctx);
      ctx.fillStyle = C.cordHi;
      ctx.beginPath(); ctx.arc(this.cordA.x[4], this.cordA.y[4], 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.cordB.x[3], this.cordB.y[3], 0.9, 0, Math.PI * 2); ctx.fill();
    });
    root.set(ctx, base);
    this.head(ctx, hp, C, v, deadK);

    // 前侧手臂与刀
    if (bladeAng !== null && v.bladeInHand) this.swingBlade(ctx, armF.ex, armF.ey, bladeAng, v);
    this.arm(ctx, shF, armF, C.robe, C.robeRim);
    if (heal) this.lamp(ctx, hp, v);
    ctx.restore();
  }

  // ---------- 部件 ----------
  private leg(ctx: CanvasRenderingContext2D, hip: Pt, l: { kx: number; ky: number; ex: number; ey: number }, C: typeof PAL, back: boolean) {
    const p = new Path2D();
    capsule(p, hip.x, hip.y, 2.4, l.kx, l.ky, 1.9);
    capsule(p, l.kx, l.ky, 1.9, l.ex, l.ey - 1, 1.5);
    if (back) { ctx.fillStyle = C.robeBack; ctx.fill(p); }
    else rim(ctx, p, C.robe, C.robeRim, 0.6, 0.6);
    // 绑腿
    ctx.save(); ctx.clip(p);
    ctx.strokeStyle = back ? 'rgba(70,66,58,0.55)' : C.wrap; ctx.lineWidth = 0.9;
    for (let k = 0.15; k < 0.95; k += 0.17) {
      const x = l.kx + (l.ex - l.kx) * k, y = l.ky + (l.ey - l.ky) * k;
      ctx.beginPath(); ctx.moveTo(x - 2.4, y - 0.8); ctx.lineTo(x + 2.4, y + 0.8); ctx.stroke();
    }
    ctx.restore();
    // 草鞋
    ctx.fillStyle = back ? '#2a2318' : C.sandal;
    ctx.beginPath(); ctx.moveTo(l.ex - 2, l.ey); ctx.lineTo(l.ex + 3.6, l.ey); ctx.lineTo(l.ex + 2.6, l.ey - 1.6); ctx.lineTo(l.ex - 1.6, l.ey - 1.8); ctx.closePath(); ctx.fill();
  }

  private arm(ctx: CanvasRenderingContext2D, sh: Pt, a: { kx: number; ky: number; ex: number; ey: number }, fill: string, light: string) {
    const p = new Path2D();
    capsule(p, sh.x, sh.y, 2.3, a.kx, a.ky, 1.7);
    capsule(p, a.kx, a.ky, 1.7, a.ex, a.ey, 1.3);
    rim(ctx, p, fill, light, 0.6, 0.6);
    // 护腕
    ctx.strokeStyle = 'rgba(120,110,95,0.7)'; ctx.lineWidth = 1.1;
    const mx = a.kx + (a.ex - a.kx) * 0.6, my = a.ky + (a.ey - a.ky) * 0.6;
    const ang = Math.atan2(a.ey - a.ky, a.ex - a.kx) + Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(mx - Math.cos(ang) * 1.6, my - Math.sin(ang) * 1.6); ctx.lineTo(mx + Math.cos(ang) * 1.6, my + Math.sin(ang) * 1.6); ctx.stroke();
    ctx.fillStyle = '#1b1712'; ctx.beginPath(); ctx.arc(a.ex, a.ey, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  /** 蓑衣：前缘 F0→F1，后缘是模拟的布绳。upper=true 时画肩上那一层短的。 */
  private drawCape(ctx: CanvasRenderingContext2D, F0: Pt, F1: Pt, C: typeof PAL, v: WandererView, upper: boolean) {
    const r = this.cape, n = r.n;
    const back = (t: number): Pt => {
      const s = t * (n - 1), i = Math.min(n - 2, Math.floor(s)), k = s - i;
      return { x: r.x[i] + (r.x[i + 1] - r.x[i]) * k, y: r.y[i] + (r.y[i + 1] - r.y[i]) * k };
    };
    const vmax = upper ? 0.48 : 1;
    const S = (u: number, vv: number): Pt => {
      const fv = { x: F0.x + (F1.x - F0.x) * vv, y: F0.y + (F1.y - F0.y) * vv };
      const bv = back(vv);
      return { x: fv.x + (bv.x - fv.x) * u, y: fv.y + (bv.y - fv.y) * u };
    };
    const p = new Path2D();
    const top = S(0, 0);
    p.moveTo(top.x, top.y);
    for (let i = 1; i <= 6; i++) { const q = S(0, (i / 6) * vmax); p.lineTo(q.x, q.y); }
    // 下缘：参差的草须
    const teeth = upper ? 9 : 12;
    for (let i = 0; i <= teeth; i++) {
      const u = i / teeth, q = S(u, vmax);
      const len = (1.2 + h01(i, upper ? 3 : 7) * 2.6) * (i % 2 ? 1 : 0.35);
      p.lineTo(q.x + (h01(i, 9) - 0.5) * 1.2, q.y + len);
    }
    for (let i = 6; i >= 0; i--) { const q = S(1, (i / 6) * vmax); p.lineTo(q.x, q.y); }
    p.closePath();
    const f = v.facing;
    if (upper) rim(ctx, p, C.straw, C.strawRim, f * 0.9, 1);
    else { ctx.fillStyle = C.strawBack; ctx.fill(p); }
    // 草茎纹理
    ctx.save(); ctx.clip(p);
    ctx.strokeStyle = C.strawLine; ctx.lineWidth = 0.55;
    const N = upper ? 11 : 15;
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = S(u, upper ? 0.05 : 0.42), b = S(u + (h01(i, 2) - 0.5) * 0.05, vmax);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y + 3); ctx.stroke();
    }
    if (!upper) {
      // 中段一道草层
      ctx.strokeStyle = 'rgba(190,160,100,0.35)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const q = S(i / 10, 0.72); const y = q.y + (i % 2 ? 1.4 : 0); if (i) ctx.lineTo(q.x, y); else ctx.moveTo(q.x, y); }
      ctx.stroke();
    }
    ctx.restore();
  }

  private sheathed(ctx: CanvasRenderingContext2D, hp: (x: number, y: number) => Pt) {
    const a = hp(4, -1.5), b = hp(-12, 6);
    // 刀身（青铜）
    ctx.lineCap = 'round';
    ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(244,220,158,0.75)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(a.x - 1, a.y + 0.2); ctx.lineTo(b.x + 0.5, b.y - 0.8); ctx.stroke();
    // 刀柄与环首
    const g = hp(6.5, -2.8), r = hp(8.6, -3.8);
    ctx.strokeStyle = '#2a1f14'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(g.x, g.y); ctx.stroke();
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, 1.7, 0, Math.PI * 2); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  private swingBlade(ctx: CanvasRenderingContext2D, hx: number, hy: number, a: number, v: WandererView) {
    const cs = Math.cos(a), sn = Math.sin(a), nx = -sn, ny = cs;
    const L = 25;
    // 刀身：直背、刃口一线金光
    const p = new Path2D();
    p.moveTo(hx + nx * 1.4, hy + ny * 1.4);
    p.lineTo(hx + cs * (L - 4) + nx * 1.3, hy + sn * (L - 4) + ny * 1.3);
    p.lineTo(hx + cs * L, hy + sn * L);
    p.lineTo(hx + cs * (L - 3) - nx * 1.2, hy + sn * (L - 3) - ny * 1.2);
    p.lineTo(hx - nx * 1.2, hy - ny * 1.2);
    p.closePath();
    ctx.fillStyle = PAL.bronze; ctx.fill(p);
    ctx.strokeStyle = PAL.edge; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(hx - nx * 1.1, hy - ny * 1.1); ctx.lineTo(hx + cs * (L - 3) - nx * 1.1, hy + sn * (L - 3) - ny * 1.1); ctx.lineTo(hx + cs * L, hy + sn * L); ctx.stroke();
    // 柄、环首
    ctx.strokeStyle = '#2a1f14'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - cs * 5, hy - sn * 5); ctx.stroke();
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(hx - cs * 7, hy - sn * 7, 1.8, 0, Math.PI * 2); ctx.stroke();
    ctx.lineCap = 'butt';
    addGlow(ctx, hx + cs * L * 0.7, hy + sn * L * 0.7, 14, '255,214,140', 0.25 * (1 - clamp(v.attackT / 0.2, 0, 1)));
  }

  private head(ctx: CanvasRenderingContext2D, hp: (x: number, y: number) => Pt, C: typeof PAL, v: WandererView, deadK: number) {
    // 颈与脸（藏在笠影里）
    const hc = hp(2, -17.5);
    const face = new Path2D();
    face.ellipse(hc.x, hc.y, 4.4, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.face; ctx.fill(face);
    // 面巾
    const m0 = hp(-1.5, -16), m1 = hp(6.5, -16.5), m2 = hp(5.5, -12.5), m3 = hp(-1, -12.8);
    ctx.fillStyle = '#1a1d26';
    ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.lineTo(m3.x, m3.y); ctx.closePath(); ctx.fill();
    // 眼光
    if (deadK < 0.6) {
      const e = hp(4.6, -18.3);
      const blink = (v.time % 4.2) < 0.08 ? 0.2 : 1;
      ctx.fillStyle = C.eye; ctx.globalAlpha *= 1;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 1.3, 0.55 * blink, -0.1, 0, Math.PI * 2); ctx.fill();
      addGlow(ctx, e.x, e.y, 6, '255,220,150', 0.45 * (1 - deadK));
    }
    // 斗笠（死亡时脱落）
    ctx.save();
    if (v.dead) {
      const t = v.deadT;
      const hx = -t * 26, hy = Math.min(-hp(1, -22).y, -160 * t + 260 * t * t);
      ctx.translate(hx, hy); ctx.rotate(-t * 2.4);
    }
    const tilt = clamp(-v.vy / 2600, -0.12, 0.12);
    const apex = hp(1.5 - tilt * 10, -31), L0 = hp(-11, -21.2), R0 = hp(14, -22.4);
    const hat = new Path2D();
    hat.moveTo(L0.x, L0.y);
    hat.quadraticCurveTo(hp(-4, -26).x, hp(-4, -26).y, apex.x, apex.y);
    hat.quadraticCurveTo(hp(7, -26.5).x, hp(7, -26.5).y, R0.x, R0.y);
    hat.quadraticCurveTo(hp(2, -20).x, hp(2, -20).y, L0.x, L0.y);
    hat.closePath();
    rim(ctx, hat, C.hat, C.hatEdge, 0.6, 1.1);
    // 竹篾编纹：放射线 + 两道同心
    ctx.save(); ctx.clip(hat);
    ctx.strokeStyle = C.hatWeave; ctx.lineWidth = 0.45;
    for (let i = 0; i <= 9; i++) {
      const u = i / 9, bx = L0.x + (R0.x - L0.x) * u, by = L0.y + (R0.y - L0.y) * u + Math.sin(u * Math.PI) * 1.2;
      ctx.beginPath(); ctx.moveTo(apex.x, apex.y); ctx.lineTo(bx, by); ctx.stroke();
    }
    for (const k of [0.45, 0.75]) {
      ctx.beginPath();
      const a = { x: apex.x + (L0.x - apex.x) * k, y: apex.y + (L0.y - apex.y) * k }, b = { x: apex.x + (R0.x - apex.x) * k, y: apex.y + (R0.y - apex.y) * k };
      ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 1.6 * k, b.x, b.y); ctx.stroke();
    }
    ctx.restore();
    // 笠沿与破口
    ctx.strokeStyle = C.hatEdge; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(L0.x, L0.y); ctx.quadraticCurveTo(hp(2, -20).x, hp(2, -20).y, R0.x, R0.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(210,180,122,0.8)'; ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const u = 0.08 + i * 0.16, q = { x: L0.x + (R0.x - L0.x) * u, y: L0.y + (R0.y - L0.y) * u + 1 };
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - 0.4, q.y + 1.2 + h01(i, 4)); ctx.stroke();
    }
    ctx.restore();
  }

  private lamp(ctx: CanvasRenderingContext2D, hp: (x: number, y: number) => Pt, v: WandererView) {
    const p = hp(6.5, -6.5), k = Math.sin(clamp(v.healT / 0.95, 0, 1) * Math.PI);
    ctx.fillStyle = '#6a5333';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 3, 1.4, 0, 0, Math.PI); ctx.fill();
    addGlow(ctx, p.x, p.y - 2, 50, '255,180,100', 0.45 * k);
    ctx.fillStyle = '#ffe2a0';
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 4 - k * 2); ctx.quadraticCurveTo(p.x + 1.6, p.y - 1, p.x, p.y); ctx.quadraticCurveTo(p.x - 1.6, p.y - 1, p.x, p.y - 4 - k * 2); ctx.fill();
  }

  /** 冲刺残影：只画轮廓 */
  static ghost(ctx: CanvasRenderingContext2D, x: number, y: number, f: number, a: number) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y); ctx.scale(f, 1);
    ctx.fillStyle = 'rgba(214,180,120,0.85)';
    ctx.beginPath();
    ctx.moveTo(-12, -38); ctx.lineTo(2, -46); ctx.lineTo(15, -39);
    ctx.lineTo(7, -36); ctx.lineTo(7, -10); ctx.lineTo(4, 0); ctx.lineTo(-4, 0); ctx.lineTo(-12, -6); ctx.lineTo(-8, -30);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
