// 守钟人·玄寂：三百年不停撞钟，梵钟长进了他的背里；手持撞钟巨木。精英版「残响」是他留在渊中的回声。
// 一阶段：横扫 / 跃击（落地冲击波）/ 冲撞（撞墙眩晕）
// 二阶段（半血）：新增 钟鸣波 / 落石，以及 连续横扫、冲撞接跃击 的连段；会甩开插在身上的刃。
import { BOSS_LORE } from '../../data/lore';
import { PHYS } from '../../config';
import { approach, clamp, rand } from '../../core/math';
import { sfx } from '../../core/audio';
import type { Level } from '../../game/level';
import { moveBody } from '../../world/physics';
import type { Arena } from '../../world/levelgen';
import { addGlow, glint } from '../../render/draw';
import { AbbotModel } from '../../render/models/abbot';
import { Enemy } from '../enemy';
import { Debris, Ring, Shockwave } from '../hazards';
import type { HitInfo, HitResult } from '../types';

type Atk = 'sweep' | 'sweepB' | 'leap' | 'charge' | 'toll' | 'debris' | 'land';

export class Bellkeeper extends Enemy {
  readonly kind = 'boss';
  readonly displayName: string;
  readonly epithet: string;
  phase = 1;
  private atk: Atk | null = null;
  private queue: Atk[] = [];
  private hist: string[] = [];
  private cd = 1;
  private glinted = false;
  private leapStage: 'rise' | 'hover' | 'fall' = 'rise';
  private targetX = 0;
  private spawned = 0;
  private roared = false;
  private bellGlow = 0;
  private hammer = 1.2;
  private model = new AbbotModel();

  constructor(level: Level, private arena: Arena, readonly elite: boolean, hpScale: number) {
    super(level, arena.boss.x, arena.boss.y, 76, 118, Math.round(650 * hpScale), 100);
    this.displayName = elite ? '玄寂 · 残响' : '守钟人 · 玄寂';
    this.epithet = BOSS_LORE[elite ? 'elite' : 'normal'].epithet;
    this.heavy = true;
    this.embers = elite ? 220 : 150;
    this.state = 'dormant';
    this.facing = arena.boss.x > (arena.x0 + arena.x1) / 2 ? -1 : 1;
  }

  private get adv() { return this.phase >= 2 || this.elite; }
  private get wm() { return (this.elite ? 0.86 : 1) * (this.phase >= 2 ? 0.86 : 1); }

  wake() { if (this.state === 'dormant') { this.state = 'intro'; this.t = 0; } }

  immune() { return this.state === 'dormant' || this.state === 'transition'; }
  damageMul() { return this.state === 'stun' || this.state === 'stagger' ? 1.5 : 1; }

  onStagger() {
    if (this.state === 'transition' || this.dead) return;
    this.state = 'stagger'; this.t = 0; this.attack = null; this.queue = []; this.vx = 0; this.atk = null;
    if (!this.onGround) this.vy = 300;
    this.level.floater(this.cx, this.y - 20, '破 绽', '#ffd27a', 24);
    sfx.heavy(); this.level.cam.shake(8);
  }

  takeHit(h: HitInfo): HitResult {
    const r = super.takeHit(h);
    if ((r === 'hit') && this.phase === 1 && this.hp <= this.maxHp * 0.5 && !this.elite) {
      this.state = 'transition'; this.t = 0; this.attack = null; this.queue = []; this.atk = null; this.vx = 0; this.roared = false; this.spawned = 0;
      this.level.banner('沉钟 鸣响', '守钟人敲响了他背负的钟');
    }
    return r;
  }

  die() { super.die(); this.level.onBossKilled(this); }

  private choose() {
    const s = this.sense(), d = s.adx;
    let opts: [string, number][];
    if (d < 220) opts = [['sweep', 3], ['leap', 1.2]];
    else if (d < 440) opts = [['leap', 2.5], ['charge', 1.6]];
    else opts = [['charge', 3], ['leap', 1.1]];
    if (this.adv) {
      opts.push(['toll', 1.4], ['debris', 1.1], ['chargeLeap', d >= 220 ? 1.6 : 0.4]);
      if (d < 220) opts.push(['sweep2', 2.4]);
    }
    const h = this.hist;
    opts = opts.map(([n, w]) => [n, h.length >= 2 && h[h.length - 1] === n && h[h.length - 2] === n ? 0 : h[h.length - 1] === n ? w * 0.45 : w]);
    const total = opts.reduce((a, o) => a + o[1], 0);
    let r = Math.random() * total, pick = opts[0][0];
    for (const [n, w] of opts) { r -= w; if (r <= 0) { pick = n; break; } }
    h.push(pick); if (h.length > 4) h.shift();
    this.queue = pick === 'sweep2' ? ['sweep', 'sweepB'] : pick === 'chargeLeap' ? ['charge', 'leap'] : [pick as Atk];
    this.start(this.queue.shift()!);
  }

