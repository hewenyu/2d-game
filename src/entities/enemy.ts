import { PHYS } from '../config';
import { overlap, type Rect } from '../core/math';
import { sfx } from '../core/audio';
import type { Level } from '../game/level';
import { moveBody } from '../world/physics';
import type { AttackBox, HitInfo, HitResult } from './types';

/** 敌人基类：重力、受击、架势、击退、死亡掉落余烬。具体行为由子类实现。 */
export abstract class Enemy {
  abstract readonly kind: string;
  abstract readonly displayName: string;
  x: number; y: number; vx = 0; vy = 0; onGround = false;
  facing: 1 | -1 = -1;
  hp: number; maxHp: number;
  dead = false; deadT = 0; remove = false;
  flash = 0;
  /** 受击抖动的剩余时间 */
  hitShake = 0;
  state = 'idle';
  t = 0;
  poise: number; maxPoise: number; poiseT = 0;
  embers = 3;
  /** 当前造成伤害的攻击框 */
  attack: AttackBox | null = null;
  /** 碰撞伤害（面具数），0 为无 */
  contact = 0;
  flying = false;
  /** 不会被击退（大型） */
  heavy = false;
  kbx = 0;
  private hitIds: number[] = [];
  readonly spawnX: number; readonly spawnY: number;

  constructor(public level: Level, cx: number, feetY: number, public w: number, public h: number, hp: number, poise: number) {
    this.x = cx - w / 2; this.y = feetY - h;
    this.spawnX = cx; this.spawnY = feetY;
    this.hp = this.maxHp = hp;
    this.poise = this.maxPoise = poise;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }
  rect(): Rect { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  get player() { return this.level.player; }
  get alive() { return !this.dead; }

  /** 该次攻击是否被格挡（盾卫重写） */
  blocks(_h: HitInfo, _preview = false): boolean { return false; }
  /** 该状态下是否有霸体（不被架势打断） */
  armored(): boolean { return false; }
  /** 架势被打空 */
  onStagger() { this.state = 'stagger'; this.t = 0; this.attack = null; }
  /** 受伤倍率（例如 Boss 跪地时） */
  damageMul(): number { return 1; }
  immune(): boolean { return false; }

  takeHit(h: HitInfo): HitResult {
    if (this.dead) return 'none';
    if (this.hitIds.includes(h.id)) return 'none';
    this.hitIds.push(h.id); if (this.hitIds.length > 12) this.hitIds.shift();
    const L = this.level;
    if (this.immune()) { sfx.clang(); L.sparks(this.cx, this.cy, '#cfd6e0', 6); return 'immune'; }
    if (h.kind !== 'rip' && this.blocks(h)) return 'blocked';
    const dmg = Math.round(h.dmg * this.damageMul());
    this.hp -= dmg;
    this.flash = 0.1;
    this.hitShake = 0.16;
    const dir = Math.sign(this.cx - h.x) || 1;
    const big = h.kind === 'recall';
    L.inkBurst(this.cx, this.cy, dir, big ? 16 : 8);
    if (!this.heavy) this.kbx = dir * (big ? 340 : 170);
    if (!this.armored() || big) this.poise -= h.poise;
    this.poiseT = 1.4;
    if (this.hp <= 0) { this.die(); return 'kill'; }
    if (this.poise <= 0) { this.poise = this.maxPoise; this.onStagger(); }
    return 'hit';
  }

  die() {
    this.dead = true; this.deadT = 0; this.attack = null; this.hp = 0;
    sfx.kill();
    this.level.onEnemyKilled(this);
  }

  /** 通用物理：重力 + 击退 */
  physics(dt: number) {
    if (this.flying) {
      const vx = this.vx;
      this.vx = vx + this.kbx;
      const r = moveBody(this, dt, this.level.map, [], true);
      this.vx = vx;
      if (r.hitX) this.onWall(r.wallDir);
    } else {
      this.vy = Math.min(PHYS.maxFall, this.vy + PHYS.gravity * dt);
      const vx = this.vx;
      this.vx = vx + this.kbx;
      const r = moveBody(this, dt, this.level.map);
      this.vx = vx;
      if (r.hitX) this.onWall(r.wallDir);
    }
    this.kbx *= Math.exp(-10 * dt);
    if (Math.abs(this.kbx) < 5) this.kbx = 0;
  }
  onWall(_dir: number) {}

  /** 前方是否有可走的地面（巡逻防止掉坑） */
  groundAhead(dir: number): boolean {
    const m = this.level.map;
    const fx = dir > 0 ? this.x + this.w + 4 : this.x - 4;
    return m.solidAt(fx, this.bottom + 6) && !m.spikeAt(fx, this.bottom - 4) && !m.solidAt(fx, this.bottom - 12);
  }

  tick(dt: number) {
    if (this.dead) { this.deadT += dt; if (this.deadT > 1.2) this.remove = true; return; }
    this.t += dt; this.flash -= dt; this.poiseT -= dt; this.hitShake = Math.max(0, this.hitShake - dt);
    if (this.poiseT <= 0) this.poise = Math.min(this.maxPoise, this.poise + this.maxPoise * 0.6 * dt);
    this.update(dt);
  }

  abstract update(dt: number): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;

  /** 与玩家的距离信息 */
  sense() {
    const p = this.player;
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    return { dx, dy, adx: Math.abs(dx), ady: Math.abs(dy), dir: (Math.sign(dx) || 1) as 1 | -1, pdead: p.dead };
  }
  attackHits(): boolean { return !!this.attack && overlap(this.attack.box, this.player.rect()); }

  /** 死亡淡出 */
  deathAlpha() { return this.dead ? Math.max(0, 1 - this.deadT / 0.6) : 1; }
}
