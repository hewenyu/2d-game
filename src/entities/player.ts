// 无名剑客：斗笠蓑衣。手中的刃（回锋）以金丝相系，可以掷出，再召回。
import { PHYS, PLAYER_BASE, TILE } from '../config';

const CROUCH_H = 24;
import { input } from '../core/input';
import { approach, clamp, type Rect } from '../core/math';
import { sfx } from '../core/audio';
import type { Level } from '../game/level';
import { moveBody, solidGroundUnder, touchesSpike } from '../world/physics';
import { T } from '../world/tilemap';
import { addGlow } from '../render/draw';
import { WandererModel } from '../render/models/wanderer';

export type AttackDir = 'side' | 'up' | 'down';

export interface PlayerStats { maxHp: number; maxFlasks: number; slashDmg: number; recallDmg: number }

export class Player {
  w = PLAYER_BASE.w;
  h = PLAYER_BASE.h;
  x: number; y: number; vx = 0; vy = 0; onGround = false;
  facing: 1 | -1 = 1;
  hp: number; flasks: number;
  dead = false; deadT = 0;
  cause = '';

  private coyote = 0;
  private jumpBuf = 0;
  private jumping = false;
  private airDash = true;
  dashT = 0;
  private dashCd = 0;
  private dashDir: 1 | -1 = 1;
  attackT = -1;
  attackDir: AttackDir = 'side';
  attackId = 0;
  private attackCd = 0;
  throwT = -1;
  throwAng = 0;
  private model = new WandererModel();
  healT = -1;
  private healed = false;
  hurtT = 0;
  invuln = 0;
  private landSquash = 0;
  private runPhase = 0;
  private dropT = 0;
  safeX: number; safeY: number;
  private safeT = 0;
  trail: { x: number; y: number; f: number; a: number }[] = [];
  private msgCd = 0;
  /** 下蹲：碰撞箱变矮，可以从一格高的缝隙下钻过去 */
  crouch = false;
  private crouchK = 0;