  private start(a: Atk) {
    this.atk = a; this.state = 'windup'; this.t = 0; this.glinted = false; this.spawned = 0;
    this.facing = this.sense().dir;
    if (a !== 'sweepB') sfx.warn();
  }

  private windTime(): number {
    switch (this.atk) {
      case 'sweep': return 0.72 * this.wm;
      case 'sweepB': return 0.46 * this.wm;
      case 'leap': return 0.42 * this.wm;
      case 'charge': return 0.78 * this.wm;
      case 'toll': return 0.95 * this.wm;
      case 'debris': return 0.7 * this.wm;
      default: return 0.5;
    }
  }
  private recTime(): number {
    const more = this.queue.length > 0;
    switch (this.atk) {
      case 'sweep': case 'sweepB': return more ? 0.2 : 0.68;
      case 'land': return 1.05;
      case 'charge': return more ? 0.25 : 0.7;
      case 'toll': return 0.8;
      case 'debris': return 0.6;
      default: return 0.6;
    }
  }

  update(dt: number) {
    const L = this.level, s = this.sense();
    this.contact = ['stagger', 'stun', 'dormant', 'intro', 'transition'].includes(this.state) ? 0 : 1;
    this.bellGlow = approach(this.bellGlow, (this.atk === 'toll' && this.state === 'windup') || (this.state === 'transition' && this.t < 1.3) ? 1 : 0, dt * 3);
    // 二阶段甩开插在身上的刃
    if (this.adv && L.blade.stuckTo === this && L.blade.stuckT > 1.4 && this.state !== 'stagger') {
      L.blade.knockOff(rand(-420, 420));
      L.floater(this.cx, this.y - 10, '刃被甩开', '#ffd27a', 15);
    }
    let customPhysics = false;
    switch (this.state) {
      case 'dormant':
        this.vx = 0; break;
      case 'intro':
        this.vx = 0; this.facing = s.dir;
        if (this.t > 0.7 && !this.roared) { this.roared = true; sfx.roar(); L.cam.shake(9); }
        if (this.t >= 2.0) { this.state = 'idle'; this.cd = 0.4; }
        break;
      case 'idle': {
        this.facing = s.dir;
        const want = s.adx > 170 ? this.facing * (this.adv ? 105 : 82) : 0;
        this.vx = approach(this.vx, want, 600 * dt);
        this.hammer = approach(this.hammer, 1.2, dt * 4);
        this.cd -= dt;
        if (this.cd <= 0 && !s.pdead) this.choose();
        break;
      }
      case 'windup': this.updateWindup(dt, s.dir); break;
      case 'leap': customPhysics = true; this.updateLeap(dt); break;
      case 'active': this.updateActive(dt); break;
      case 'recover':
        this.vx = approach(this.vx, 0, 1800 * dt);
        if (this.t >= this.recTime()) {
          if (this.queue.length) this.start(this.queue.shift()!);
          else { this.state = 'idle'; this.atk = null; this.cd = this.adv ? rand(0.25, 0.6) : rand(0.45, 0.9); }
        }
        break;
      case 'stun':
        this.vx = 0;
        if (this.t >= 1.9) { this.state = 'idle'; this.cd = 0.35; }
        break;
      case 'stagger':
        this.vx = approach(this.vx, 0, 1800 * dt);
        if (this.t >= 2.1) { this.state = 'idle'; this.cd = 0.3; }
        break;
      case 'transition':
        this.vx = 0;
        if (this.t > 0.5 && !this.roared) { this.roared = true; sfx.roar(); L.cam.shake(10); }
        if (this.t > 1.2 && this.spawned === 0) {
          this.spawned = 1; sfx.bell(); L.cam.shake(8);
          L.hazards.push(new Ring(this.cx - this.facing * 26, this.y + 34, 300));
          for (let i = 0; i < 3; i++) L.hazards.push(new Debris(clamp(L.player.cx + (i - 1) * rand(120, 200), this.arena.x0 + 30, this.arena.x1 - 30), this.arena.floorY, L, 1.1 + i * 0.15));
        }
        if (this.t >= 2.6) { this.phase = 2; this.state = 'idle'; this.cd = 0.5; }
        break;
    }
    if (customPhysics) {
      if (this.leapStage !== 'hover') this.vy = Math.min(1800, this.vy + PHYS.gravity * 1.1 * dt);
      moveBody(this, dt, L.map, [], true);
      this.x = clamp(this.x, this.arena.x0, this.arena.x1 - this.w);
      if (this.leapStage === 'fall' && this.onGround) this.land();
    } else this.physics(dt);
  }

