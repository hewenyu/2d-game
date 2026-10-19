// 符蛾：烧剩的镇魂符折成的蛾。盘旋，收翅、符文亮起后俯冲。俯冲路线在亮起时锁定，侧移即可躲开。
import { approach, clamp } from '../../core/math';
import { sfx } from '../../core/audio';
import type { Level } from '../../game/level';
import { MothModel } from '../../render/models/moth';
import { Enemy } from '../enemy';

const WIND = 0.62;

export class Moth extends Enemy {
  readonly kind = 'moth';
  readonly displayName = '符蛾';
  private seed = Math.floor(Math.random() * 1000);
  private model = new MothModel(this.seed);
  private cd = 1;
  private ph = Math.random() * 6;
  private dvx = 0; private dvy = 0;
  private lockX = 0; private lockY = 0;

  constructor(level: Level, x: number, y: number, hpScale: number) {
    super(level, x, y + 40, 26, 22, Math.round(18 * hpScale), 10);
    this.flying = true;
    this.embers = 3;
  }

  onWall() { if (this.state === 'dive') this.endDive(); }

  private endDive() { this.state = 'recover'; this.t = 0; this.attack = null; this.contact = 0; }

  update(dt: number) {
    const s = this.sense();
    this.ph += dt;
    switch (this.state) {
      case 'idle': {
        const tx = this.spawnX + Math.sin(this.ph * 0.7) * 40, ty = this.spawnY - 40 + Math.sin(this.ph * 1.3) * 14;
        this.vx = approach(this.vx, (tx - this.cx) * 2, 300 * dt);
        this.vy = approach(this.vy, (ty - this.cy) * 2, 300 * dt);
        if (!s.pdead && s.adx < 340 && s.ady < 240) { this.state = 'track'; this.level.alert(this); }
        break;
      }
      case 'track': {
        if (s.pdead || s.adx > 560 || s.ady > 400) { this.state = 'idle'; break; }
        this.facing = s.dir;
        const p = this.player;
        const tx = p.cx - s.dir * 130, ty = p.cy - 120 + Math.sin(this.ph * 2) * 16;
        this.vx = approach(this.vx, clamp((tx - this.cx) * 2.4, -170, 170), 500 * dt);
        this.vy = approach(this.vy, clamp((ty - this.cy) * 2.4, -170, 170), 500 * dt);
        this.cd -= dt;
        if (this.cd <= 0 && s.adx < 240) { this.state = 'windup'; this.t = 0; sfx.moth(); }
        break;
      }
      case 'windup': {
        this.vx = approach(this.vx, 0, 600 * dt);
        this.vy = approach(this.vy, -30, 600 * dt);
        const p = this.player;
        if (this.t < WIND - 0.2) { this.lockX = p.cx; this.lockY = p.cy; this.facing = s.dir; }
        if (this.t >= WIND) {
          const dx = this.lockX - this.cx, dy = this.lockY - this.cy, d = Math.hypot(dx, dy) || 1;
          this.dvx = dx / d * 560; this.dvy = dy / d * 560;
          this.state = 'dive'; this.t = 0; this.contact = 1;
          this.attack = { box: this.rect(), dmg: 1, id: this.level.newHitId(), cause: 'moth', hit: false };
          sfx.dash();
        }
        break;
      }
      case 'dive':
        this.vx = this.dvx; this.vy = this.dvy;
        if (this.attack) this.attack.box = this.rect();
        if (this.t > 0.6 || this.level.map.solidAt(this.cx + this.dvx * 0.03, this.cy + this.dvy * 0.03)) this.endDive();
        break;
      case 'recover':
        this.vx = approach(this.vx, 0, 900 * dt);
        this.vy = approach(this.vy, -90, 700 * dt);
        if (this.t > 0.9) { this.state = 'track'; this.cd = 1.2 + Math.random() * 0.8; }
        break;
      case 'stagger':
        this.vx = approach(this.vx, 0, 900 * dt);
        this.vy = approach(this.vy, 120, 900 * dt);
        if (this.t > 0.6) { this.state = 'track'; this.cd = 0.8; }
        break;
    }
    this.physics(dt);
  }

  onStagger() { super.onStagger(); this.contact = 0; }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead && this.deadT > 0.6) return;
    this.model.draw(ctx, {
      x: this.cx, y: this.cy, facing: this.facing, state: this.state, t: this.t, wind: WIND,
      ph: this.ph, dvx: this.dvx, dvy: this.dvy, flash: this.flash > 0, dead: this.dead, deadT: this.deadT,
      time: this.level.time, seed: this.seed,
    });
  }
}
