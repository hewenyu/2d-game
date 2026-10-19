// 单个关卡的运行时：地图、实体、战斗结算、镜头与绘制。
import { CAM_ZOOM, CAM_ZOOM_BOSS, TILE, VIEW_H, VIEW_W } from '../config';
import { Camera } from '../core/camera';
import { input } from '../core/input';
import { clamp, overlap, rand } from '../core/math';
import { quality } from '../core/quality';
import { sfx } from '../core/audio';
import type { LevelConfig } from '../data/chapters';
import { Blade } from '../entities/blade';
import { Bellkeeper } from '../entities/bosses/bellkeeper';
import type { Enemy } from '../entities/enemy';
import { Guard } from '../entities/enemies/guard';
import { Moth } from '../entities/enemies/moth';
import { Pilgrim } from '../entities/enemies/pilgrim';
import type { Hazard } from '../entities/hazards';
import { Player, type PlayerStats } from '../entities/player';
import { Cache, DeathDrop, drawImpact, EmberOrb, Floater, Shrine, SlashFx, Stele } from '../entities/props';
import { STELES } from '../data/lore';
import { Background, chain } from '../render/background';
import { addGlow, text } from '../render/draw';
import { Particles } from '../render/particles';
import { TerrainRenderer } from '../render/terrain';
import type { Biome } from '../world/biomes';
import { generateLevel, type LevelData } from '../world/levelgen';
import { T, TileMap } from '../world/tilemap';
import type { Game } from './game';

export class Level {
  readonly data: LevelData;
  readonly map: TileMap;
  terrain: TerrainRenderer;
  readonly bg: Background;
  readonly cam = new Camera();
  readonly particles = new Particles();
  readonly player: Player;
  readonly blade: Blade;
  enemies: Enemy[] = [];
  boss: Bellkeeper | null = null;
  hazards: Hazard[] = [];
  orbs: EmberOrb[] = [];
  shrines: Shrine[] = [];
  caches: Cache[] = [];
  steles: Stele[] = [];
  slashes: SlashFx[] = [];
  floaters: Floater[] = [];
  deathDrop: DeathDrop | null = null;
  time = 0;
  bossActive = false;
  bossDone = false;
  private pitTimer = -1;
  private hitCounter = 1;
  private landedId = -1;
  /** 出口光尘的生成计时器：按 dt 累积，与帧率无关 */
  private exitFx = 0;

  constructor(
    readonly game: Game,
    readonly depth: number,
    readonly cfg: LevelConfig,
    readonly chapterName: string,
    readonly biome: Biome,
    seed: number,
    stats: PlayerStats,
  ) {
    this.data = generateLevel(cfg, seed);
    this.map = this.data.map;
    this.terrain = new TerrainRenderer(this.map, biome);
    this.bg = new Background(this.map.pxW, this.map.pxH, biome, seed);
    this.cam.bounds = { x0: 0, y0: 0, x1: this.map.pxW, y1: this.map.pxH };
    this.shrines = this.data.shrines.map((s, i) => new Shrine(s.x, s.y, i, i === 0));
    this.caches = this.data.caches.map((c) => new Cache(this, c.x, c.y));
    const texts = STELES[depth] ?? [];
    this.steles = this.data.steles.slice(0, texts.length).map((p, i) => new Stele(p.x, p.y, texts[i]));
    this.player = new Player(this, this.data.start.x, this.data.start.y, stats);
    this.blade = new Blade(this);
    this.spawnEnemies();
    this.cam.targetZoom = CAM_ZOOM;
    this.cam.snap(this.player.cx, this.player.cy);
  }

  // ---------- 生成 / 重置 ----------
  private spawnEnemies() {
    const hs = this.cfg.hpScale ?? 1;
    this.enemies = this.data.spawns.map((s) => {
      if (s.kind === 'guard') return new Guard(this, s.x, s.y, hs);
      if (s.kind === 'moth') return new Moth(this, s.x, s.y, hs);
      return new Pilgrim(this, s.x, s.y, hs);
    });
    this.boss = this.data.arena && this.cfg.boss ? new Bellkeeper(this, this.data.arena, !!this.cfg.elite, hs) : null;
    if (this.bossDone && this.boss) { this.boss.dead = true; this.boss.remove = true; }
  }