  private updateWindup(dt: number, dir: 1 | -1) {
    const L = this.level, W = this.windTime();
    switch (this.atk) {
      case 'sweep': case 'sweepB':
        this.vx = approach(this.vx, 0, 1500 * dt);
        if (this.t < W * 0.5) this.facing = dir;
        this.hammer = -2.5 * Math.min(1, this.t / (W * 0.6));
        break;
      case 'leap':
        this.vx = 0; this.hammer = approach(this.hammer, -1.6, dt * 6);
        break;
      case 'charge':
        if (this.t < W * 0.45) this.facing = dir;
        this.vx = -this.facing * 25; this.hammer = 0.35;
        if (Math.random() < 0.5) L.particles.burst(this.cx - this.facing * 30, this.bottom - 3, 1, { color: 'rgba(120,120,135,0.7)', kind: 'smoke', speed: [30, 80], angle: Math.PI + (this.facing > 0 ? 0.3 : -0.3) - (this.facing > 0 ? 0 : Math.PI), spread: 0.4, size: [3, 6] });
        break;
      case 'toll':
        this.vx = 0; this.hammer = approach(this.hammer, 1.4, dt * 4);
        break;
      case 'debris':
        this.vx = 0; this.hammer = -2.2 * Math.min(1, this.t / (W * 0.7));
        break;
    }
    if (!this.glinted && this.t > W - 0.2 && this.atk !== 'leap') { this.glinted = true; sfx.glint(); }
    if (this.t < W) return;
    // 出招
    this.t = 0;
    switch (this.atk) {
      case 'sweep': case 'sweepB':
        this.state = 'active'; this.hammer = 0.6;
        this.vx = this.facing * 240;
        this.attack = { box: this.sweepBox(), dmg: 1, id: L.newHitId(), cause: 'sweep', hit: false, knock: 380 };
        sfx.slash(); L.cam.shake(4);
        break;
      case 'leap':
        this.state = 'leap'; this.leapStage = 'rise'; this.vy = -1180; this.onGround = false;
        this.targetX = L.player.cx;
        sfx.dash();
        break;
      case 'charge':
        this.state = 'active'; this.vx = this.facing * 780;
        this.attack = { box: this.rect(), dmg: 2, id: L.newHitId(), cause: 'charge', hit: false, knock: 480 };
        sfx.roar();
        break;
      case 'toll':
        this.state = 'active';
        break;
      case 'debris':
        this.state = 'active'; this.hammer = 1.4;
        sfx.boom(); L.cam.shake(9);
        L.particles.burst(this.cx + this.facing * 60, this.bottom, 14, { color: '#4a4a55', kind: 'shard', speed: [80, 260], angle: -Math.PI / 2, spread: 1, grav: 1400, size: [2, 5] });
        {
          const px = L.player.cx, xs = [px, px + rand(110, 190), px - rand(110, 190), px + rand(260, 360) * (Math.random() < 0.5 ? 1 : -1)];
          xs.forEach((x, i) => L.hazards.push(new Debris(clamp(x, this.arena.x0 + 24, this.arena.x1 - 24), this.arena.floorY, L, 0.85 + i * 0.12)));
        }
        break;
    }
  }

  private updateLeap(dt: number) {
    const L = this.level;
    if (this.leapStage === 'rise') {
      this.targetX = L.player.cx;
      this.vx = clamp((this.targetX - this.cx) * 2.6, -760, 760);
      if (this.vy >= 0) { this.leapStage = 'hover'; this.t = 0; this.vy = 0; this.vx = 0; sfx.glint(); }
    } else if (this.leapStage === 'hover') {
      this.vx = 0; this.vy = 0;
      if (this.t >= 0.32 * this.wm + 0.04) { this.leapStage = 'fall'; this.vy = 1700; }
    }
    void dt;
  }

  private land() {
    const L = this.level;
    this.state = 'active'; this.atk = 'land'; this.t = 0; this.hammer = 1.3; this.vx = 0;
    this.attack = { box: { x: this.cx - 100, y: this.bottom - 66, w: 200, h: 66 }, dmg: 2, id: L.newHitId(), cause: 'leap', hit: false, knock: 420 };
    const sp = this.adv ? 540 : 470;
    L.hazards.push(new Shockwave(this.cx + 40, this.bottom, 1, sp), new Shockwave(this.cx - 40, this.bottom, -1, sp));
    sfx.boom(); L.cam.shake(13);
    L.particles.burst(this.cx, this.bottom - 4, 22, { color: '#55555f', kind: 'shard', speed: [100, 340], angle: -Math.PI / 2, spread: 1.3, grav: 1500, life: [0.4, 0.9], size: [2, 6] });
    L.particles.burst(this.cx, this.bottom - 6, 10, { color: 'rgba(150,150,165,0.6)', kind: 'smoke', speed: [60, 160], angle: -Math.PI / 2, spread: 1.5, size: [6, 12], life: [0.5, 0.9] });
  }

