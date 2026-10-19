// 钟卫：护钟的甲士。立誓「钟不停，身不倒」，人早已死去，誓言还穿着甲站在这里。
// 鱼鳞甲、兽面吞肩、红缨兜鍪、云头靴；持饕餮纹钟形铜盾。背甲裂开处透出余火——那是弱点。
import { clamp, lerp } from '../../core/math';
import { addGlow, bellPath, glint } from '../draw';
import { capsule, Clock, ik, inWorld, rim, Rope, Xf, type Pt } from '../rig';

export interface GuardianView {
  x: number; y: number; facing: number;
  state: string; t: number; wind: number;
  walk: number; vx: number;
  flash: boolean; dead: boolean; deadT: number;
  time: number; seed: number;
}

const PAL = {
  iron: '#1c1f26', ironBack: '#121419', ironRim: 'rgba(214,190,140,0.6)', scale: 'rgba(196,170,120,0.32)',
  bronze: '#6a532f', bronzeDark: '#3d2f1b', bronzeHi: '#d6b06a', gold: '#c9a461',
  cape: '#5a1719', capeBack: '#3d1012', tassel: '#b3261d',
  verdigris: 'rgba(84,146,116,0.5)', ember: '255,120,60', face: '#4a3a22',
};
const FLASH = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, k === 'ember' ? v : '#f4efe6'])) as typeof PAL;

export class GuardianModel {
  private cape = new Rope(6, 4);
  private plume = [new Rope(5, 2.6), new Rope(4, 2.6)];
  private clock = new Clock();

