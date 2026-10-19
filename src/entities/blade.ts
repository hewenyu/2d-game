// 回锋之刃：掷出 → 钉入墙壁/敌人 → 召回时撕裂沿途一切。
// 钉在侧墙上的刃可以当作落脚点。
import { PLAYER_BASE, PHYS } from '../config';
import { dist, overlap, segRect, type Rect } from '../core/math';
import { sfx } from '../core/audio';
import type { Level } from '../game/level';
import { addGlow } from '../render/draw';
import type { Enemy } from './enemy';

export type BladeState = 'hand' | 'fly' | 'stuck' | 'loose' | 'recall';

const SPEED = 1150;
const RANGE = 580;
const RECALL_SPEED = 1550;

export class Blade {
  state: BladeState = 'hand';
  x = 0; y = 0; vx = 0; vy = 0; ang = 0;
  private traveled = 0;
  stuckTo: Enemy | null = null;
  private relX = 0; private relY = 0;
  /** 钉在侧墙时，刃身伸出的方向（-1 向左 / 1 向右），0 表示不是侧墙 */
  wallSide = 0;
  stuckT = 0;
  private hitId = 0;
  private recallHit = new Set<Enemy>();
  trail: { x: number; y: number; a: number }[] = [];

  constructor(private level: Level) {}

  /** 可以召回（离手且不在召回中） */
  get away() { return this.state === 'fly' || this.state === 'stuck' || this.state === 'loose'; }

  reset() { this.state = 'hand'; this.stuckTo = null; this.trail = []; this.wallSide = 0; }

  throwFrom(x: number, y: number, ang: number) {
    Object.assign(this, { state: 'fly', x, y, ang, vx: Math.cos(ang) * SPEED, vy: Math.sin(ang) * SPEED, traveled: 0, stuckTo: null, wallSide: 0 });
    this.hitId = this.level.newHitId();
    this.trail = [];
    sfx.throw();
  }

  recall() {
    if (!this.away) return;
    const L = this.level;
    this.recallHit = new Set();
    this.hitId = L.newHitId();
    if (this.state === 'stuck' && this.stuckTo && this.stuckTo.alive) {
      const e = this.stuckTo;
      this.recallHit.add(e);
      const r = e.takeHit({ dmg: PLAYER_BASE.ripDmg, poise: 14, kind: 'rip', x: L.player.cx, y: L.player.cy, id: L.newHitId() });
      if (r === 'hit' || r === 'kill') { sfx.hit(); L.hitstop(0.05); }
    }
    this.stuckTo = null; this.wallSide = 0;
    this.state = 'recall'; this.trail = [];
    sfx.recall();
  }

  /** Boss 把刃甩开 */
  knockOff(vx: number) {
    this.state = 'loose'; this.stuckTo = null; this.wallSide = 0;
    this.vx = vx; this.vy = -520;
    sfx.clang();
  }

  /** 钉在侧墙上时形成的单向平台 */
  platform(): Rect | null {
    if (this.state !== 'stuck' || this.stuckTo || this.wallSide === 0) return null;
    const x0 = this.wallSide > 0 ? this.x : this.x - 30;
    return { x: x0, y: this.y - 3, w: 30, h: 6 };
  }

