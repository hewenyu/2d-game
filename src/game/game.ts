// 游戏状态机：标题 → 关卡（死亡/重生/休憩/暂停）→ 下一层 → 胜利
import { DEBUG_GALLERY, DEBUG_GOD, DEBUG_LEVEL, VIEW_H, VIEW_W } from '../config';
import { Gallery } from './gallery';
import { Camera } from '../core/camera';
import { input } from '../core/input';
import { hashInts } from '../core/rng';
import { setAmbience, sfx, tickAmbience } from '../core/audio';
import { levelAt, TOTAL_LEVELS } from '../data/chapters';
import { BOSS_LORE, CHAPTER_LINES, LEVEL_NAMES, type SteleText } from '../data/lore';
import type { Bellkeeper } from '../entities/bosses/bellkeeper';
import { DeathDrop } from '../entities/props';
import { Background } from '../render/background';
import { BIOMES } from '../world/biomes';
import { drawHUD } from './hud';
import { Level } from './level';
import { drawDeath, drawPause, drawPrologue, drawRead, drawRest, drawTitle, drawVictory } from './screens';
import { defaultSave, parseSave, recordLevelReached, recordVictory, SAVE_KEY, type Save } from './save';
import { noUpgrades, statsFor, UPGRADES, type Owned } from './upgrades';
import { EPILOGUE_T, PROLOGUE_T } from './screens';

export type GameState = 'title' | 'prologue' | 'play' | 'read' | 'dead' | 'rest' | 'pause' | 'victory' | 'gallery';

export interface Run {
  seed: number;
  depth: number;
  embers: number;
  owned: Owned;
  deaths: number;
  time: number;
  drop: { depth: number; x: number; y: number; amount: number } | null;
  respawnIdx: number;
  bossTries: number;
  cause: string;
  /** 从中途开始的练习局，不计入记录 */
  practice: boolean;
}

function loadSave(): Save {
  // getItem 本身在隐私模式下可能抛错，解析容错在 parseSave 里。
  try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return defaultSave(); }
}

export class Game {
  state: GameState = 'title';
  run: Run | null = null;
  level: Level | null = null;
  hitstop = 0;
  slow = 1;
  private slowT = 0;
  flashRed = 0;
  flashBlack = 0;
  flashWhite = 0;
  toastMsg: { s: string; t: number } | null = null;
  bannerMsg: { title: string; sub: string; t: number; dur: number } | null = null;
  /** 屏幕下方逐句出现的台词 */
  lines: { s: string; t: number; dur: number }[] = [];
  reading: SteleText | null = null;
  fade = 0;
  private fadeTarget = 0;
  private fadeCb: (() => void) | null = null;
  god = DEBUG_GOD;
  stateT = 0;
  menuSel = 0;
  restIdx = 0;
  time = 0;
  save: Save = loadSave();
  readonly titleBg = new Background(4200, 1400, BIOMES.crypt, 20251018);
  readonly titleCam = new Camera();
  boss: Bellkeeper | null = null;

  gallery: Gallery | null = DEBUG_GALLERY ? new Gallery() : null;

  constructor() {
    if (this.gallery) this.state = 'gallery';
    this.titleCam.bounds = { x0: 0, y0: 0, x1: 4200, y1: 1400 };
    this.titleCam.snap(600, 700);
  }

  // ---------- 流程 ----------
  startRun(seed = (Math.random() * 2 ** 31) >>> 0, depth = 0) {
    this.fadeCb = null;
    this.lines = [];
    this.run = { seed, depth: Math.max(0, Math.min(TOTAL_LEVELS - 1, depth)), embers: 0, owned: noUpgrades(), deaths: 0, time: 0, drop: null, respawnIdx: 0, bossTries: 0, cause: '', practice: depth > 0 };
    this.loadLevel();
    this.state = 'play';
    this.fade = 1; this.fadeTarget = 0;
  }