  /** 死亡后在灯龛重生：敌人复活，Boss 复原，掉落物保留 */
  respawnAt(shrineIdx: number, stats: PlayerStats) {
    const s = this.shrines[Math.min(shrineIdx, this.shrines.length - 1)];
    this.player.dead = false; this.player.deadT = 0;
    this.player.stats = stats;
    this.player.hp = stats.maxHp; this.player.flasks = stats.maxFlasks;
    this.player.invuln = 1; this.player.hurtT = 0; this.player.healT = -1; this.player.attackT = -1; this.player.dashT = 0; this.player.trail = [];
    this.player.place(s.x + 34, s.y);
    this.blade.reset();
    this.hazards = []; this.orbs = []; this.slashes = [];
    this.map.gateClosed = false;
    this.bossActive = false;
    this.spawnEnemies();
    this.cam.targetZoom = CAM_ZOOM;
    this.cam.bounds = { x0: 0, y0: 0, x1: this.map.pxW, y1: this.map.pxH };
    this.cam.snap(this.player.cx, this.player.cy);
  }

  /** 休憩：回满并让敌人复活 */
  rest(stats: PlayerStats) {
    this.player.stats = stats;
    this.player.hp = stats.maxHp; this.player.flasks = stats.maxFlasks;
    this.hazards = [];
    this.spawnEnemies();
  }