  update(dt: number) {
    const L = this.level, p = L.player;
    if (this.state === 'fly') {
      const total = SPEED * dt, steps = Math.ceil(total / 7);
      const sx = this.vx * dt / steps, sy = this.vy * dt / steps;
      outer: for (let i = 0; i < steps; i++) {
        const nx = this.x + sx, ny = this.y + sy;
        if (L.map.solidAt(nx, ny)) {
          this.state = 'stuck';
          const sideHit = L.map.solidAt(nx, this.y) && !L.map.solidAt(this.x, ny);
          if (sideHit && Math.abs(Math.cos(this.ang)) > 0.55) {
            // 刃尖没入侧墙，刃身水平伸出
            const wallX = sx > 0 ? Math.floor(nx / 32) * 32 : (Math.floor(nx / 32) + 1) * 32;
            this.wallSide = sx > 0 ? -1 : 1;
            this.x = wallX; this.ang = sx > 0 ? 0 : Math.PI;
          } else { this.wallSide = 0; }
          sfx.thunk();
          L.particles.burst(this.x, this.y, 8, { color: '#b8c2d0', speed: [40, 160], angle: this.ang + Math.PI, spread: 1, life: [0.2, 0.4] });
          break;
        }
        for (const e of L.targets()) {
          if (!pointIn(nx, ny, e.rect(), 5)) continue;
          const res = e.takeHit({ dmg: PLAYER_BASE.throwDmg, poise: 8, kind: 'throw', x: this.x - this.vx * 0.05, y: this.y, id: this.hitId });
          if (res === 'hit') {
            this.state = 'stuck'; this.stuckTo = e; this.stuckT = 0; this.relX = nx - e.cx; this.relY = ny - e.cy;
            sfx.hit(); L.hitstop(0.04);
            break outer;
          }
          if (res === 'blocked' || res === 'immune') {
            this.state = 'loose'; this.vx = -this.vx * 0.2; this.vy = -260;
            L.onBlocked(e, nx, ny);
            break outer;
          }
          // kill：贯穿继续飞
        }
        for (const c of L.caches) if (!c.broken && pointIn(nx, ny, c.rect(), 4)) c.break();
        this.x = nx; this.y = ny; this.traveled += Math.hypot(sx, sy);
        if (this.traveled >= RANGE) { this.state = 'loose'; this.vx *= 0.15; this.vy = 0; break; }
      }
    } else if (this.state === 'stuck' && this.stuckTo) {
      const e = this.stuckTo;
      if (!e.alive) { this.state = 'loose'; this.stuckTo = null; this.vx = 0; this.vy = -200; }
      else { this.x = e.cx + this.relX; this.y = e.cy + this.relY; this.stuckT += dt; }
    } else if (this.state === 'loose') {
      this.vy = Math.min(PHYS.maxFall, this.vy + PHYS.gravity * dt);
      const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
      if (L.map.solidAt(nx, this.y)) this.vx = -this.vx * 0.3; else this.x = nx;
      if (L.map.solidAt(this.x, ny + 3)) { this.vy = 0; this.vx *= 0.8; this.y = Math.floor((ny + 3) / 32) * 32 - 3; }
      else this.y = ny;
      this.ang += this.vx * dt * 0.02;
      if (this.y > L.map.pxH + 40) { this.reset(); sfx.catch(); L.toast('刃循丝而归'); }
    } else if (this.state === 'recall') {
      const tx = p.handX, ty = p.handY;
      const d = dist(this.x, this.y, tx, ty), step = RECALL_SPEED * dt;
      if (d <= step + 14) { this.catch(); return; }
      const a = Math.atan2(ty - this.y, tx - this.x);
      const nx = this.x + Math.cos(a) * step, ny = this.y + Math.sin(a) * step;
      for (const e of L.targets()) {
        if (this.recallHit.has(e)) continue;
        const r = e.rect();
        if (!segRect(this.x, this.y, nx, ny, { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 })) continue;
        this.recallHit.add(e);
        const res = e.takeHit({ dmg: p.stats.recallDmg, poise: 55, kind: 'recall', x: this.x, y: this.y, id: this.hitId });
        if (res === 'blocked') {
          this.state = 'loose'; this.vx = Math.cos(a) * -150; this.vy = -240; this.x = this.x + (nx - this.x) * 0.3;
          L.onBlocked(e, this.x, this.y);
          return;
        }
        if (res === 'hit' || res === 'kill') { sfx.heavy(); L.hitstop(0.09); L.cam.shake(6); L.cam.kick(-Math.cos(a) * 6, -Math.sin(a) * 6); L.recallSlashFx(e.cx, e.cy, a); L.impact(e.cx, e.cy, a, true); }
      }
      for (const c of L.caches) if (!c.broken && segRect(this.x, this.y, nx, ny, c.rect())) c.break();
      this.x = nx; this.y = ny; this.ang = a + Math.PI;
    }

    if (this.state === 'fly' || this.state === 'recall') { this.trail.push({ x: this.x, y: this.y, a: 1 }); if (this.trail.length > 12) this.trail.shift(); }
    for (const t of this.trail) t.a -= dt * 5;
    this.trail = this.trail.filter((t) => t.a > 0);

    // 走过去拾起（钉在侧墙上的刃是落脚点，只能召回，免得起跳时被身体蹭回手里）
    if (((this.state === 'loose' && this.vy === 0) || (this.state === 'stuck' && !this.stuckTo && this.wallSide === 0)) && !p.dead) {
      if (overlap(p.rect(), { x: this.x - 14, y: this.y - 14, w: 28, h: 28 })) this.catch();
    }
  }