  private loadLevel() {
    const run = this.run!;
    const info = levelAt(run.depth)!;
    const biome = BIOMES[info.chapter.biome];
    this.level = new Level(this, run.depth, info.level, info.chapter.name, biome, hashInts(run.seed, run.depth, 77), statsFor(run.owned));
    run.respawnIdx = 0;
    this.boss = null;
    this.syncDrop();
    const name = LEVEL_NAMES[run.depth];
    if (info.levelIdx === 0) this.showBanner(info.chapter.name, CHAPTER_LINES[info.chapterIdx] ?? '', 4.2);
    else this.showBanner(`第 ${run.depth + 1} 层${name ? ' · ' + name : ''}`, info.chapter.name, 3);
    setAmbience('level');
    input.clear();
    if (recordLevelReached(this.save, run)) this.persist();
  }

  private syncDrop() {
    const run = this.run!, L = this.level!;
    L.deathDrop = run.drop && run.drop.depth === run.depth ? new DeathDrop(run.drop.x, run.drop.y, run.drop.amount) : null;
  }

  nextLevel() {
    if (this.fadeCb) return;
    sfx.descend();
    this.fadeTo(1, () => {
      const run = this.run!;
      run.depth++;
      if (run.drop && run.drop.depth < run.depth) run.drop = null;
      if (!levelAt(run.depth)) { this.victory(); return; }
      this.loadLevel();
      this.fadeTo(0, null);
    });
  }

  isFinalLevel() { return !!this.run && this.run.depth >= TOTAL_LEVELS - 1; }

  victory() {
    const run = this.run!;
    this.state = 'victory'; this.stateT = 0;
    setAmbience('none');
    // 练习局不计胜场、最佳时间，也不把 bestDepth 顶到满层（与 README 一致）。
    if (recordVictory(this.save, run, TOTAL_LEVELS)) this.persist();
    this.fade = 0; this.fadeTarget = 0; this.fadeCb = null;
  }