  draw(ctx: CanvasRenderingContext2D, v: GuardianView) {
    const dt = this.clock.tick(v.time);
    const C = v.flash ? FLASH : PAL;
    const f = v.facing;
    const base = ctx.getTransform();
    const root = new Xf().translate(v.x, v.y).scale(f, 1);
    const st = v.state, t = v.t;

    // ---------- 姿态 ----------
    const walking = Math.abs(v.vx) > 8 && st === 'chase';
    let bob = walking ? Math.abs(Math.sin(v.walk)) * 1.5 : Math.sin(v.time * 1.4 + v.seed) * 0.4;
    let lean = walking ? 0.06 : 0, drop = 0, helmTilt = 0;
    let shC: Pt = { x: 19, y: -24 }, shR = 0, shFlip = 1;
    if (st === 'windup') {
      const e = 1 - (1 - clamp(t / v.wind, 0, 1)) ** 2;
      lean = -0.16 * e; drop = 3 * e; shC = { x: lerp(18, 11, e), y: -26 + 2 * e }; shR = -0.16 * e; bob = 0;
    } else if (st === 'bash') {
      lean = 0.28; drop = 1; shC = { x: 24, y: -26 }; shR = 0.06; bob = 0;
    } else if (st === 'recover') {
      const k = clamp(t / 1.15, 0, 1);
      lean = lerp(0.28, 0.18, k); drop = 2; shC = { x: lerp(22, 17, k), y: lerp(-24, -17, Math.min(1, k * 3)) }; shR = 0.3; bob = Math.abs(Math.sin(v.time * 6)) * 0.6;
    } else if (st === 'turn') {
      const k = clamp(t / 0.35, 0, 1);
      shFlip = Math.cos(k * Math.PI); shC = { x: lerp(18, 6, Math.sin(k * Math.PI)), y: -27 }; lean = -0.05;
    } else if (st === 'stagger') {
      const k = clamp(t / 1.3, 0, 1), r = Math.min(1, k * 4);
      lean = -0.28 * r + 0.2 * k; helmTilt = -0.35 * r; shC = { x: lerp(18, 9, r), y: lerp(-27, -12, r) }; shR = 1.05 * r; bob = 0;
    }
    let deadK = 0;
    if (v.dead) { deadK = clamp(v.deadT / 0.6, 0, 1); drop = 10 * deadK; lean = 0.25 + deadK * 0.75; shC = { x: 18, y: lerp(-27, -4, deadK) }; shR = deadK * 1.45; }
    const hipY = -20 + drop - bob;
    const cs = Math.cos(lean), sn = Math.sin(lean);
    const hp = (x: number, y: number): Pt => ({ x: x * cs - y * sn, y: hipY + x * sn + y * cs });
    const W = (p: Pt) => root.apply(p.x, p.y);

    // 腿
    let fF: Pt, fB: Pt;
    if (walking) {
      fF = { x: 2 + Math.sin(v.walk) * 6, y: -Math.max(0, Math.cos(v.walk)) * 3.5 };
      fB = { x: -3 + Math.sin(v.walk + Math.PI) * 6, y: -Math.max(0, Math.cos(v.walk + Math.PI)) * 3.5 };
    } else if (st === 'windup' || st === 'bash' || st === 'recover') { fF = { x: 8, y: 0 }; fB = { x: -8, y: 0 }; }
    else if (v.dead) { fF = { x: 7, y: 0 }; fB = { x: -9, y: -1 }; }
    else { fF = { x: 5, y: 0 }; fB = { x: -5, y: 0 }; }
    const hipF = hp(3, 0), hipB = hp(-3, 0);
    const legF = ik(hipF.x, hipF.y, fF.x, fF.y, 10.5, 10, 1), legB = ik(hipB.x, hipB.y, fB.x, fB.y, 10.5, 10, 1);

    // 布料
    const ca = W(hp(-9, -16.5));
    this.cape.step(ca.x, ca.y, dt, { grav: 1100, damp: 0.9, stiff: 45, rest: (i) => ({ x: -f * (1 + i * 0.9), y: i * 3.8 }), wind: 50, time: v.time + v.seed });
    const helm = hp(3.5 + helmTilt * 4, -26.5);
    const top = W({ x: helm.x - 1, y: helm.y - 9 });
    this.plume.forEach((r, i) => r.step(top.x, top.y, dt, { grav: 500, damp: 0.9, stiff: 70, rest: (j) => ({ x: -f * j * (2 + i * 0.4), y: -j * (1.4 - i * 0.9) }), wind: 70, time: v.time + i * 1.7 }));

    const alpha = v.dead ? Math.max(0, 1 - v.deadT / 1) : 1;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;

    // 披风（世界空间）
    inWorld(ctx, base, () => {
      ctx.fillStyle = C.capeBack;
      ctx.fill(this.cape.ribbon((k) => 13 - k * 3, 4, v.seed));
    });
    root.set(ctx, base);

    // 后腿、后裙甲
    this.leg(ctx, hipB, legB, C, true);
    this.skirt(ctx, hp, C, -1, v);
    // 躯干
    const torso = new Path2D();
    const p0 = hp(-9, 1), p1 = hp(-11.5, -11), p2 = hp(-9, -18), p3 = hp(9, -19), p4 = hp(12.5, -10), p5 = hp(9, 1);
    torso.moveTo(p0.x, p0.y);
    torso.quadraticCurveTo(p1.x - 1, p1.y, p2.x, p2.y);
    torso.quadraticCurveTo(hp(0, -21).x, hp(0, -21).y, p3.x, p3.y);
    torso.quadraticCurveTo(p4.x + 1, p4.y, p5.x, p5.y);
    torso.closePath();
    rim(ctx, torso, C.iron, C.ironRim, 1, 1);
    this.scales(ctx, torso, hp, -19, 0, C);
    // 背甲裂缝（弱点）
    const k1 = hp(-10.5, -15), k2 = hp(-7, -10), k3 = hp(-10, -6), k4 = hp(-7.5, -2);
    const pulse = 0.6 + 0.4 * Math.sin(v.time * 5 + v.seed);
    ctx.strokeStyle = v.flash ? '#fff' : `rgba(255,150,80,${0.7 + 0.3 * pulse})`; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(k1.x, k1.y); ctx.lineTo(k2.x, k2.y); ctx.lineTo(k3.x, k3.y); ctx.lineTo(k4.x, k4.y); ctx.stroke();
    if (!v.dead) {
      addGlow(ctx, k2.x, k2.y, 14, C.ember, 0.35 * pulse);
      for (let i = 0; i < 3; i++) {
        const ph = (v.time * 0.8 + i / 3 + v.seed * 0.1) % 1;
        ctx.fillStyle = `rgba(255,170,90,${1 - ph})`;
        ctx.fillRect(k2.x - 2 - ph * 4 + i, k2.y - ph * 14, 1, 1);
      }
    }
    // 前腿、前裙甲、腰带兽面
    this.leg(ctx, hipF, legF, C, false);
    this.skirt(ctx, hp, C, 1, v);
    const bk = hp(2, -1.5);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(bk.x, bk.y, 1.8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = C.tassel; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bk.x, bk.y + 1.8); ctx.lineTo(bk.x - 0.6 + Math.sin(v.walk) * 0.8, bk.y + 6); ctx.stroke();

    // 兜鍪与红缨
    inWorld(ctx, base, () => {
      this.plume.forEach((r, i) => { ctx.fillStyle = i ? '#7d1a14' : C.tassel; ctx.fill(r.ribbon((k) => 3.2 - k * 1.6, 1.5, i + 7)); });
    });
    root.set(ctx, base);
    this.helmet(ctx, helm, helmTilt + lean * 0.3, C, v);

    // 前臂 + 吞肩
    const sh = hp(5, -14.5);
    const hand = { x: shC.x - 3 * shFlip, y: shC.y + 2 };
    const arm = ik(sh.x, sh.y, hand.x, hand.y, 8, 8, -1);
    const ap = new Path2D(); capsule(ap, sh.x, sh.y, 3.2, arm.kx, arm.ky, 2.6); capsule(ap, arm.kx, arm.ky, 2.6, arm.ex, arm.ey, 2.4);
    rim(ctx, ap, C.iron, C.ironRim, 0.6, 0.6);
    this.pauldron(ctx, sh, C);

    // 盾
    this.shield(ctx, shC, shR, shFlip, C, v);
    ctx.restore();

    // 出招闪光
    if (st === 'windup' && t > v.wind - 0.18 && !v.dead) {
      const g = root.apply(shC.x + 6, shC.y - 4);
      ctx.save(); ctx.setTransform(base);
      glint(ctx, g.x, g.y, 12, 1 - (v.wind - t) / 0.3);
      ctx.restore();
    }
  }

