// 场景物件：灯龛（存档/休憩）、碑文、遗骸（余烬宝箱）、余烬光球、残烬（死亡遗落）。
import { PHYS } from '../config';
import { dist, rand, type Rect } from '../core/math';
import { sfx } from '../core/audio';
import type { Level } from '../game/level';
import { addGlow, ellipse, glint, text } from '../render/draw';
import type { SteleText } from '../data/lore';

export class Shrine {
  constructor(public x: number, public y: number, public idx: number, public lit: boolean) {}
  near(L: Level) { const p = L.player; return Math.abs(p.cx - this.x) < 40 && Math.abs(p.bottom - this.y) < 50; }
  draw(ctx: CanvasRenderingContext2D, L: Level) {
    const x = this.x, y = this.y;
    const flick = 0.85 + 0.15 * Math.sin(L.time * 9 + this.idx) + 0.05 * Math.sin(L.time * 23);
    if (this.lit) {
      addGlow(ctx, x, y - 36, 170 * flick, '255,170,90', 0.32);
      addGlow(ctx, x, y - 36, 50, '255,210,140', 0.5 * flick);
    }
    // 石龛
    ctx.fillStyle = '#1c1611';
    ctx.beginPath();
    ctx.moveTo(x - 20, y); ctx.lineTo(x - 18, y - 46); ctx.quadraticCurveTo(x, y - 66, x + 18, y - 46); ctx.lineTo(x + 20, y); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.lit ? 'rgba(255,200,140,0.6)' : 'rgba(170,140,110,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#080605';
    ctx.beginPath(); ctx.moveTo(x - 10, y - 8); ctx.lineTo(x - 10, y - 40); ctx.quadraticCurveTo(x, y - 52, x + 10, y - 40); ctx.lineTo(x + 10, y - 8); ctx.closePath(); ctx.fill();
    // 灯
    ctx.fillStyle = this.lit ? '#ffcf80' : '#2a2620';
    ellipse(ctx, x, y - 26, 4 * (this.lit ? flick : 1), 6 * (this.lit ? flick : 1)); ctx.fill();
    if (this.lit) { ctx.fillStyle = '#fff6dc'; ellipse(ctx, x, y - 25, 1.8, 3); ctx.fill(); }
    ctx.fillStyle = '#2a2018'; ctx.fillRect(x - 24, y - 4, 48, 4);
    // 龛顶的小屋檐
    ctx.fillStyle = '#3a1f16'; ctx.beginPath(); ctx.moveTo(x - 28, y - 50); ctx.quadraticCurveTo(x, y - 62, x + 28, y - 50); ctx.lineTo(x + 22, y - 56); ctx.quadraticCurveTo(x, y - 74, x - 22, y - 56); ctx.closePath(); ctx.fill();
    if (this.near(L) && !L.player.dead) {
      const a = 0.6 + 0.4 * Math.sin(L.time * 4);
      text(ctx, this.lit ? '↑ 休憩' : '点灯', x, y - 78, 13, `rgba(255,220,160,${a})`);
    }
  }
}