  private persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* 隐私模式 */ } }

  addEmbers(n: number) { if (this.run) this.run.embers += n; }
  recoverDrop() { const r = this.run!; if (r.drop) { r.embers += r.drop.amount; r.drop = null; } }
  lightShrine(idx: number) { if (this.run) this.run.respawnIdx = Math.max(this.run.respawnIdx, idx); }

  onPlayerDeath() {
    const run = this.run!, L = this.level!, p = L.player;
    run.deaths++;
    run.cause = p.cause;
    const inBounds = p.y < L.map.pxH;
    run.drop = run.embers > 0 ? { depth: run.depth, x: inBounds ? p.cx : p.safeX + 10, y: inBounds && p.onGround ? p.bottom : p.safeY + p.h, amount: run.embers } : null;
    run.embers = 0;
    this.slow = 0.35; this.slowT = 0.9;
    setAmbience('none');
    sfx.death();
  }

  respawn() {
    const run = this.run!, L = this.level!;
    L.respawnAt(run.respawnIdx, statsFor(run.owned));
    this.syncDrop();
    this.boss = null;
    this.state = 'play';
    this.slow = 1;
    this.showBanner('灯 火 重 燃', '', 1.6);
    setAmbience('level');
    input.clear();
  }

  onBossStart(b: Bellkeeper) {
    const run = this.run!;
    run.bossTries++;
    this.boss = b;
    const lore = BOSS_LORE[b.elite ? 'elite' : 'normal'];
    this.showBanner(b.displayName, `${lore.epithet}${run.bossTries > 1 ? ` · 第 ${run.bossTries} 次挑战` : ''}`, 2.8);
    if (run.bossTries === 1) this.say(lore.intro, 0.9);
    sfx.bell();
    setAmbience('boss');
  }

  onBossKilled(b: Bellkeeper) {
    this.slow = 0.25; this.slowT = 1.6;
    this.flashWhite = 1;
    this.level?.cam.shake(16);
    sfx.bell(); sfx.boom();
    setAmbience('none');
    this.showBanner('钟 声 止 息', this.isFinalLevel() ? '' : '守钟人倒下了', 3);
    this.say(BOSS_LORE[b.elite ? 'elite' : 'normal'].lastWords, b.elite ? 1.2 : 1.8);
  }

  openRest(idx: number) {
    const run = this.run!;
    run.respawnIdx = Math.max(run.respawnIdx, idx);
    this.restIdx = idx;
    this.level!.rest(statsFor(run.owned));
    this.state = 'rest'; this.menuSel = 0; this.stateT = 0;
    sfx.shrine();
    input.clear();
  }

  // ---------- 提示 ----------
  toast(s: string) { this.toastMsg = { s, t: 0 }; }
  showBanner(title: string, sub = '', dur = 2.4) { this.bannerMsg = { title, sub, t: 0, dur }; }
  /** 排队显示台词：delay 秒后出第一句，每句停留时长按字数算 */
  say(lines: string[], delay = 0) {
    let t = -delay - this.lines.reduce((m, l) => Math.max(m, l.dur - l.t), 0);
    for (const s of lines) { const dur = 1.8 + s.length * 0.12; this.lines.push({ s, t, dur }); t -= dur; }
  }
  private hinted = new Set<string>();
  /** 每个提示每次启动游戏只出现一次 */
  hintOnce(key: string, s: string) { if (this.hinted.has(key)) return; this.hinted.add(key); this.toast(s); }
  openRead(st: SteleText) { this.reading = st; this.state = 'read'; this.stateT = 0; sfx.menu(); input.clear(); }

  private fadeTo(target: number, cb: (() => void) | null) { this.fadeTarget = target; this.fadeCb = cb; }

  // ---------- 更新 ----------
  update(dt: number) {
    this.time += dt;
    this.stateT += dt;
    tickAmbience(dt);
    // 渐变
    if (this.fade !== this.fadeTarget) {
      const sp = dt * 2.4;
      this.fade = this.fade < this.fadeTarget ? Math.min(this.fadeTarget, this.fade + sp) : Math.max(this.fadeTarget, this.fade - sp);
      if (this.fade === this.fadeTarget && this.fadeCb) { const cb = this.fadeCb; this.fadeCb = null; cb(); }
    }
    this.flashRed = Math.max(0, this.flashRed - dt * 1.3);
    this.flashBlack = Math.max(0, this.flashBlack - dt * 1.5);
    this.flashWhite = Math.max(0, this.flashWhite - dt * 0.6);
    if (this.toastMsg) { this.toastMsg.t += dt; if (this.toastMsg.t > 2) this.toastMsg = null; }
    if (this.bannerMsg) { this.bannerMsg.t += dt; if (this.bannerMsg.t > this.bannerMsg.dur) this.bannerMsg = null; }
    if (this.state === 'play' || this.state === 'dead' || this.state === 'victory') {
      for (const l of this.lines) l.t += dt;
      this.lines = this.lines.filter((l) => l.t < l.dur);
    }

    switch (this.state) {
      case 'gallery': {
        const gl = this.gallery!;
        if (input.consume('right')) gl.page = (gl.page + 1) % gl.pages;
        if (input.consume('left')) gl.page = (gl.page + gl.pages - 1) % gl.pages;
        break;
      }
      case 'title': case 'prologue': {
        const t = this.time * 40;
        this.titleCam.update(dt, 600 + (t % 2800), 700 + Math.sin(this.time * 0.2) * 120);
        if (this.state === 'prologue') {
          // 任意确认键跳过；播完自动开始
          if ((this.stateT > 0.4 && (input.consume('confirm') || input.consume('attack') || input.consume('jump') || input.consume('pause'))) || this.stateT > PROLOGUE_T) this.startRun();
          break;
        }
        if (input.consume('confirm') || input.consume('attack') || input.consume('jump')) {
          sfx.menu();
          if (DEBUG_LEVEL > 0) this.startRun(undefined, DEBUG_LEVEL);
          else { this.state = 'prologue'; this.stateT = 0; input.clear(); }
        }
        break;
      }
      case 'read':
        if (this.stateT > 0.25 && (input.consume('confirm') || input.consume('attack') || input.consume('jump') || input.consume('interact') || input.consume('back') || input.consume('pause'))) {
          this.state = 'play'; this.reading = null; input.clear();
        }
        break;
      case 'play': this.updatePlay(dt); break;
      case 'dead':
        if (this.stateT > 0.9 && (input.consume('confirm') || input.consume('attack') || input.consume('jump'))) this.respawn();
        break;
      case 'rest': this.updateRest(); break;
      case 'pause': {
        if (input.consume('up') || input.consume('down')) { this.menuSel = 1 - this.menuSel; sfx.menu(); }
        if (input.consume('pause')) { this.state = 'play'; input.clear(); break; }
        if (input.consume('confirm') || input.consume('attack')) {
          if (this.menuSel === 0) { this.state = 'play'; input.clear(); }
          else { this.state = 'title'; setAmbience('none'); this.level = null; input.clear(); }
        }
        break;
      }
      case 'victory': {
        const go = input.consume('confirm') || input.consume('attack') || input.consume('jump');
        // 尾声中按键：跳到结算；结算后按键：回标题
        if (go && this.stateT < EPILOGUE_T) this.stateT = EPILOGUE_T;
        else if (go && this.stateT > EPILOGUE_T + 1.2) { this.state = 'title'; this.level = null; input.clear(); }
        break;
      }
    }
  }

  private updatePlay(dt: number) {
    const L = this.level!, run = this.run!;
    if (input.consume('pause')) { this.state = 'pause'; this.menuSel = 0; return; }
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 1; }
    if (this.hitstop > 0) { this.hitstop -= dt; L.updateFrozen(dt); return; }
    const wdt = dt * this.slow;
    L.update(wdt);
    if (!L.player.dead && !(this.boss && this.boss.dead)) run.time += wdt;
    if (L.player.dead && L.player.deadT > 1.3) { this.state = 'dead'; this.stateT = 0; }
  }

  private updateRest() {
    const run = this.run!;
    const n = UPGRADES.length + 1;
    if (input.consume('up')) { this.menuSel = (this.menuSel + n - 1) % n; sfx.menu(); }
    if (input.consume('down')) { this.menuSel = (this.menuSel + 1) % n; sfx.menu(); }
    if (input.consume('back') || input.consume('pause')) { this.closeRest(); return; }
    if (this.stateT > 0.2 && (input.consume('confirm') || input.consume('attack'))) {
      if (this.menuSel === UPGRADES.length) { this.closeRest(); return; }
      const u = UPGRADES[this.menuSel], owned = run.owned[u.id];
      const cost = u.cost(owned);
      if (owned >= u.max) { sfx.deny(); this.toast('已至极限'); return; }
      if (run.embers < cost) { sfx.deny(); this.toast('余烬不足'); return; }
      run.embers -= cost; run.owned[u.id]++;
      sfx.buy();
      const L = this.level!;
      L.rest(statsFor(run.owned));
    }
  }

  private closeRest() { this.state = 'play'; input.clear(); }


  // ---------- 绘制 ----------
  draw(ctx: CanvasRenderingContext2D) {
    if (this.state === 'gallery') { this.gallery!.draw(ctx, this.time); return; }
    if (this.state === 'title' || this.state === 'prologue') {
      this.titleBg.drawBack(ctx, this.titleCam, this.time);
      this.titleBg.drawFront(ctx, this.titleCam, this.time);
      if (this.state === 'title') drawTitle(ctx, this); else drawPrologue(ctx, this);
    } else if (this.level) {
      this.level.draw(ctx);
      drawHUD(ctx, this, this.level);
      if (this.state === 'dead') drawDeath(ctx, this);
      else if (this.state === 'rest') drawRest(ctx, this);
      else if (this.state === 'pause') drawPause(ctx, this);
      else if (this.state === 'read') drawRead(ctx, this);
    }
    if (this.state === 'victory') drawVictory(ctx, this);
    if (this.flashBlack > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.flashBlack * 1.6)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.flashWhite > 0) { ctx.fillStyle = `rgba(255,248,235,${this.flashWhite * 0.55})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.fade > 0) { ctx.fillStyle = `rgba(2,3,5,${this.fade})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  }
}