  private leg(ctx: CanvasRenderingContext2D, hip: Pt, l: { kx: number; ky: number; ex: number; ey: number }, C: typeof PAL, back: boolean) {
    const p = new Path2D();
    capsule(p, hip.x, hip.y, 3.8, l.kx, l.ky, 3);
    capsule(p, l.kx, l.ky, 3, l.ex, l.ey - 2, 2.6);
    if (back) { ctx.fillStyle = C.ironBack; ctx.fill(p); }
    else rim(ctx, p, C.iron, C.ironRim, 0.7, 0.7);
    // 护膝
    ctx.fillStyle = back ? '#2a2216' : C.bronze;
    ctx.beginPath(); ctx.arc(l.kx + 0.6, l.ky, 2.4, 0, Math.PI * 2); ctx.fill();
    // 云头靴：靴尖上翘
    ctx.fillStyle = back ? '#16171c' : C.iron;
    ctx.beginPath();
    ctx.moveTo(l.ex - 3.5, l.ey); ctx.lineTo(l.ex + 4.5, l.ey);
    ctx.quadraticCurveTo(l.ex + 7, l.ey - 0.5, l.ex + 6.2, l.ey - 3);
    ctx.quadraticCurveTo(l.ex + 5, l.ey - 1.6, l.ex + 3, l.ey - 3.2);
    ctx.lineTo(l.ex - 3, l.ey - 4); ctx.closePath(); ctx.fill();
    if (!back) { ctx.strokeStyle = C.gold; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(l.ex + 5.6, l.ey - 2.4, 0.9, 0, Math.PI * 1.5); ctx.stroke(); }
  }