  private catch() {
    this.state = 'hand'; this.stuckTo = null; this.wallSide = 0; this.trail = [];
    sfx.catch();
    const p = this.level.player;
    this.level.particles.ring(p.handX, p.handY, 3, 20, 'rgba(255,220,150,0.8)', 0.25, 2);
  }

  /** 召回路径上会被撕裂/会被挡下的敌人 */
  preview(): { e: Enemy; blocked: boolean; rip: boolean }[] {
    const out: { e: Enemy; blocked: boolean; rip: boolean }[] = [];
    if (!this.away || this.state === 'fly') return out;
    const L = this.level, p = L.player;
    for (const e of L.targets()) {
      if (e === this.stuckTo) { out.push({ e, blocked: false, rip: true }); continue; }
      const r = e.rect();
      if (segRect(this.x, this.y, p.handX, p.handY, { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 })) {
        out.push({ e, blocked: e.blocks({ dmg: 0, poise: 0, kind: 'recall', x: this.x, y: this.y, id: -1 }, true), rip: false });
      }
    }
    return out;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const L = this.level, p = L.player;
    if (this.state === 'hand') return;
    const prev = this.preview();
    const lethal = prev.some((v) => !v.blocked);
    // 金线
    ctx.save();
    if (this.state !== 'recall') ctx.setLineDash([5, 5]);
    ctx.strokeStyle = this.state === 'recall' ? 'rgba(255,230,170,0.9)' : lethal ? 'rgba(255,214,120,0.85)' : 'rgba(226,190,110,0.35)';
    ctx.lineWidth = lethal ? 1.8 : 1.1;
    ctx.beginPath(); ctx.moveTo(p.handX, p.handY); ctx.lineTo(this.x, this.y); ctx.stroke();
    ctx.restore();
    for (const v of prev) {
      const r = v.e.rect(), cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.max(r.w, r.h) * 0.62 + 6 + Math.sin(L.time * 10) * 1.5;
      ctx.save(); ctx.setLineDash([4, 4]);
      ctx.strokeStyle = v.blocked ? 'rgba(170,175,190,0.7)' : 'rgba(255,214,120,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // 拖尾
    for (const t of this.trail) addGlow(ctx, t.x, t.y, 10 * t.a, '255,214,140', 0.25 * t.a);
    // 刃身
    const a = this.ang, L2 = 30;
    let hx: number, hy: number;
    if (this.state === 'stuck') { hx = this.x - Math.cos(a) * 18; hy = this.y - Math.sin(a) * 18; }
    else { hx = this.x - Math.cos(a) * L2 / 2; hy = this.y - Math.sin(a) * L2 / 2; }
    const tx = hx + Math.cos(a) * L2, ty = hy + Math.sin(a) * L2;
    if (this.state !== 'stuck' || !this.stuckTo) addGlow(ctx, (hx + tx) / 2, (hy + ty) / 2, this.platform() ? 26 : 18, '255,210,130', this.platform() ? 0.3 : 0.18);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#05060a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#ffe4a6'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3;
    const px = -Math.sin(a) * 5, py = Math.cos(a) * 5;
    ctx.beginPath(); ctx.moveTo(hx - px, hy - py); ctx.lineTo(hx + px, hy + py); ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

function pointIn(x: number, y: number, r: Rect, pad: number) {
  return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
}