  private updateActive(dt: number) {
    const L = this.level;
    switch (this.atk) {
      case 'sweep': case 'sweepB':
        this.vx = approach(this.vx, 0, 1400 * dt);
        if (this.attack) this.attack.box = this.sweepBox();
        if (this.t >= 0.17) { this.attack = null; this.state = 'recover'; this.t = 0; }
        break;
      case 'land':
        if (this.t >= 0.12) { this.attack = null; this.state = 'recover'; this.t = 0; }
        break;
      case 'charge':
        this.vx = this.facing * 780;
        if (this.attack) this.attack.box = this.rect();
        if (Math.random() < 0.7) L.particles.burst(this.cx - this.facing * 34, this.bottom - 4, 1, { color: 'rgba(120,120,135,0.7)', kind: 'smoke', speed: [20, 60], size: [4, 8] });
        if (this.t > 1.6) { this.attack = null; this.state = 'recover'; this.t = 0; }
        break;
      case 'toll': {
        const n = this.adv ? 2 : 1;
        if (this.spawned < n && this.t >= this.spawned * 0.5) {
          this.spawned++;
          L.hazards.push(new Ring(this.cx - this.facing * 26, this.y + 34, this.elite ? 360 : 330));
          sfx.bell(); L.cam.shake(6);
        }
        if (this.t >= 0.75) { this.state = 'recover'; this.t = 0; }
        break;
      }
      case 'debris':
        if (this.t >= 0.3) { this.state = 'recover'; this.t = 0; }
        break;
    }
  }

  onWall() {
    if (this.state === 'active' && this.atk === 'charge') {
      const L = this.level;
      this.state = 'stun'; this.t = 0; this.attack = null; this.queue = []; this.vx = 0;
      sfx.boom(); sfx.clang(); L.cam.shake(15);
      L.particles.burst(this.cx + this.facing * 40, this.cy, 24, { color: '#5a5a66', kind: 'shard', speed: [100, 360], angle: this.facing > 0 ? Math.PI : 0, spread: 1.3, grav: 1300, size: [2, 6] });
      L.floater(this.cx, this.y - 20, '撞 墙', '#ffd27a', 22);
      for (let i = 0; i < 2; i++) L.hazards.push(new Debris(clamp(this.cx + rand(-200, 200), this.arena.x0 + 24, this.arena.x1 - 24), this.arena.floorY, L, 0.9 + i * 0.2));
    }
  }

  private sweepBox() {
    return this.facing > 0 ? { x: this.cx, y: this.bottom - 100, w: 200, h: 100 } : { x: this.cx - 200, y: this.bottom - 100, w: 200, h: 100 };
  }

  // ---------------- 绘制 ----------------
  draw(ctx: CanvasRenderingContext2D) {
    const L = this.level;
    if (this.dead && this.deadT > 2.6) return;
    // 跃击落点预警
    if (this.state === 'leap') {
      const fx = this.cx, fy = this.arena.floorY;
      const k = this.leapStage === 'rise' ? 0.3 : 1;
      addGlow(ctx, fx, fy - 2, 110, '255,110,80', 0.25 * k);
      ctx.fillStyle = `rgba(255,140,100,${0.35 * k})`; ctx.fillRect(fx - 100, fy - 2, 200, 2);
    }
    const m = this.model;
    m.draw(ctx, {
      x: this.cx, y: this.bottom, facing: this.facing, state: this.state, atk: this.atk, t: this.t,
      hammer: this.hammer, bellGlow: this.bellGlow, phase: this.phase, elite: this.elite,
      leapStage: this.leapStage, vx: this.vx, vy: this.vy, flash: this.flash > 0,
      dead: this.dead, deadT: this.deadT, time: L.time,
    });
    // 出招闪光
    const W = this.windTime();
    if (this.state === 'windup' && this.t > W - 0.2 && this.atk !== 'leap') {
      const k = (this.t - (W - 0.2)) / 0.2;
      const g = this.atk === 'charge' ? m.eye : this.atk === 'toll' ? m.bellPt : m.tip;
      glint(ctx, g.x, g.y, 14 + k * 8, 0.6 + k * 0.4);
    }
    if (this.state === 'leap' && this.leapStage === 'hover') glint(ctx, m.tip.x, m.tip.y, 20, 1);
    if (this.state === 'stun' || this.state === 'stagger') {
      for (let i = 0; i < 3; i++) { const an = L.time * 5 + i * 2.1; ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(m.eye.x + Math.cos(an) * 22, m.eye.y - 18 + Math.sin(an) * 6, 2.6, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}
