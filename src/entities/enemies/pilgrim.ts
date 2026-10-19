// 失声僧：头罩铜钟的僧人，持月牙铲。举铲时有霸体，劈空后铲刃卡地，有长硬直。
import { approach, rand } from '../../core/math';
import { sfx } from '../../core/audio';
import type { Level } from '../../game/level';
import { MonkModel } from '../../render/models/monk';
import { Enemy } from '../enemy';

const WIND = 0.56;

export class Pilgrim extends Enemy {
  readonly kind = 'pilgrim';
  readonly displayName = '失声僧';
  private model = new MonkModel();
  private seed = Math.random() * 10;
  private cd = 0.4;
  private glinted = false;
  private walk = 0;

  constructor(level: Level, x: number, y: number, hpScale: number) {
    super(level, x, y, 24, 42, Math.round(30 * hpScale), 18);
    this.embers = 4;
    this.facing = Math.random() < 0.5 ? -1 : 1;
  }

  armored() { return this.state === 'windup' || this.state === 'strike'; }

  onWall() { if (this.state === 'idle') this.facing = this.facing > 0 ? -1 : 1; }

  update(dt: number) {
    const s = this.sense();
    switch (this.state) {
      case 'idle':
        this.vx = approach(this.vx, this.facing * 42, 400 * dt);
        if (!this.groundAhead(this.facing)) { this.facing = this.facing > 0 ? -1 : 1; this.vx = 0; }
        if (!s.pdead && s.adx < 300 && s.ady < 90) { this.state = 'chase'; this.level.alert(this); }
        break;
      case 'chase':
        if (s.pdead || s.adx > 460 || s.ady > 220) { this.state = 'idle'; break; }
        this.facing = s.dir;
        this.vx = approach(this.vx, s.adx > 50 && this.groundAhead(this.facing) ? this.facing * 125 : 0, 900 * dt);
        this.cd -= dt;
        if (s.adx < 84 && s.ady < 56 && this.cd <= 0) { this.state = 'windup'; this.t = 0; this.glinted = false; sfx.warn(); }
        break;
      case 'windup':
        this.vx = approach(this.vx, 0, 1200 * dt);
        if (this.t < 0.22) this.facing = s.dir;
        if (!this.glinted && this.t > WIND - 0.16) { this.glinted = true; sfx.glint(); }
        if (this.t >= WIND) {
          this.state = 'strike'; this.t = 0;
          this.vx = this.facing * (this.groundAhead(this.facing) ? 280 : 0);
          this.attack = { box: this.strikeBox(), dmg: 1, id: this.level.newHitId(), cause: 'pilgrim', hit: false };
          sfx.slash();
        }
        break;
      case 'strike':
        this.vx = approach(this.vx, 0, 1500 * dt);
        if (this.attack) this.attack.box = this.strikeBox();
        if (this.t >= 0.16) { this.state = 'recover'; this.t = 0; this.attack = null; }
        break;
      case 'recover':
        this.vx = approach(this.vx, 0, 1500 * dt);
        if (this.t >= 0.62) { this.state = 'chase'; this.cd = rand(0.4, 1.0); }
        break;
      case 'stagger':
        this.vx = approach(this.vx, 0, 1500 * dt);
        if (this.t >= 0.5) { this.state = 'chase'; this.cd = 0.3; }
        break;
    }
    this.walk += Math.abs(this.vx) * dt * 0.06;
    this.physics(dt);
  }

  private strikeBox() {
    return this.facing > 0 ? { x: this.cx, y: this.y - 4, w: 62, h: this.h } : { x: this.cx - 62, y: this.y - 4, w: 62, h: this.h };
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead && this.deadT > 0.9) return;
    this.model.draw(ctx, {
      x: this.cx, y: this.bottom, facing: this.facing, state: this.state, t: this.t, wind: WIND,
      walk: this.walk, vx: this.vx, flash: this.flash > 0, dead: this.dead, deadT: this.deadT,
      time: this.level.time, seed: this.seed,
    });
  }
}