  // ---------- 工具 ----------
  newHitId() { return this.hitCounter++; }
  targets(): Enemy[] {
    const t = this.enemies.filter((e) => e.alive);
    if (this.boss && this.bossActive && this.boss.alive) t.push(this.boss);
    return t;
  }
  hitstop(t: number) { this.game.hitstop = Math.max(this.game.hitstop, t); }
  /** 命中瞬间的闪光（顿帧期间照常播放） */
  impacts: { x: number; y: number; a: number; t: number; big: boolean }[] = [];
  impact(x: number, y: number, a: number, big = false) { this.impacts.push({ x, y, a, t: 0, big }); }
  /** 顿帧期间：世界停住，但震屏、粒子、命中闪光、受击抖动照常走——这样停顿读作「打实了」而不是「卡了」 */
  updateFrozen(dt: number) {
    this.cam.tickShake(dt);
    this.particles.update(dt);
    for (const f of this.impacts) f.t += dt;
    this.impacts = this.impacts.filter((f) => f.t < 0.12);
    for (const e of this.enemies) e.hitShake = Math.max(0, e.hitShake - dt);
    if (this.boss) this.boss.hitShake = Math.max(0, this.boss.hitShake - dt);
  }
  toast(s: string) { this.game.toast(s); }
  banner(title: string, sub = '') { this.game.showBanner(title, sub); }
  floater(x: number, y: number, s: string, color = '#e9e3d3', size = 14) { this.floaters.push(new Floater(x, y, s, color, size)); }
  alert(e: Enemy) { this.floater(e.cx, e.y - 10, '!', '#ff7a4a', 18); }
  sparks(x: number, y: number, color: string, n: number) {
    this.particles.burst(x, y, n, { color, kind: 'streak', speed: [180, 520], life: [0.12, 0.3], size: [1.2, 2.2], add: true, drag: 5 });
  }
  inkBurst(x: number, y: number, dir: number, n: number) {
    const ang = dir > 0 ? 0 : Math.PI;
    this.particles.burst(x, y, n, { color: '#07070a', kind: 'shard', speed: [120, 380], angle: ang, spread: 0.9, grav: 1200, life: [0.35, 0.7], size: [2, 5] });
    this.particles.burst(x, y, Math.ceil(n * 0.6), { color: '#ff9a4a', kind: 'streak', speed: [150, 420], angle: ang, spread: 0.7, life: [0.1, 0.25], size: [1, 2], add: true });
  }
  spawnSlash(dir: 'side' | 'up' | 'down') { this.slashes.push(new SlashFx(dir, this.player.facing)); }
  recallSlashFx(x: number, y: number, a: number) {
    this.particles.burst(x, y, 16, { color: '#ffd890', kind: 'streak', speed: [300, 700], angle: a, spread: 0.25, life: [0.15, 0.3], size: [1.5, 3], add: true });
    this.particles.ring(x, y, 8, 50, 'rgba(255,220,150,0.9)', 0.25, 3);
  }
  onBlocked(e: Enemy, x: number, y: number) {
    sfx.clang();
    this.sparks(x, y, '#ffe3a0', 12);
    this.floater(e.cx, e.y - 12, '挡', '#c9ccd6', 15);
    this.impact(x, y, this.player.facing > 0 ? 0 : Math.PI);
    this.hitstop(0.06);
    this.cam.kick(-this.player.facing * 3, 0);
  }
  dropEmbers(x: number, y: number, total: number) {
    let left = total;
    while (left > 0) { const v = Math.min(left, left > 20 ? 5 : left > 6 ? 2 : 1); this.orbs.push(new EmberOrb(x + rand(-6, 6), y + rand(-6, 6), v)); left -= v; }
  }
  onEnemyKilled(e: Enemy) {
    this.dropEmbers(e.cx, e.cy, e.embers);
    this.particles.burst(e.cx, e.cy, 10, { color: 'rgba(225,235,255,0.8)', kind: 'wisp', speed: [20, 80], angle: -Math.PI / 2, spread: 0.8, grav: -120, life: [0.6, 1.2], size: [2, 4], add: true });
    const dir = Math.sign(e.cx - this.player.cx) || 1;
    this.inkBurst(e.cx, e.cy, dir, 20);
    this.impact(e.cx, e.cy, dir > 0 ? 0 : Math.PI, true);
    this.hitstop(0.1);
    this.cam.shake(6);
    this.cam.kick(-dir * 6, -2);
  }
  onBossKilled(b: Bellkeeper) {
    this.bossDone = true;
    this.hazards = [];
    this.game.onBossKilled(b);
    this.dropEmbers(b.cx, b.cy, b.embers);
    this.particles.burst(b.cx, b.cy, 60, { color: 'rgba(255,230,200,0.9)', kind: 'wisp', speed: [40, 260], grav: -80, life: [1, 2], size: [2, 5], add: true });
    this.pitTimer = this.game.isFinalLevel() ? 6.5 : 3.2; // 最终战留出残响的遗言
  }
  onPlayerHurt() {
    this.hitstop(0.1);
    this.cam.shake(9);
    this.game.flashRed = 0.5;
    sfx.hurt();
    const p = this.player;
    this.particles.burst(p.cx, p.cy, 16, { color: '#07070a', kind: 'shard', speed: [120, 340], grav: 1200, life: [0.4, 0.8], size: [2, 5] });
    this.particles.burst(p.cx, p.cy, 10, { color: '#ffffff', kind: 'streak', speed: [200, 500], life: [0.1, 0.25], add: true });
  }
  onPlayerDeath() { this.game.onPlayerDeath(); }

  playerSpiked() {
    const p = this.player;
    if (p.dead) return;
    p.hurt(1, p.cx, 'spike', p.invuln <= 0);
    if (p.dead) return;
    this.game.flashBlack = 0.45;
    p.x = p.safeX; p.y = p.safeY; p.vx = 0; p.vy = 0;
    p.invuln = Math.max(p.invuln, 0.9);
    p.hurtT = 0;
  }
  playerFellOut() {
    if ((this.data.exitX !== null || this.bossDone) && !this.player.dead) { this.game.nextLevel(); return; }
    this.playerSpiked();
  }