  /** 鱼鳞甲纹：逐行错位的小弧 */
  private scales(ctx: CanvasRenderingContext2D, clip: Path2D, hp: (x: number, y: number) => Pt, y0: number, y1: number, C: typeof PAL) {
    ctx.save(); ctx.clip(clip);
    ctx.strokeStyle = C.scale; ctx.lineWidth = 0.6;
    let row = 0;
    for (let y = y0 + 1; y <= y1 + 2; y += 2.6, row++) {
      for (let x = -14 + (row % 2) * 1.6; x <= 14; x += 3.2) {
        const q = hp(x, y);
        ctx.beginPath(); ctx.arc(q.x, q.y, 1.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
    }
    ctx.restore();
  }

  private skirt(ctx: CanvasRenderingContext2D, hp: (x: number, y: number) => Pt, C: typeof PAL, side: number, v: GuardianView) {
    const sw = Math.sin(v.walk) * 0.8 * side;
    const p = new Path2D();
    const a = side > 0 ? [hp(-1, -1), hp(10, -1), hp(11.5 + sw, 10), hp(1 + sw, 11)] : [hp(-10, -1), hp(1, -1), hp(-1 + sw, 11), hp(-12 + sw, 10)];
    p.moveTo(a[0].x, a[0].y); for (let i = 1; i < 4; i++) p.lineTo(a[i].x, a[i].y); p.closePath();
    if (side < 0) { ctx.fillStyle = C.ironBack; ctx.fill(p); return; }
    rim(ctx, p, C.iron, C.ironRim, 0.8, 0.8);
    this.scales(ctx, p, hp, -1, 10, C);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(a[3].x, a[3].y); ctx.lineTo(a[2].x, a[2].y); ctx.stroke();
  }

  private helmet(ctx: CanvasRenderingContext2D, c: Pt, tilt: number, C: typeof PAL, v: GuardianView) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(tilt);
    // 顿项（护颈）
    const neck = new Path2D();
    neck.moveTo(-8, -1); neck.quadraticCurveTo(-10.5, 5, -9, 8.5); neck.lineTo(4, 8); neck.lineTo(5, 2); neck.closePath();
    rim(ctx, neck, C.iron, C.ironRim, 0.6, 0.6);
    ctx.strokeStyle = C.scale; ctx.lineWidth = 0.5;
    for (let y = 1.5; y < 8; y += 2.2) { ctx.beginPath(); ctx.moveTo(-9, y); ctx.lineTo(4, y); ctx.stroke(); }
    // 盔顶
    const dome = new Path2D();
    dome.moveTo(-8.5, 0); dome.quadraticCurveTo(-8.5, -9.5, 0, -9.5); dome.quadraticCurveTo(8, -9.5, 8.5, -0.5);
    dome.lineTo(9.5, 1); dome.lineTo(-9.5, 1.2); dome.closePath();
    const g = ctx.createLinearGradient(-8, -9, 8, 0);
    g.addColorStop(0, v.flash ? C.bronze : '#82693c'); g.addColorStop(1, C.bronzeDark);
    rim(ctx, dome, g, C.bronzeHi, 0.6, 0.8);
    ctx.strokeStyle = 'rgba(30,20,10,0.6)'; ctx.lineWidth = 0.6;
    for (const x of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(x * 0.4, -9.3); ctx.quadraticCurveTo(x, -5, x * 1.3, 0.5); ctx.stroke(); }
    ctx.fillStyle = C.verdigris; ctx.beginPath(); ctx.ellipse(-4.5, -4, 1.8, 3, 0.4, 0, Math.PI * 2); ctx.fill();
    // 盔尖
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-1.6, -9.2); ctx.lineTo(-0.6, -13); ctx.lineTo(0.6, -9.2); ctx.closePath(); ctx.fill();
    // 面甲：怒目
    const face = new Path2D();
    face.moveTo(1, 0); face.lineTo(8.8, 0.5); face.lineTo(8, 6); face.quadraticCurveTo(5, 8.5, 2.5, 6.5); face.closePath();
    rim(ctx, face, C.face, C.bronzeHi, 0.5, 0.5);
    ctx.strokeStyle = 'rgba(20,12,4,0.8)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(3, 1.6); ctx.lineTo(8.5, 2.6); ctx.stroke(); // 怒眉
    const wind = v.state === 'windup';
    const eye = wind ? '#ffd27a' : '#ff8a3a';
    ctx.fillStyle = v.dead ? '#2a1a10' : eye;
    ctx.beginPath(); ctx.moveTo(4.2, 3.2); ctx.lineTo(8.2, 3.6); ctx.lineTo(7.4, 4.4); ctx.lineTo(4.6, 4.1); ctx.closePath(); ctx.fill();
    // 獠牙口
    ctx.strokeStyle = 'rgba(20,12,4,0.8)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(5, 7); ctx.lineTo(6, 6); ctx.lineTo(7, 7); ctx.stroke();
    if (!v.dead) addGlow(ctx, 6.5, 3.8, wind ? 22 : 10, '255,140,60', wind ? 0.55 : 0.3);
    // 回卫后的喘息白汽
    if (v.state === 'recover') {
      const ph = (v.time * 1.6) % 1;
      ctx.fillStyle = `rgba(200,200,210,${0.35 * (1 - ph)})`;
      ctx.beginPath(); ctx.arc(10 + ph * 6, 6 - ph * 8, 1.5 + ph * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private pauldron(ctx: CanvasRenderingContext2D, sh: Pt, C: typeof PAL) {
    // 兽面吞肩：一只张口的狻猊吞着手臂
    const p = new Path2D();
    p.moveTo(sh.x - 6, sh.y + 2);
    p.quadraticCurveTo(sh.x - 5, sh.y - 7, sh.x + 2, sh.y - 6.5);
    p.quadraticCurveTo(sh.x + 8, sh.y - 5, sh.x + 7.5, sh.y + 1);
    p.lineTo(sh.x + 5, sh.y + 4.5); p.lineTo(sh.x + 3, sh.y + 2.5); p.lineTo(sh.x + 1, sh.y + 5); p.lineTo(sh.x - 1, sh.y + 2.5); p.lineTo(sh.x - 3, sh.y + 5);
    p.closePath();
    const g = ctx.createLinearGradient(sh.x - 6, sh.y - 6, sh.x + 6, sh.y + 4);
    g.addColorStop(0, C === FLASH ? C.bronze : '#8a6d3c'); g.addColorStop(1, C.bronzeDark);
    rim(ctx, p, g, C.bronzeHi, 0.6, 0.7);
    // 兽眼与鬃纹
    ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.arc(sh.x + 3.5, sh.y - 2.5, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,8,0.7)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(sh.x - 1.5, sh.y - 1.5, 2.5, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(sh.x - 2.5, sh.y + 0.5, 2, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
  }

  /** 编钟形铜盾：钟口上弧，钲部两侧各九枚乳钉，鼓部饰简化饕餮 */
  private shield(ctx: CanvasRenderingContext2D, c: Pt, r: number, flip: number, C: typeof PAL, v: GuardianView) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(r); ctx.scale(Math.max(0.15, Math.abs(flip)) * (flip < 0 ? -1 : 1), 1);
    // 甬（钟柄）与旋环
    ctx.fillStyle = C.bronzeDark; ctx.fillRect(-1.8, -25.5, 3.6, 6);
    ctx.strokeStyle = C.bronzeHi; ctx.lineWidth = 0.8; ctx.strokeRect(-1.8, -25.5, 3.6, 6);
    ctx.beginPath(); ctx.ellipse(0, -22.5, 3, 1, 0, 0, Math.PI * 2); ctx.stroke();
    const p = new Path2D();
    p.moveTo(-6.5, -20); p.lineTo(6.5, -20);
    p.quadraticCurveTo(8.6, -19.6, 8.9, -16);
    p.lineTo(10.6, 18.5);
    p.quadraticCurveTo(0, 12, -10.6, 18.5);
    p.lineTo(-8.9, -16);
    p.quadraticCurveTo(-8.6, -19.6, -6.5, -20);
    p.closePath();
    const g = ctx.createLinearGradient(-10, 0, 10, 0);
    const lit = C === FLASH ? C.bronze : '#8c7041';
    g.addColorStop(0, C.bronzeDark); g.addColorStop(0.35, lit); g.addColorStop(0.6, C.bronze); g.addColorStop(1, C.bronzeDark);
    ctx.fillStyle = g; ctx.fill(p);
    ctx.save(); ctx.clip(p);
    // 钲部：篆带 + 乳钉
    ctx.strokeStyle = 'rgba(30,20,8,0.7)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-12, -4.5); ctx.lineTo(12, -4.5); ctx.moveTo(-2.4, -20); ctx.lineTo(-2.4, -4.5); ctx.moveTo(2.4, -20); ctx.lineTo(2.4, -4.5); ctx.stroke();
    ctx.fillStyle = 'rgba(30,20,8,0.55)';
    for (let y = -17.5; y < -6; y += 2.4) ctx.fillRect(-1.2, y, 2.4, 0.8);
    for (const sx of [-1, 1]) {
      for (const y of [-16.5, -12.5, -8.5]) {
        for (const x of [4.3, 6.9]) {
          const xx = sx * (x + (y + 20) * 0.04);
          ctx.fillStyle = 'rgba(20,12,4,0.65)'; ctx.beginPath(); ctx.arc(xx + 0.3, y + 0.4, 1, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = C === FLASH ? '#fff' : '#b8955a'; ctx.beginPath(); ctx.arc(xx, y, 0.9, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // 鼓部：一对卷目
    ctx.strokeStyle = 'rgba(30,20,8,0.7)'; ctx.lineWidth = 0.8;
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.arc(sx * 4.5, 4, 2.2, 0, Math.PI * 1.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx * 1, 1); ctx.quadraticCurveTo(sx * 8, -1.5, sx * 8.5, 6); ctx.stroke();
      ctx.fillStyle = 'rgba(30,20,8,0.8)'; ctx.beginPath(); ctx.arc(sx * 4.5, 4, 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 9); ctx.stroke();
    // 铜绿与磕痕
    ctx.fillStyle = C.verdigris;
    ctx.beginPath(); ctx.moveTo(-9, 16); ctx.quadraticCurveTo(-7, 6, -4.5, 15); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -19); ctx.quadraticCurveTo(6.5, -12, 8, -18); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(240,215,160,0.55)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(3, 12); ctx.lineTo(6, 13.5); ctx.moveTo(-5, -1); ctx.lineTo(-3, 0.5); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = C.bronzeHi; ctx.lineWidth = 1.2; ctx.stroke(p);
    ctx.restore();
    void v;
  }
}
