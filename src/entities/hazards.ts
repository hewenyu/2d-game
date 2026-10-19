// Boss 招式产生的独立危险物：地面冲击波、钟鸣波、落石。
import { TILE } from '../config';
import { overlap, ringRect, type Rect } from '../core/math';
import { sfx } from '../core/audio';
import type { Level } from '../game/level';
import { addGlow } from '../render/draw';

export abstract class Hazard {
  dead = false;
  protected hit = false;
  abstract update(dt: number, L: Level): void;
  abstract draw(ctx: CanvasRenderingContext2D, L: Level): void;
  protected touch(L: Level, r: Rect, dmg: number, fromX: number, cause: string) {
    if (this.hit || L.player.dead) return;
    if (overlap(r, L.player.rect())) { this.hit = true; L.player.hurt(dmg, fromX, cause); }
  }
}

/** 贴地推进的冲击波：跳过去 */
export class Shockwave extends Hazard {
  private life = 3;
  constructor(private x: number, private floorY: number, private dir: number, private speed = 480) { super(); }
  update(dt: number, L: Level) {
    this.x += this.dir * this.speed * dt;
    this.life -= dt;
    const m = L.map;
    if (this.life <= 0 || m.solidAt(this.x + this.dir * 14, this.floorY - 10) || !m.solidAt(this.x, this.floorY + 4)) {
      this.dead = true;
      L.particles.burst(this.x, this.floorY - 10, 6, { color: 'rgba(200,220,255,0.7)', speed: [40, 120], life: [0.2, 0.4], add: true });
      return;
    }
    if (Math.random() < 0.7) L.particles.spawn({ x: this.x - this.dir * 10, y: this.floorY - Math.random() * 20, vx: -this.dir * 40, vy: -60, life: 0.35, color: 'rgba(170,200,240,0.7)', add: true, size: 2 });
    this.touch(L, { x: this.x - 14, y: this.floorY - 32, w: 28, h: 32 }, 1, this.x - this.dir * 50, 'shock');
  }
  draw(ctx: CanvasRenderingContext2D) {
    const x = this.x, y = this.floorY;
    addGlow(ctx, x, y - 14, 40, '170,200,255', 0.45);
    ctx.fillStyle = 'rgba(230,240,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(x - this.dir * 18, y);
    ctx.quadraticCurveTo(x - this.dir * 4, y - 40, x + this.dir * 12, y - 30);
    ctx.quadraticCurveTo(x + this.dir * 4, y - 12, x + this.dir * 10, y);
    ctx.closePath(); ctx.fill();
  }
}

/** 钟鸣波：扩散的圆环，冲刺穿过 */
export class Ring extends Hazard {
  R = 30;
  constructor(private x: number, private y: number, private speed = 330, private max = 820, private th = 18) { super(); }
  update(dt: number, L: Level) {
    this.R += this.speed * dt;
    if (this.R > this.max) { this.dead = true; return; }
    if (!this.hit && !L.player.dead && ringRect(this.x, this.y, this.R, this.th, L.player.rect())) {
      this.hit = true;
      L.player.hurt(1, this.x, 'ring');
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    const a = Math.min(1, (this.max - this.R) / 200);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,90,60,${0.35 * a})`; ctx.lineWidth = this.th + 10;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,220,${0.9 * a})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

/** 落石：先有落尘与地面光斑预警，再砸下 */
export class Debris extends Hazard {
  private t = 0;
  private y: number;
  private vy = 0;
  private ceil: number;
  constructor(private x: number, private floorY: number, L: Level, private warn = 0.9) {
    super();
    let ty = Math.floor((floorY - 40) / TILE);
    while (ty > 0 && !L.map.solid(Math.floor(x / TILE), ty)) ty--;
    this.ceil = (ty + 1) * TILE;
    this.y = this.ceil - 10;
  }
  update(dt: number, L: Level) {
    this.t += dt;
    if (this.t < this.warn) {
      if (Math.random() < 0.5) L.particles.spawn({ x: this.x + (Math.random() - 0.5) * 24, y: this.ceil, vy: 260, life: 0.7, color: 'rgba(150,150,160,0.7)', size: 2, grav: 300 });
      return;
    }
    this.vy += 2600 * dt;
    this.y += this.vy * dt;
    this.touch(L, { x: this.x - 13, y: this.y - 13, w: 26, h: 26 }, 1, this.x, 'debris');
    if (this.y + 13 >= this.floorY) {
      this.dead = true;
      sfx.thunk();
      L.cam.shake(3);
      L.particles.burst(this.x, this.floorY - 4, 10, { color: '#4a4a55', kind: 'shard', speed: [80, 260], angle: -Math.PI / 2, spread: 1.2, grav: 1400, life: [0.4, 0.8], size: [2, 5] });
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.t < this.warn) {
      const k = this.t / this.warn;
      addGlow(ctx, this.x, this.floorY - 2, 30 + k * 10, '255,120,80', 0.15 + k * 0.35);
      ctx.fillStyle = `rgba(255,140,100,${0.2 + k * 0.4})`;
      ctx.fillRect(this.x - 14, this.floorY - 2, 28, 2);
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.t * 6);
    ctx.fillStyle = '#2b2c33'; ctx.strokeStyle = 'rgba(160,170,190,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-13, -6); ctx.lineTo(-4, -13); ctx.lineTo(11, -9); ctx.lineTo(13, 6); ctx.lineTo(2, 13); ctx.lineTo(-11, 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