  // ---------- 更新 ----------
  update(dt: number) {
    this.time += dt;
    const p = this.player;
    p.update(dt);
    this.blade.update(dt);

    // 出口的深渊光尘：以前在 draw() 里按「每次绘制 30% 概率」生成，暂停/阅读/死亡等
    // 只画不更新的状态下会无限堆积。现在按 dt 生成，速率与帧率无关。
    if (this.data.exitX !== null && this.data.exitY !== null) {
      this.exitFx += dt * 18;
      while (this.exitFx >= 1) { this.exitFx -= 1; this.spawnExitMote(); }
    }

    // 灯龛
    for (const s of this.shrines) {
      if (!s.near(this) || p.dead) continue;
      if (!s.lit) {
        s.lit = true; sfx.shrine();
        this.game.lightShrine(s.idx);
        this.banner('灯 火 已 燃', '死后将于此重燃 · 按 ↑ 休憩');
        this.particles.ring(s.x, s.y - 30, 10, 120, 'rgba(255,200,130,0.8)', 0.8, 3);
      }
      if (p.onGround && input.consume('interact', 0.12) && p.attackT < 0) this.game.openRest(s.idx);
    }

    // 碑文
    for (const s of this.steles) {
      if (!s.near(this) || p.dead || !p.onGround) continue;
      if (input.consume('interact', 0.12) && p.attackT < 0) { s.read = true; this.game.openRead(s.text); }
    }

    // Boss 入场
    const arena = this.data.arena;
    if (arena && this.boss && !this.bossActive && !this.bossDone && p.y > arena.y0 + 10 && !p.dead) {
      this.bossActive = true;
      this.map.gateClosed = true;
      this.boss.wake();
      this.cam.targetZoom = CAM_ZOOM_BOSS;
      // 镜头锁定在竞技场内（左右墙各露一格）
      this.cam.bounds = { x0: arena.x0 - TILE, y0: 0, x1: arena.x1 + TILE, y1: this.map.pxH };
      this.game.onBossStart(this.boss);
    }

    for (const f of this.impacts) f.t += dt;
    this.impacts = this.impacts.filter((f) => f.t < 0.12);
    for (const e of this.enemies) e.tick(dt);
    this.enemies = this.enemies.filter((e) => !e.remove);
    if (this.boss && this.bossActive) this.boss.tick(dt);

    this.resolveCombat();

    for (const h of this.hazards) h.update(dt, this);
    this.hazards = this.hazards.filter((h) => !h.dead);
    for (const o of this.orbs) o.update(dt, this);
    this.orbs = this.orbs.filter((o) => !o.dead);
    for (const c of this.caches) c.update(dt);
    this.deathDrop?.update(this);
    this.particles.update(dt);
    for (const s of this.slashes) s.t += dt;
    this.slashes = this.slashes.filter((s) => !s.dead);
    for (const f of this.floaters) { f.life -= dt; f.y -= 26 * dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    // Boss 死后打开深渊
    if (this.pitTimer > 0) {
      this.pitTimer -= dt;
      if (this.pitTimer <= 0 && arena) {
        if (this.game.isFinalLevel()) this.game.victory();
        else {
          for (let ty = arena.pit.ty0; ty <= arena.pit.ty1; ty++) for (let tx = arena.pit.tx0; tx <= arena.pit.tx1; tx++) this.map.set(tx, ty, T.Empty);
          this.terrainDirty();
          sfx.descend();
          this.banner('深 渊 洞 开', '向下，继续向下');
          this.cam.shake(8);
        }
      }
    }

    // 镜头
    let tx = p.cx + p.facing * 50, ty = p.cy - 30 + clamp(p.vy, -200, 600) * 0.12;
    if (this.boss && this.bossActive && this.boss.alive) { tx = tx * 0.7 + this.boss.cx * 0.3; ty = ty * 0.8 + this.boss.cy * 0.2; }
    this.cam.update(dt, tx, ty);
  }

  private terrainDirty() {
    this.terrain = new TerrainRenderer(this.map, this.biome);
  }

  private resolveCombat() {
    const p = this.player;
    if (p.dead) return;
    // 玩家斩击
    if (p.attackActive()) {
      const box = p.attackBox(), id = p.attackId;
      let landed = false, blocked = false;
      for (const e of this.targets()) {
        if (!overlap(box, e.rect())) continue;
        const res = e.takeHit({ dmg: p.stats.slashDmg, poise: 12, kind: p.attackDir === 'down' ? 'pogo' : 'slash', x: p.cx, y: p.attackDir === 'down' ? p.y - 20 : p.cy, id });
        if (res === 'hit' || res === 'kill' || res === 'immune') {
          landed = true;
          if (res === 'hit') {
            const ix = p.attackDir === 'side' ? (p.facing > 0 ? Math.max(box.x, e.x) : Math.min(box.x + box.w, e.x + e.w)) : e.cx;
            const iy = p.attackDir === 'up' ? e.y + e.h * 0.7 : p.attackDir === 'down' ? e.y + 6 : e.cy - 4;
            this.impact(ix, iy, p.attackDir === 'up' ? -Math.PI / 2 : p.attackDir === 'down' ? Math.PI / 2 : p.facing > 0 ? 0 : Math.PI);
          }
        }
        else if (res === 'blocked') { blocked = true; this.onBlocked(e, (box.x + box.w / 2 + e.cx) / 2, e.cy - 6); }
      }
      for (const c of this.caches) if (!c.broken && overlap(box, c.rect())) { c.break(); landed = true; }
      if (p.attackDir === 'down') {
        const cx = Math.floor((box.x + box.w / 2) / TILE);
        for (let yy = box.y; yy < box.y + box.h; yy += 16) if (this.map.get(cx, Math.floor(yy / TILE)) === T.Spike) { landed = true; this.sparks(box.x + box.w / 2, yy, '#e6ebf5', 6); break; }
      }
      if ((landed || blocked) && this.landedId !== id) {
        this.landedId = id;
        p.onAttackLanded(blocked && !landed);
        if (landed) {
          sfx.hit(); this.hitstop(0.065); this.cam.shake(3.5);
          const kd = p.attackDir === 'side' ? [p.facing * 4, 0] : p.attackDir === 'up' ? [0, -4] : [0, 4];
          this.cam.kick(-kd[0], -kd[1]);
        }
      }
    }
    // 敌人攻击 / 碰撞伤害
    for (const e of this.targets()) {
      if (e.attack && !e.attack.hit && overlap(e.attack.box, p.rect())) {
        e.attack.hit = true;
        p.hurt(e.attack.dmg, e.cx, e.attack.cause);
        if (p.dead) return;
      }
      if (e.contact > 0) {
        const r = e.rect(), inset = { x: r.x + 6, y: r.y + 6, w: r.w - 12, h: r.h - 8 };
        if (overlap(inset, p.rect())) p.hurt(e.contact, e.cx, e.kind);
        if (p.dead) return;
      }
    }
  }

  // ---------- 绘制 ----------
  draw(ctx: CanvasRenderingContext2D) {
    const cam = this.cam, b = this.biome;
    this.bg.drawBack(ctx, cam, this.time);
    cam.begin(ctx);
    // 吊灯与链条（在地形之后不会被遮挡的背景装饰）
    for (const l of this.data.lanterns) {
      if (!cam.visible(l.x - 60, l.y - 60, 120, 200)) continue;
      chain(ctx, l.x, l.y - 4, 60, 'rgba(20,24,32,0.9)', 4);
      addGlow(ctx, l.x, l.y + 66, 90, '255,170,90', 0.16 + 0.03 * Math.sin(this.time * 7 + l.x));
      ctx.fillStyle = '#1b1712'; ctx.fillRect(l.x - 5, l.y + 56, 10, 14);
      ctx.fillStyle = '#ffc77a'; ctx.fillRect(l.x - 3, l.y + 59, 6, 8);
    }
    for (const c of this.data.chains) if (cam.visible(c.x - 10, c.y, 20, c.len)) chain(ctx, c.x, c.y, c.len, c.heavy ? 'rgba(70,52,34,0.95)' : 'rgba(12,15,22,0.95)', c.heavy ? 8 : 5);
    // 出口：深渊透出的光
    if (this.data.exitX !== null && this.data.exitY !== null) {
      const ex = this.data.exitX, ey = this.data.exitY;
      addGlow(ctx, ex, ey + 40, 200, b.light, 0.18 + 0.05 * Math.sin(this.time * 2));
    }
    this.terrain.draw(ctx, cam);
    if (this.data.arena) this.drawGate(ctx);
    for (const s of this.shrines) if (cam.visible(s.x - 100, s.y - 120, 200, 140)) s.draw(ctx, this);
    for (const c of this.caches) if (cam.visible(c.x - 30, c.y - 40, 60, 50)) c.draw(ctx, this);
    for (const s of this.steles) if (cam.visible(s.x - 40, s.y - 100, 80, 110)) s.draw(ctx, this);
    this.deathDrop?.draw(ctx, this);
    for (const h of this.hazards) h.draw(ctx, this);
    for (const e of this.enemies) if (cam.visible(e.x, e.y, e.w, e.h, 120)) this.drawShaken(ctx, e);
    if (this.boss && (this.bossActive || this.boss.state === 'dormant')) this.drawShaken(ctx, this.boss);
    for (const o of this.orbs) o.draw(ctx, this);
    this.player.draw(ctx);
    this.blade.draw(ctx);
    for (const s of this.slashes) s.draw(ctx, this.player.cx, this.player.cy);
    this.particles.draw(ctx);
    for (const f of this.impacts) drawImpact(ctx, f);
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      text(ctx, f.text, f.x + 1, f.y + 1, f.size, 'rgba(0,0,0,0.8)', 'center', 'bold');
      text(ctx, f.text, f.x, f.y, f.size, f.color, 'center', 'bold');
    }
    ctx.globalAlpha = 1;
    cam.end(ctx);
    this.bg.drawFront(ctx, cam, this.time);
    // 暗角与色调（两次全屏填充，低画质档位下省略）
    if (quality.postFx) {
      const p = cam.toScreen(this.player.cx, this.player.cy);
      const g = ctx.createRadialGradient(p.x, p.y, 140, VIEW_W / 2, VIEW_H / 2, 640);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = `rgba(${b.grade},0.12)`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  /** 出口光尘：一粒向上飘的加色光点 */
  private spawnExitMote() {
    const ex = this.data.exitX!, ey = this.data.exitY!;
    this.particles.spawn({
      x: ex + rand(-90, 90), y: ey + 40, vy: -rand(40, 110), life: 1.4,
      color: `rgba(${this.biome.light},0.8)`, add: true, size: 2, drag: 0.5,
    });
  }

  /** 受击的敌人在顿帧里沿受击方向高频抖动，抖幅随时间衰减 */
  private drawShaken(ctx: CanvasRenderingContext2D, e: Enemy) {
    if (e.hitShake <= 0) { e.draw(ctx); return; }
    const k = e.hitShake / 0.16;
    ctx.save();
    ctx.translate(Math.sin(e.hitShake * 260) * 2.6 * k * (e.heavy ? 0.6 : 1), 0);
    e.draw(ctx);
    ctx.restore();
  }

  private drawGate(ctx: CanvasRenderingContext2D) {
    const a = this.data.arena!;
    for (const g of a.gate) {
      const x = g.tx * TILE, y = g.ty * TILE;
      if (this.map.gateClosed) {
        addGlow(ctx, x + 16, y + 16, 40, '255,90,60', 0.25);
        ctx.fillStyle = '#0a0a0e'; ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,120,90,0.7)'; ctx.lineWidth = 2;
        for (let i = 4; i < TILE; i += 9) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + TILE); ctx.stroke(); }
      }
    }
  }
}