  constructor(private level: Level, cx: number, feetY: number, public stats: PlayerStats) {
    this.x = cx - this.w / 2; this.y = feetY - this.h;
    this.safeX = this.x; this.safeY = this.y;
    this.hp = stats.maxHp; this.flasks = stats.maxFlasks;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }
  rect(): Rect { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  /** 冲刺全程无敌 */
  get iframe() { return this.dashT > 0; }
  /** 刃握在手中的大致位置 */
  get handX() { return this.cx + this.facing * 6; }
  get handY() { return this.bottom - (this.crouch ? 12 : 20); }

  /** 改变碰撞箱高度，脚底不动 */
  private setCrouch(c: boolean) {
    if (c === this.crouch) return;
    const h = c ? CROUCH_H : PLAYER_BASE.h;
    this.y += this.h - h; this.h = h; this.crouch = c;
  }
  /** 头顶是否有空间站起来 */
  private canStand() {
    if (!this.crouch) return true;
    const m = this.level.map, top = this.bottom - PLAYER_BASE.h;
    const x0 = Math.floor((this.x + 1) / TILE), x1 = Math.floor((this.x + this.w - 1) / TILE);
    const y0 = Math.floor(top / TILE), y1 = Math.floor((this.y - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (m.solid(tx, ty)) return false;
    return true;
  }

  place(cx: number, feetY: number) {
    this.crouch = false; this.h = PLAYER_BASE.h;
    this.x = cx - this.w / 2; this.y = feetY - this.h; this.vx = this.vy = 0;
    this.safeX = this.x; this.safeY = this.y;
  }

  attackActive() { return this.attackT >= 0.025 && this.attackT <= 0.13; }
  attackBox(): Rect {
    if (this.attackDir === 'up') return { x: this.cx - 30, y: this.y - 62, w: 60, h: 68 };
    if (this.attackDir === 'down') return { x: this.cx - 28, y: this.bottom - 8, w: 56, h: 62 };
    return this.facing > 0 ? { x: this.x + this.w - 6, y: this.y - 8, w: 68, h: 50 } : { x: this.x - 62, y: this.y - 8, w: 68, h: 50 };
  }

  update(dt: number) {
    const L = this.level;
    this.dashCd -= dt; this.attackCd -= dt; this.invuln -= dt; this.hurtT -= dt; this.dropT -= dt; this.msgCd -= dt; this.jumpBuf -= dt;
    this.landSquash = Math.max(0, this.landSquash - dt * 5);
    this.crouchK = approach(this.crouchK, this.crouch ? 1 : 0, dt * 14);
    for (const t of this.trail) t.a -= dt * 4;
    this.trail = this.trail.filter((t) => t.a > 0);

    if (this.dead) {
      this.deadT += dt;
      this.vx *= Math.exp(-4 * dt);
      this.vy = Math.min(PHYS.maxFall, this.vy + PHYS.gravity * dt);
      moveBody(this, dt, L.map);
      return;
    }

    const mx = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    const up = input.held('up'), down = input.held('down');

    // 召回随时可用
    if (L.blade.away && input.consume('throw')) L.blade.recall();

    if (this.onGround) { this.coyote = PHYS.coyote; this.airDash = true; } else this.coyote -= dt;

    if (this.healT >= 0) {
      this.healT += dt;
      this.vx = approach(this.vx, 0, 2400 * dt);
      if (!this.healed && this.healT >= 0.62) {
        this.healed = true;
        this.hp = Math.min(this.stats.maxHp, this.hp + 2);
        sfx.heal();
        L.particles.burst(this.cx, this.cy, 18, { color: '#ffcf7a', speed: [20, 90], life: [0.5, 1], add: true, grav: -60 });
        L.particles.ring(this.cx, this.cy, 6, 46, 'rgba(255,207,122,0.8)', 0.5, 2);
      }
      if (this.healT >= 0.95) this.healT = -1;
    } else if (this.hurtT > 0) {
      // 受击硬直：无法操作
    } else if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir * PHYS.dashSpeed; this.vy = 0;
      this.trail.push({ x: this.cx, y: this.bottom, f: this.facing, a: 1 });
      if (this.dashT <= 0) this.vx = this.dashDir * PHYS.run * 0.7;
      // 蹲着冲刺 = 滑铲；滑出缝隙后自动站起
      if (this.crouch && !input.held('down') && this.canStand()) this.setCrouch(false);
    } else {
      // 下蹲：地面上按住 ↓。松开后头顶有空间才站起来；蹲着可以慢慢挪动
      if (down && this.onGround && !this.crouch) this.setCrouch(true);
      else if (this.crouch && (!down || !this.onGround) && this.canStand()) this.setCrouch(false);
      const groundAttack = this.attackT >= 0 && this.onGround;
      const target = mx * PHYS.run * (groundAttack ? 0.4 : this.crouch && this.onGround ? 0.45 : 1);
      this.vx = approach(this.vx, target, (this.onGround ? PHYS.accelGround : PHYS.accelAir) * dt);
      if (mx !== 0 && this.attackT < 0) this.facing = mx > 0 ? 1 : -1;

      if (input.consume('jump', PHYS.jumpBuffer)) this.jumpBuf = PHYS.jumpBuffer;
      if (this.jumpBuf > 0) {
        if (down && this.onGround && this.standingOnOneWay()) { this.dropT = 0.22; this.jumpBuf = 0; this.y += 1; }
        else if (this.coyote > 0 && this.canStand()) { this.setCrouch(false); this.doJump(); }
      }
      if (this.jumping && this.vy < 0 && !input.held('jump')) { this.vy *= PHYS.jumpCut; this.jumping = false; }
      if (this.vy >= 0) this.jumping = false;

      if (input.consume('dash', 0.12) && this.dashCd <= 0 && (this.onGround || this.airDash)) this.startDash(mx);
      else if (input.consume('attack', 0.18)) this.startAttack(up, down);
      else if (L.blade.state === 'hand' && input.consume('throw', 0.15)) this.startThrow(mx, up, down);
      else if (input.consume('heal', 0.3)) this.tryHeal();
    }

    if (this.attackT >= 0) { this.attackT += dt; if (this.attackT > 0.27) this.attackT = -1; }
    if (this.throwT >= 0) { this.throwT += dt; if (this.throwT > 0.18) this.throwT = -1; }

    if (this.dashT <= 0) {
      const g = PHYS.gravity * (this.vy > 0 ? 1.12 : 1);
      this.vy = Math.min(PHYS.maxFall, this.vy + g * dt);
    }
    const plat = L.blade.platform();
    const prevVy = this.vy;
    const r = moveBody(this, dt, L.map, plat ? [plat] : [], this.dropT > 0);
    // 站着撞上「下面留了一格缝」的障碍时，提示一次可以蹲过去
    if (r.hitX && this.onGround && !this.crouch && this.attackT < 0) {
      const fx = Math.floor((this.facing > 0 ? this.x + this.w + 2 : this.x - 2) / TILE);
      const feet = Math.floor((this.bottom - 8) / TILE), head = Math.floor((this.bottom - 36) / TILE);
      if (!L.map.solid(fx, feet) && L.map.solid(fx, head)) L.game.hintOnce('crouch', '按住 ↓ 蹲下，可以从缝隙底下钻过去——或者跳过去');
    }
    if (r.landed && prevVy > 250) {
      this.landSquash = Math.min(1, prevVy / 700);
      sfx.land();
      L.particles.burst(this.cx, this.bottom, 6, { color: 'rgba(160,175,200,0.6)', kind: 'smoke', speed: [20, 70], angle: -Math.PI / 2, spread: 1.4, life: [0.3, 0.5], size: [3, 6] });
    }
    if (this.onGround && Math.abs(this.vx) > 40) {
      const before = this.runPhase;
      this.runPhase += Math.abs(this.vx) * dt * 0.055;
      if (Math.floor(before / Math.PI) !== Math.floor(this.runPhase / Math.PI)) sfx.step();
    }
    if (this.onGround && solidGroundUnder(this.rect(), L.map) && this.x > 0 && this.x + this.w < L.map.pxW && this.bottom < L.map.pxH) {
      this.safeT += dt;
      if (this.safeT > 0.15) { this.safeX = this.x; this.safeY = this.y; }
    } else this.safeT = 0;

    if (touchesSpike(this.rect(), L.map)) L.playerSpiked();
    if (this.y > L.map.pxH + 30) L.playerFellOut();
  }

  private standingOnOneWay() {
    const m = this.level.map, ty = Math.floor((this.bottom + 2) / 32);
    const x0 = Math.floor(this.x / 32), x1 = Math.floor((this.x + this.w - 1) / 32);
    let any = false;
    for (let tx = x0; tx <= x1; tx++) { if (m.solid(tx, ty)) return false; if (m.get(tx, ty) === T.OneWay) any = true; }
    return any || !!this.level.blade.platform();
  }

  private doJump() {
    this.vy = -PHYS.jumpV; this.jumping = true; this.coyote = 0; this.jumpBuf = 0; this.onGround = false;
    sfx.jump();
    this.level.particles.burst(this.cx, this.bottom, 4, { color: 'rgba(160,175,200,0.5)', kind: 'smoke', speed: [20, 60], angle: Math.PI / 2, spread: 1.2, life: [0.25, 0.4], size: [2, 5] });
  }

  private startDash(mx: number) {
    this.dashDir = mx !== 0 ? (mx > 0 ? 1 : -1) : this.facing;
    this.facing = this.dashDir;
    this.dashT = PHYS.dashTime; this.dashCd = PHYS.dashCd;
    if (!this.onGround) this.airDash = false;
    this.attackT = -1;
    sfx.dash();
  }

  private startAttack(up: boolean, down: boolean) {
    const L = this.level;
    if (this.attackCd > 0) return;
    if (L.blade.state !== 'hand') {
      if (this.msgCd <= 0) { L.toast('刃不在手 —— 右键 / L 召回'); this.msgCd = 1.5; sfx.deny(); }
      return;
    }
    this.attackDir = up ? 'up' : down && !this.onGround ? 'down' : 'side';
    this.attackT = 0; this.attackCd = 0.33;
    this.attackId = L.newHitId();
    sfx.slash();
    L.spawnSlash(this.attackDir);
  }

  private startThrow(mx: number, up: boolean, down: boolean) {
    const L = this.level;
    let ang: number;
    if (input.aimMouse) {
      const m = L.cam.toWorld(input.mouseX, input.mouseY);
      ang = Math.atan2(m.y - this.handY, m.x - this.handX);
      if (Math.abs(Math.cos(ang)) > 0.05) this.facing = Math.cos(ang) > 0 ? 1 : -1;
    } else if (up) ang = mx !== 0 ? (mx > 0 ? -Math.PI / 4 : -Math.PI * 3 / 4) : -Math.PI / 2;
    else if (down && !this.onGround) ang = mx !== 0 ? (mx > 0 ? Math.PI / 4 : Math.PI * 3 / 4) : Math.PI / 2;
    else ang = this.facing > 0 ? 0 : Math.PI;
    this.throwT = 0; this.throwAng = ang;
    L.blade.throwFrom(this.handX, this.handY, ang);
  }

  private tryHeal() {
    const L = this.level;
    if (!this.onGround) return;
    if (this.flasks <= 0) { L.toast('灯油已尽'); sfx.deny(); return; }
    if (this.hp >= this.stats.maxHp) { L.toast('生命已满'); return; }
    this.flasks--; this.healT = 0; this.healed = false; this.attackT = -1;
    if (this.canStand()) this.setCrouch(false);
  }

  /** 攻击命中后的反馈（下劈弹跳 / 侧斩后坐） */
  onAttackLanded(blocked: boolean) {
    if (this.attackDir === 'down') {
      this.vy = -640; this.airDash = true; this.jumping = false; this.dashCd = 0;
    } else if (this.attackDir === 'side') {
      this.vx = -this.facing * (blocked ? 380 : 150);
    } else if (blocked) this.vy = Math.max(this.vy, 100);
  }

  hurt(dmg: number, fromX: number, cause: string, force = false): boolean {
    const L = this.level;
    if (this.dead || (this.invuln > 0 && !force)) return false;
    if (this.iframe && !force) {
      if (this.trail.length && this.trail[this.trail.length - 1].a > 0.5) {
        L.particles.ring(this.cx, this.cy, 10, 40, 'rgba(220,235,255,0.9)', 0.3, 2);
      }
      return false;
    }
    if (L.game.god) return false;
    this.hp -= dmg; this.cause = cause;
    this.invuln = 1.15; this.hurtT = 0.3;
    const dir = Math.sign(this.cx - fromX) || -this.facing;
    this.vx = dir * 330; this.vy = -360;
    this.healT = -1; this.attackT = -1; this.dashT = 0;
    if (this.canStand()) this.setCrouch(false);
    L.onPlayerHurt();
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deadT = 0; L.onPlayerDeath(); }
    return true;
  }

  // ---------------- 绘制 ----------------
  draw(ctx: CanvasRenderingContext2D) {
    const L = this.level;
    for (const t of this.trail) WandererModel.ghost(ctx, t.x, t.y, t.f, t.a * 0.3);
    if (this.dead && this.deadT > 1.2) return;
    let alpha = 1;
    if (this.invuln > 0 && !this.dead && Math.floor(L.time * 22) % 2 === 0) alpha = 0.45;
    if (this.dead) alpha = Math.max(0, 1 - Math.max(0, this.deadT - 0.6) / 0.6);
    let sx = 1, sy = 1;
    if (!this.onGround && this.dashT <= 0) { const s = clamp(-this.vy / 1700, -0.12, 0.12); sy += s * 0.6; sx -= s * 0.4; }
    sy -= this.landSquash * 0.12; sx += this.landSquash * 0.08;
    if (this.healT >= 0) addGlow(ctx, this.cx, this.cy, 60, '255,190,110', 0.3 * Math.sin(Math.min(1, this.healT / 0.95) * Math.PI));
    this.model.draw(ctx, {
      x: this.cx, y: this.bottom, facing: this.facing, vx: this.vx, vy: this.vy, onGround: this.onGround,
      run: this.runPhase, dashT: this.dashT, attackT: L.blade.state === 'hand' ? this.attackT : -1, attackDir: this.attackDir,
      throwT: this.throwT, throwAng: this.throwAng, healT: this.healT, hurtT: this.hurtT,
      bladeInHand: L.blade.state === 'hand', sx, sy, alpha, dead: this.dead, deadT: this.deadT, time: L.time, crouch: this.crouchK,
    });
  }
}