/** 碑：赑屃驮着的石碑，靠近按 ↑ 阅读碑文 */
export class Stele {
  read = false;
  constructor(public x: number, public y: number, public text: SteleText) {}
  near(L: Level) { const p = L.player; return Math.abs(p.cx - this.x) < 34 && Math.abs(p.bottom - this.y) < 40; }
  draw(ctx: CanvasRenderingContext2D, L: Level) {
    const x = this.x, y = this.y, near = this.near(L) && !L.player.dead;
    const pulse = 0.5 + 0.5 * Math.sin(L.time * 2 + x);
    if (!this.read) addGlow(ctx, x, y - 40, 50, '255,190,120', 0.06 + 0.05 * pulse);
    // 赑屃
    ctx.fillStyle = '#211a14';
    ctx.beginPath(); ctx.ellipse(x, y - 7, 26, 9, 0, Math.PI, 0); ctx.lineTo(x + 26, y); ctx.lineTo(x - 26, y); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 27, y - 7, 6, 4.5, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(180,140,90,0.25)'; ctx.lineWidth = 1;
    for (const dx of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(x + dx - 6, y - 10); ctx.lineTo(x + dx, y - 14); ctx.lineTo(x + dx + 6, y - 10); ctx.stroke(); }
    // 碑身与碑首
    const g = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
    g.addColorStop(0, '#3a3128'); g.addColorStop(0.5, '#4a3f33'); g.addColorStop(1, '#2a231c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 13); ctx.lineTo(x - 13, y - 58);
    ctx.quadraticCurveTo(x - 15, y - 72, x, y - 74); ctx.quadraticCurveTo(x + 15, y - 72, x + 13, y - 58);
    ctx.lineTo(x + 13, y - 13); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#140f0b'; ctx.lineWidth = 1.2; ctx.stroke();
    // 碑首的螭龙盘纹
    ctx.strokeStyle = 'rgba(20,14,10,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x - 5, y - 64, 3.5, 0, Math.PI * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 5, y - 64, 3.5, Math.PI, Math.PI * 2.6); ctx.stroke();
    // 碑额与竖行刻字
    ctx.fillStyle = '#1e1813'; ctx.fillRect(x - 4, y - 60, 8, 8);
    const lit = near ? 0.75 : this.read ? 0.12 : 0.25 + 0.15 * pulse;
    ctx.fillStyle = `rgba(255,200,130,${lit})`;
    for (let c = 0; c < 4; c++) for (let k = 0; k < 7; k++) {
      if (((c * 7 + k) * 13 + Math.floor(x)) % 5 === 0) continue;
      ctx.fillRect(x + 7 - c * 4.6, y - 48 + k * 4.8, 2.2, 2.6);
    }
    // 青苔与裂纹
    ctx.fillStyle = 'rgba(110,150,100,0.35)'; ctx.fillRect(x - 13, y - 22, 5, 9);
    ctx.strokeStyle = 'rgba(10,8,6,0.8)'; ctx.beginPath(); ctx.moveTo(x + 13, y - 40); ctx.lineTo(x + 7, y - 34); ctx.lineTo(x + 9, y - 27); ctx.stroke();
    if (near) {
      const a = 0.6 + 0.4 * Math.sin(L.time * 4);
      text(ctx, '↑ 读', x, y - 88, 13, `rgba(255,220,160,${a})`);
    }
  }
}

export class Cache {
  broken = false;
  private shake = 0;
  constructor(private level: Level, public x: number, public y: number) {}
  rect(): Rect { return { x: this.x - 18, y: this.y - 24, w: 36, h: 24 }; }
  break() {
    if (this.broken) return;
    this.broken = true;
    const L = this.level;
    sfx.breakBox(); L.cam.shake(3);
    L.particles.burst(this.x, this.y - 12, 14, { color: '#2b2730', kind: 'shard', speed: [80, 260], angle: -Math.PI / 2, spread: 1.4, grav: 1300, size: [2, 6] });
    L.dropEmbers(this.x, this.y - 16, Math.round(rand(18, 34)));
  }
  update(dt: number) { this.shake = Math.max(0, this.shake - dt); }
  draw(ctx: CanvasRenderingContext2D, L: Level) {
    const x = this.x, y = this.y;
    if (this.broken) {
      ctx.fillStyle = '#121016';
      ctx.fillRect(x - 18, y - 6, 12, 6); ctx.fillRect(x + 4, y - 4, 14, 4);
      return;
    }
    addGlow(ctx, x, y - 12, 34, '255,170,90', 0.12 + 0.06 * Math.sin(L.time * 3));
    // 遗骸：倒伏的朝圣者与行囊
    ctx.fillStyle = '#1e1813';
    ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.quadraticCurveTo(x - 14, y - 20, x + 4, y - 18); ctx.quadraticCurveTo(x + 18, y - 14, x + 18, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(180,150,120,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#cfc7b6'; ellipse(ctx, x + 10, y - 12, 4.5, 5.5, 0.6); ctx.fill();
    ctx.fillStyle = '#ffb35c'; ctx.beginPath(); ctx.arc(x - 6, y - 8, 2, 0, Math.PI * 2); ctx.fill();
  }
}

export class EmberOrb {
  dead = false;
  private t = 0;
  vx: number; vy: number;
  constructor(public x: number, public y: number, public value: number) {
    const a = rand(-Math.PI * 0.85, -Math.PI * 0.15), sp = rand(160, 380);
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
  }
  update(dt: number, L: Level) {
    this.t += dt;
    const p = L.player;
    const d = dist(this.x, this.y, p.cx, p.cy);
    if (this.t > 0.45 && !p.dead && d < 150) {
      const k = 1600 * dt / Math.max(d, 1);
      this.vx += (p.cx - this.x) * k; this.vy += (p.cy - this.y) * k;
      this.vx *= 0.92; this.vy *= 0.92;
    } else {
      this.vy = Math.min(PHYS.maxFall, this.vy + 1400 * dt);
      this.vx *= Math.exp(-2 * dt);
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (L.map.solidAt(nx, this.y)) this.vx *= -0.5; else this.x = nx;
    if (L.map.solidAt(this.x, ny + 3) && this.vy > 0) { this.vy *= -0.35; if (Math.abs(this.vy) < 60) this.vy = 0; }
    else this.y = ny;
    if (d < 20 && !p.dead) { this.dead = true; L.game.addEmbers(this.value); sfx.ember(); }
    if (this.y > L.map.pxH + 50 || this.t > 30) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, L: Level) {
    const pulse = 0.7 + 0.3 * Math.sin(L.time * 8 + this.x);
    addGlow(ctx, this.x, this.y, 12, '255,170,80', 0.6 * pulse);
    ctx.fillStyle = '#ffe2a6';
    ctx.beginPath(); ctx.arc(this.x, this.y, 2.2, 0, Math.PI * 2); ctx.fill();
  }
}

/** 死亡时遗落的全部余烬。再次死亡前触碰即可取回。 */
export class DeathDrop {
  taken = false;
  constructor(public x: number, public y: number, public amount: number) {}
  update(L: Level) {
    const p = L.player;
    if (!this.taken && !p.dead && Math.abs(p.cx - this.x) < 28 && Math.abs(p.cy - (this.y - 24)) < 40) {
      this.taken = true;
      L.game.recoverDrop();
      sfx.shrine();
      L.particles.burst(this.x, this.y - 24, 30, { color: '#ffcf80', speed: [60, 220], add: true, life: [0.5, 1] });
      L.floater(this.x, this.y - 60, `取回余烬 ${this.amount}`, '#ffd27a', 15);
    }
  }
  draw(ctx: CanvasRenderingContext2D, L: Level) {
    if (this.taken) return;
    const x = this.x, y = this.y - 24 + Math.sin(L.time * 2) * 4;
    addGlow(ctx, x, y, 60, '255,150,70', 0.35 + 0.1 * Math.sin(L.time * 5));
    ctx.fillStyle = 'rgba(255,220,170,0.85)';
    ctx.beginPath();
    ctx.moveTo(x, y - 16 - Math.sin(L.time * 7) * 3);
    ctx.quadraticCurveTo(x + 9, y - 2, x, y + 8); ctx.quadraticCurveTo(x - 9, y - 2, x, y - 16 - Math.sin(L.time * 7) * 3);
    ctx.fill();
    glint(ctx, x, y - 2, 6, 0.5 + 0.3 * Math.sin(L.time * 3));
  }
}

/** 挥刃的月牙光 */
/** 刀光：一弯两头尖的月牙，几乎瞬间扫满（0.03s），随后变薄淡出——快出、慢收 */
export class SlashFx {
  t = 0;
  constructor(public dir: 'side' | 'up' | 'down', public facing: number) {}
  get dead() { return this.t > 0.16; }
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    const t = this.t;
    let a0: number, a1: number, ox = 0, oy = 0;
    if (this.dir === 'up') { a0 = Math.PI * 1.08; a1 = Math.PI * 1.92; oy = -14; }
    else if (this.dir === 'down') { a0 = Math.PI * 0.08; a1 = Math.PI * 0.92; oy = 18; }
    else if (this.facing > 0) { a0 = -1.3; a1 = 1.05; ox = 12; oy = -2; }
    else { a0 = Math.PI - 1.05; a1 = Math.PI + 1.3; ox = -12; oy = -2; }
    if (this.dir === 'side' && this.facing < 0) [a0, a1] = [a1, a0]; // 始终从刀出发的一侧扫向收刀的一侧
    const head = Math.min(1, t / 0.03);
    const fade = Math.max(0, (t - 0.035) / 0.12);
    const tail = Math.min(1, fade * 1.1);
    if (fade >= 1) return;
    const r = 40, thick = 15 * (1 - fade * 0.7);
    const s0 = a0 + (a1 - a0) * tail, s1 = a0 + (a1 - a0) * head;
    const X = cx + ox, Y = cy + oy, N = 14;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const path = new Path2D();
    for (let i = 0; i <= N; i++) {
      const u = i / N, ang = s0 + (s1 - s0) * u;
      path[i ? 'lineTo' : 'moveTo'](X + Math.cos(ang) * r, Y + Math.sin(ang) * r);
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N, ang = s0 + (s1 - s0) * u, w = thick * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.8;
      path.lineTo(X + Math.cos(ang) * (r - w), Y + Math.sin(ang) * (r - w));
    }
    path.closePath();
    ctx.fillStyle = `rgba(255,232,190,${0.85 * (1 - fade)})`; ctx.fill(path);
    // 刃口一线亮金
    ctx.strokeStyle = `rgba(255,250,235,${1 - fade})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(X, Y, r, Math.min(s0, s1), Math.max(s0, s1)); ctx.stroke();
    ctx.restore();
  }
}

export class Floater {
  life = 1.1;
  constructor(public x: number, public y: number, public text: string, public color: string, public size: number) {}
}

/** 命中闪光：沿打击方向的一道亮刃 + 垂直的短十字 + 一圈迅速扩散的冲击环 */
export function drawImpact(ctx: CanvasRenderingContext2D, f: { x: number; y: number; a: number; t: number; big: boolean }) {
  const k = f.t / 0.12, s = f.big ? 1.5 : 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(f.x, f.y); ctx.rotate(f.a);
  const len = (26 + 18 * k) * s, w = 5 * (1 - k) * s;
  ctx.fillStyle = `rgba(255,236,190,${1 - k})`;
  ctx.beginPath(); ctx.moveTo(-len * 0.45, 0); ctx.lineTo(0, -w); ctx.lineTo(len, 0); ctx.lineTo(0, w); ctx.closePath(); ctx.fill();
  const cw = 12 * (1 - k * 0.6) * s;
  ctx.fillStyle = `rgba(255,250,235,${(1 - k) * 0.9})`;
  ctx.beginPath(); ctx.moveTo(0, -cw); ctx.lineTo(1.6 * s, 0); ctx.lineTo(0, cw); ctx.lineTo(-1.6 * s, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(255,200,120,${(1 - k) * 0.8})`; ctx.lineWidth = 2 * (1 - k) + 0.5;
  ctx.beginPath(); ctx.arc(0, 0, (6 + 22 * k) * s, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
