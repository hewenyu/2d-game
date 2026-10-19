// 开发用的角色图鉴：?debug&gallery 打开。放大展示每个模型在各状态下的样子，方便检查建模。
import { VIEW_H, VIEW_W } from '../config';
import { text } from '../render/draw';
import { WandererModel, type WandererView } from '../render/models/wanderer';
import { MonkModel, type MonkView } from '../render/models/monk';
import { GuardianModel, type GuardianView } from '../render/models/guardian';
import { MothModel, type MothView } from '../render/models/moth';
import { AbbotModel, type AbbotView } from '../render/models/abbot';

interface Cell { label: string; scale: number; draw: (ctx: CanvasRenderingContext2D, t: number) => void }

export class Gallery {
  private cells: Cell[] = [];
  page = 0;

  constructor() {
    const wv = (o: Partial<WandererView>): WandererView => ({
      x: 0, y: 0, facing: 1, vx: 0, vy: 0, onGround: true, run: 0, dashT: 0, attackT: -1, attackDir: 'side',
      throwT: -1, throwAng: 0, healT: -1, hurtT: 0, bladeInHand: true, sx: 1, sy: 1, alpha: 1, dead: false, deadT: 0, time: 0, ...o,
    });
    const W = (label: string, fn: (t: number) => Partial<WandererView>) => {
      const m = new WandererModel();
      this.cells.push({ label, scale: 3.2, draw: (ctx, t) => m.draw(ctx, wv({ time: t, ...fn(t) })) });
    };
    W('站立', () => ({}));
    W('奔跑', (t) => ({ vx: 250, run: t * 13.75 }));
    W('起跳', () => ({ onGround: false, vy: -500 }));
    W('下落', () => ({ onGround: false, vy: 500 }));
    W('冲刺', () => ({ dashT: 0.1, vx: 660 }));
    W('横斩', (t) => ({ attackT: (t % 0.6) * 0.45, attackDir: 'side' }));
    W('上斩', (t) => ({ attackT: (t % 0.6) * 0.45, attackDir: 'up' }));
    W('下劈', (t) => ({ attackT: (t % 0.6) * 0.45, attackDir: 'down', onGround: false, vy: 100 }));
    W('掷刃', () => ({ throwT: 0.05, throwAng: -0.3, bladeInHand: false }));
    W('饮灯油', (t) => ({ healT: (t % 1.2) * 0.8 }));
    W('受击', () => ({ hurtT: 0.2 }));
    W('倒下', (t) => ({ dead: true, deadT: t % 1.6 }));
    W('下蹲', () => ({ crouch: 1 }));
    W('蹲行', (t) => ({ crouch: 1, vx: 112, run: t * 6 }));
    W('蹲斩', (t) => ({ crouch: 1, attackT: (t % 0.6) * 0.45, attackDir: 'side' }));

    const mv = (o: Partial<MonkView>): MonkView => ({ x: 0, y: 0, facing: 1, state: 'idle', t: 0, wind: 0.56, walk: 0, vx: 0, flash: false, dead: false, deadT: 0, time: 0, seed: 3, ...o });
    const M = (label: string, fn: (t: number) => Partial<MonkView>) => {
      const m = new MonkModel();
      this.cells.push({ label, scale: 3, draw: (ctx, t) => m.draw(ctx, mv({ time: t, ...fn(t) })) });
    };
    M('失声僧 · 巡行', (t) => ({ vx: 42, walk: t * 2.5 }));
    M('失声僧 · 追击', (t) => ({ state: 'chase', vx: 125, walk: t * 7.5 }));
    M('失声僧 · 举铲', (t) => ({ state: 'windup', t: (t % 1) * 0.56 }));
    M('失声僧 · 劈下', (t) => ({ state: 'strike', t: (t % 0.5) * 0.32 }));
    M('失声僧 · 硬直', (t) => ({ state: 'recover', t: (t % 1) * 0.62 }));
    M('失声僧 · 踉跄', (t) => ({ state: 'stagger', t: (t % 1) * 0.5 }));
    M('失声僧 · 受击', () => ({ state: 'chase', flash: true }));
    M('失声僧 · 倒下', (t) => ({ dead: true, deadT: t % 1.2 }));

    const gv = (o: Partial<GuardianView>): GuardianView => ({ x: 0, y: 0, facing: 1, state: 'idle', t: 0, wind: 0.78, walk: 0, vx: 0, flash: false, dead: false, deadT: 0, time: 0, seed: 5, ...o });
    const G = (label: string, fn: (t: number) => Partial<GuardianView>) => {
      const m = new GuardianModel();
      this.cells.push({ label, scale: 2.6, draw: (ctx, t) => m.draw(ctx, gv({ time: t, ...fn(t) })) });
    };
    G('钟卫 · 伫立', () => ({}));
    G('钟卫 · 逼近', (t) => ({ state: 'chase', vx: 55, walk: t * 2.75 }));
    G('钟卫 · 蓄力', (t) => ({ state: 'windup', t: (t % 1.2) * 0.78 }));
    G('钟卫 · 盾撞', () => ({ state: 'bash', t: 0.1 }));
    G('钟卫 · 喘息', (t) => ({ state: 'recover', t: (t % 1.5) * 1.15 }));
    G('钟卫 · 转身', (t) => ({ state: 'turn', t: (t % 0.8) * 0.5 }));
    G('钟卫 · 破防', (t) => ({ state: 'stagger', t: (t % 1.6) * 1.3 }));
    G('钟卫 · 倒下', (t) => ({ dead: true, deadT: t % 1.4 }));

    const tv = (o: Partial<MothView>): MothView => ({ x: 0, y: -30, facing: 1, state: 'idle', t: 0, wind: 0.62, ph: 0, dvx: 1, dvy: 1, flash: false, dead: false, deadT: 0, time: 0, seed: 4, ...o });
    const T = (label: string, fn: (t: number) => Partial<MothView>) => {
      const m = new MothModel(4);
      this.cells.push({ label, scale: 3.4, draw: (ctx, t) => m.draw(ctx, tv({ time: t, ph: t, ...fn(t) })) });
    };
    T('符蛾 · 盘旋', () => ({}));
    T('符蛾 · 蓄力', (t) => ({ state: 'windup', t: (t % 1) * 0.62 }));
    T('符蛾 · 俯冲', () => ({ state: 'dive', dvx: 400, dvy: 380 }));
    T('符蛾 · 受击', () => ({ state: 'stagger', flash: true, t: 0.1 }));
    T('符蛾 · 焚尽', (t) => ({ dead: true, deadT: t % 0.9 }));

    const av = (o: Partial<AbbotView>): AbbotView => ({ x: 0, y: 0, facing: 1, state: 'idle', atk: null, t: 0, hammer: 1.2, bellGlow: 0, phase: 1, elite: false, leapStage: 'rise', vx: 0, vy: 0, flash: false, dead: false, deadT: 0, time: 0, ...o });
    const A = (label: string, fn: (t: number) => Partial<AbbotView>) => {
      const m = new AbbotModel();
      this.cells.push({ label, scale: 1.25, draw: (ctx, t) => m.draw(ctx, av({ time: t, ...fn(t) })) });
    };
    A('守钟人 · 入定', () => ({ state: 'dormant' }));
    A('守钟人 · 行走', () => ({ vx: 82 }));
    A('守钟人 · 横扫蓄力', (t) => ({ state: 'windup', atk: 'sweep', hammer: -2.5 * Math.min(1, (t % 1) / 0.45) }));
    A('守钟人 · 横扫', () => ({ state: 'active', atk: 'sweep', hammer: 0.6 }));
    A('守钟人 · 跃起', () => ({ state: 'leap', atk: 'leap', leapStage: 'hover', hammer: -1.6 }));
    A('守钟人 · 砸地', () => ({ state: 'active', atk: 'land', hammer: 1.3 }));
    A('守钟人 · 冲撞', () => ({ state: 'active', atk: 'charge', hammer: 0.35, vx: 780 }));
    A('守钟人 · 撞钟', (t) => ({ state: (t % 1.2) < 0.7 ? 'windup' : 'active', atk: 'toll', t: (t % 1.2) < 0.7 ? t % 1.2 : (t % 1.2) - 0.7, bellGlow: 1, hammer: 1.4 }));
    A('守钟人 · 撞墙眩晕', () => ({ state: 'stun', hammer: 1.5 }));
    A('守钟人 · 二阶段', (t) => ({ phase: 2, vx: 105, hammer: 1.2 + Math.sin(t) * 0.1 }));
    A('残响', () => ({ elite: true, hammer: 1.2 }));
    A('守钟人 · 倒下', (t) => ({ dead: true, deadT: t % 2.6 }));
  }

  get pages() { return Math.ceil(this.cells.length / 12); }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#2a2620'); g.addColorStop(1, '#14120f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const cols = 4, rows = 3, cw = VIEW_W / cols, ch = VIEW_H / rows;
    const list = this.cells.slice(this.page * 12, this.page * 12 + 12);
    list.forEach((c, i) => {
      const cx = (i % cols) * cw + cw / 2, cy = Math.floor(i / cols) * ch + ch - 26;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx - cw / 2 + 4, cy, cw - 8, 2);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(c.scale, c.scale);
      c.draw(ctx, time);
      ctx.restore();
      text(ctx, c.label, cx, cy + 14, 12, 'rgba(230,220,200,0.8)');
    });
    text(ctx, `角色图鉴 ${this.page + 1}/${this.pages} · ←/→ 翻页`, 12, 14, 12, 'rgba(230,220,200,0.6)', 'left');
  }
}
