// 钟卫：背负铜盾的重甲守卫。正面挡下斩击与飞刃，转身很慢。
// 应对：从头顶下劈、绕到背后，或让召回的刃从背后穿过。
import { approach, rand } from '../../core/math';
import { sfx } from '../../core/audio';
import type { Level } from '../../game/level';
import { GuardianModel } from '../../render/models/guardian';
import { Enemy } from '../enemy';
import type { HitInfo } from '../types';

const WIND = 0.78;

export class Guard extends Enemy {
  readonly kind = 'guard';
  readonly displayName = '钟卫';
  private model = new GuardianModel();
  private seed = Math.random() * 10;
  private cd = 0.8;
  private behindT = 0;
  private glinted = false;
  private walk = 0;

  constructor(level: Level, x: number, y: number, hpScale: number) {
    super(level, x, y, 34, 50, Math.round(60 * hpScale), 30);
    this.embers = 9;
  }

  blocks(h: HitInfo): boolean {
    if (this.state === 'stagger' || this.state === 'turn') return false;
    if (h.kind === 'pogo' || h.y < this.y - 4) return false; // 头顶无防
    return (h.x - this.cx) * this.facing > 0;
  }
  armored() { return this.state === 'windup' || this.state === 'bash'; }

  update(dt: number) {
    const s = this.sense();
    switch (this.state) {
      case 'idle':
        this.vx = approach(this.vx, 0, 600 * dt);
        if (!s.pdead && s.adx < 320 && s.ady < 100) { this.state = 'chase'; this.level.alert(this); }
        break;
      case 'chase': {
        if (s.pdead || s.adx > 480 || s.ady > 240) { this.state = 'idle'; break; }
        if (s.dir !== this.facing) { this.behindT += dt; if (this.behindT > 0.55) { this.state = 'turn'; this.t = 0; } }
        else this.behindT = 0;
        const want = s.adx > 100 && this.groundAhead(this.facing) && s.dir === this.facing ? this.facing * 55 : 0;
        this.vx = approach(this.vx, want, 500 * dt);
        this.cd -= dt;
        if (s.adx < 190 && s.ady < 60 && this.cd <= 0 && s.dir === this.facing) { this.state = 'windup'; this.t = 0; this.glinted = false; sfx.warn(); }
        break;
      }
      case 'turn':
        this.vx = 0;
        if (this.t >= 0.35) { this.facing = s.dir; this.behindT = 0; this.state = 'chase'; this.cd = Math.max(this.cd, 0.4); }
        break;
      case 'windup':
        this.vx = approach(this.vx, -this.facing * 30, 600 * dt);
        if (!this.glinted && this.t > WIND - 0.18) { this.glinted = true; sfx.glint(); }
        if (this.t >= WIND) {
          this.state = 'bash'; this.t = 0;
          this.attack = { box: this.rect(), dmg: 1, id: this.level.newHitId(), cause: 'guard', hit: false, knock: 420 };
          sfx.dash();
        }
        break;
      case 'bash':
        this.vx = this.groundAhead(this.facing) ? this.facing * 430 : 0;
        if (this.attack) this.attack.box = { x: this.facing > 0 ? this.cx : this.x - 10, y: this.y, w: this.w / 2 + 10, h: this.h };
        if (this.t >= 0.4) { this.state = 'recover'; this.t = 0; this.attack = null; }
        break;
      case 'recover':
        this.vx = approach(this.vx, 0, 1600 * dt);
        if (this.t >= 1.15) { this.state = 'chase'; this.cd = rand(0.9, 1.5); }
        break;
      case 'stagger':
        this.vx = approach(this.vx, 0, 1500 * dt);
        if (this.t >= 1.3) { this.state = 'chase'; this.cd = 0.5; }
        break;
    }
    this.walk += Math.abs(this.vx) * dt * 0.05;
    this.physics(dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead && this.deadT > 1) return;
    this.model.draw(ctx, {
      x: this.cx, y: this.bottom, facing: this.facing, state: this.state, t: this.t, wind: WIND,
      walk: this.walk, vx: this.vx, flash: this.flash > 0, dead: this.dead, deadT: this.deadT,
      time: this.level.time, seed: this.seed,
    });
  }
}
