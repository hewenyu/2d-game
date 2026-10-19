// 多层视差背景：远景石佛与倒悬的殿宇 → 中景殿廊、斗拱、飞檐 → 近景编钟架、石灯笼、经幢，层间夹雾。
// 每层在关卡载入时按种子预渲染到离屏画布（模糊即景深），运行时只做平移。
import { VIEW_H, VIEW_W } from '../config';
import type { Camera } from '../core/camera';
import { quality } from '../core/quality';
import { RNG } from '../core/rng';
import type { Biome } from '../world/biomes';
import { glow } from './draw';

interface Layer { canvas: HTMLCanvasElement; f: number }
interface Shaft { x: number; w: number; tilt: number; a: number; ph: number }
interface Mote { x: number; y: number; z: number; ph: number; s: number }
interface Fg { x: number; y: number; kind: 'vine' | 'stalk'; len: number; seed: number }

const M = 90; // 边距，抵消镜头震动与缩放

export class Background {
  private layers: Layer[] = [];
  private shafts: Shaft[] = [];
  private motes: Mote[] = [];
  private fg: Fg[] = [];

  constructor(private levelW: number, private levelH: number, private biome: Biome, seed: number) {
    const rng = new RNG(seed ^ 0xb16b00b5);
    this.layers.push(this.buildLayer(0.12, rng, 'far'));
    this.layers.push(this.buildLayer(0.32, rng, 'mid'));
    this.layers.push(this.buildLayer(0.58, rng, 'near'));
    for (let i = 0; i < 7; i++) this.shafts.push({ x: rng.range(0, 1), w: rng.range(40, 120), tilt: rng.range(0.25, 0.5), a: rng.range(0.035, 0.08), ph: rng.range(0, 6) });
    for (let i = 0; i < 70; i++) this.motes.push({ x: rng.range(0, VIEW_W), y: rng.range(0, VIEW_H), z: rng.range(0.3, 1.4), ph: rng.range(0, 6.28), s: rng.range(0.6, 2) });
    const nfg = Math.floor(levelW / 420);
    for (let i = 0; i < nfg; i++) this.fg.push({ x: rng.range(0, levelW * 1.25), y: rng.chance(0.6) ? 0 : 1, kind: rng.chance(0.5) ? 'vine' : 'stalk', len: rng.range(60, 180), seed: rng.int(0, 1e6) });
  }

  private size(f: number) {
    return {
      w: Math.ceil(Math.max(0, this.levelW - VIEW_W) * f + VIEW_W + M * 2),
      h: Math.ceil(Math.max(0, this.levelH - VIEW_H) * f + VIEW_H + M * 2),
    };
  }

  private buildLayer(f: number, rng: RNG, kind: 'far' | 'mid' | 'near'): Layer {
    const { w, h } = this.size(f);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    const b = this.biome;
    if (kind === 'far') this.paintFar(g, w, h, rng);
    else if (kind === 'mid') this.paintMid(g, w, h, rng);
    else this.paintNear(g, w, h, rng);
    // 层底部的雾
    const fogA = kind === 'far' ? 0.55 : kind === 'mid' ? 0.4 : 0.25;
    for (let y = 0; y < h; y += VIEW_H * 1.1) {
      const grd = g.createLinearGradient(0, y + VIEW_H * 0.35, 0, y + VIEW_H * 1.1);
      grd.addColorStop(0, `rgba(${b.haze},0)`);
      grd.addColorStop(1, `rgba(${b.haze},${fogA})`);
      g.fillStyle = grd; g.fillRect(0, y + VIEW_H * 0.35, w, VIEW_H * 0.75);
    }
    return { canvas: c, f };
  }

  // 远景：地底的穹窿。巨大的石佛坐在雾里，佛光是这里唯一的天光；殿宇倒悬在穹顶上——寺是整座沉下来的。
  private paintFar(g: CanvasRenderingContext2D, w: number, h: number, rng: RNG) {
    const b = this.biome;
    // 倒悬的殿顶
    g.fillStyle = b.far;
    let x = rng.range(-120, 0);
    while (x < w) {
      const rw = rng.range(160, 320);
      const y = rng.range(-20, h * 0.08);
      g.save(); g.translate(x + rw / 2, y); g.scale(1, -1);
      eaveRoof(g, 0, -rng.range(30, 60), rw, rng.range(40, 70));
      g.fillRect(-rw * 0.35, -rng.range(30, 60) - 400, rw * 0.7, 400);
      g.restore();
      x += rw + rng.range(80, 260);
    }
    // 石佛（带佛光）
    x = rng.range(100, 500);
    while (x < w) {
      const s = rng.range(1.1, 1.7), base = h * rng.range(0.78, 0.95);
      glow(g, x, base - 330 * s, 260 * s, b.window, 0.12);
      g.strokeStyle = `rgba(${b.window},0.12)`; g.lineWidth = 3;
      for (const r of [95, 120, 150]) { g.beginPath(); g.arc(x, base - 300 * s, r * s, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = b.far;
      buddha(g, x, base, s);
      x += rng.range(1300, 2000);
    }
    // 远塔
    x = rng.range(-50, 200);
    while (x < w) {
      const tiers = rng.int(5, 9), tw = rng.range(50, 90), base = h * rng.range(0.7, 1);
      g.fillStyle = b.far;
      pagoda(g, x, base, tiers, tw);
      x += rng.range(350, 700);
    }
    // 自穹顶垂下的巨钟
    for (let i = 0; i < w / 500; i++) {
      const cx = rng.range(0, w), len = rng.range(100, h * 0.4), bw = rng.range(50, 90);
      g.strokeStyle = b.far; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, len); g.stroke();
      g.fillStyle = b.far; g.beginPath(); templeBell(g, cx, len, bw); g.fill();
    }
  }

  // 中景：一层层的殿廊——朱柱、斗拱、飞檐、檐角风铎，柱间垂着经幡。有的已经塌了一半。
  private paintMid(g: CanvasRenderingContext2D, w: number, h: number, rng: RNG) {
    const b = this.biome;
    for (let tier = 0; tier < Math.ceil(h / 440); tier++) {
      const base = 360 + tier * 440 + rng.range(-30, 30);
      let x = rng.range(-200, 0);
      while (x < w) {
        const span = rng.range(380, 620), cols = rng.int(3, 5), colH = rng.range(190, 260);
        const ruined = rng.chance(0.25);
        g.fillStyle = b.mid; g.strokeStyle = b.mid;
        // 台基
        g.fillRect(x - 20, base, span + 40, 26);
        for (let k = 0; k < 5; k++) g.fillRect(x - 30 - k * 8, base + 26 + k * 6, span + 60 + k * 16, 6);
        // 柱与斗拱
        for (let c = 0; c < cols; c++) {
          const cx = x + (c / (cols - 1)) * span;
          if (ruined && c === cols - 1) { g.save(); g.translate(cx, base); g.rotate(0.5); g.fillRect(-9, -colH * 0.7, 18, colH * 0.7); g.restore(); continue; }
          g.fillRect(cx - 9, base - colH, 18, colH);
          g.fillRect(cx - 14, base - 10, 28, 10); // 柱础
          // 斗拱：三层错叠的木块
          for (let k = 0; k < 3; k++) g.fillRect(cx - 10 - k * 7, base - colH - 8 - k * 8, 20 + k * 14, 7);
        }
        // 额枋
        g.fillRect(x - 10, base - colH - 4, span + 20, 10);
        // 屋檐
        const roofY = base - colH - 30;
        if (ruined) { g.save(); g.translate(x + span / 2, roofY); g.rotate(0.12); eaveRoof(g, 0, 0, span * 0.8, 70); g.restore(); }
        else eaveRoof(g, x + span / 2, roofY, span + 80, rng.range(70, 110));
        // 檐角风铎
        for (const ex of [x - 40, x + span + 40]) {
          g.lineWidth = 1.5; g.beginPath(); g.moveTo(ex, roofY - 6); g.lineTo(ex, roofY + 14); g.stroke();
          g.beginPath(); templeBell(g, ex, roofY + 14, 12); g.fill();
        }
        // 经幡
        for (let c = 0; c < cols - 1; c++) {
          if (!rng.chance(0.55)) continue;
          const bx = x + ((c + 0.5) / (cols - 1)) * span, len = rng.range(80, colH - 30);
          banner(g, bx, base - colH + 6, len, rng.range(16, 24), b.mid, `rgba(${b.window},0.07)`);
        }
        // 殿内透出的灯光
        if (rng.chance(0.5)) glow(g, x + span * rng.range(0.3, 0.7), base - colH * 0.4, colH * 0.8, b.window, 0.06);
        x += span + rng.range(160, 420);
      }
    }
    // 远处垂下的锁链与绳
    for (let i = 0; i < w / 220; i++) chain(g, rng.range(0, w), 0, rng.range(80, 300), b.mid, 4);
  }

  // 近景：编钟架、石灯笼、经幢、挂满符的绳索，以及几根刻着楹联的巨柱。
  private paintNear(g: CanvasRenderingContext2D, w: number, h: number, rng: RNG) {
    const b = this.biome;
    g.fillStyle = b.near; g.strokeStyle = b.near;
    // 巨柱与楹联
    let x = rng.range(0, 300);
    while (x < w) {
      const cw = rng.range(46, 80);
      g.fillStyle = b.near;
      g.fillRect(x, 0, cw, h);
      g.fillStyle = 'rgba(255,230,190,0.025)';
      for (let y = rng.range(80, 300); y < h - 300; y += rng.range(500, 900)) {
        g.fillRect(x + cw * 0.2, y, cw * 0.6, 240);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 7; k++) g.fillRect(x + cw * 0.38, y + 14 + k * 32, cw * 0.24, 16);
        g.fillStyle = 'rgba(255,230,190,0.025)';
      }
      x += cw + rng.range(500, 900);
    }
    g.fillStyle = b.near;
    // 每层地面附近的器物
    for (let tier = 0; tier < Math.ceil(h / 500); tier++) {
      const base = 430 + tier * 500;
      let px = rng.range(0, 300);
      while (px < w) {
        const kind = rng.pick(['rack', 'lantern', 'pillar', 'lantern', 'rack'] as const);
        g.fillStyle = b.near; g.strokeStyle = b.near;
        if (kind === 'rack') bellRack(g, px, base, rng.range(180, 280), rng);
        else if (kind === 'lantern') { stoneLantern(g, px, base, rng.range(0.9, 1.4)); glow(g, px, base - 70, 70, b.window, 0.12); }
        else dharaniPillar(g, px, base, rng.range(140, 220));
        px += rng.range(380, 760);
      }
    }
    // 挂符的绳
    g.lineCap = 'round';
    for (let i = 0; i < w / 260; i++) {
      const x0 = rng.range(0, w), y0 = rng.range(0, h * 0.7), x1 = x0 + rng.range(200, 420), sag = rng.range(30, 90);
      g.strokeStyle = b.near; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 + sag * 2, x1, y0); g.stroke();
      g.fillStyle = b.near;
      for (let k = 1; k < 6; k++) {
        const t = k / 6, fx = x0 + (x1 - x0) * t, fy = y0 + 2 * (1 - t) * t * sag * 2;
        g.fillRect(fx - 4, fy, 8, rng.range(18, 30));
      }
    }
    g.lineCap = 'butt';
  }

  /** 天空渐变 + 视差层 + 光束 */
  drawBack(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const b = this.biome;
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, b.sky[0]); grd.addColorStop(1, b.sky[1]);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // 低画质档位下少画几层视差；层是按「由远及近」建的，保留前 N 层。
    const n = Math.min(this.layers.length, quality.bgLayers);
    for (let i = 0; i < n; i++) {
      const L = this.layers[i];
      const ox = -(cam.x - VIEW_W / 2) * L.f - M + cam.sx * L.f;
      const oy = -(cam.y - VIEW_H / 2) * L.f - M + cam.sy * L.f;
      ctx.drawImage(L.canvas, Math.round(ox), Math.round(oy));
      if (i === 1 && quality.ambient) this.drawShafts(ctx, cam, time);
    }
  }

  private drawShafts(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const b = this.biome;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const span = VIEW_W + 600;
    for (const s of this.shafts) {
      const x = ((s.x * span - cam.x * 0.45) % span + span) % span - 300;
      const a = s.a * (0.7 + 0.3 * Math.sin(time * 0.4 + s.ph));
      const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grd.addColorStop(0, `rgba(${b.light},${a})`);
      grd.addColorStop(1, `rgba(${b.light},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(x, -10); ctx.lineTo(x + s.w, -10);
      ctx.lineTo(x + s.w + VIEW_H * s.tilt + s.w * 0.6, VIEW_H); ctx.lineTo(x + VIEW_H * s.tilt - s.w * 0.3, VIEW_H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /** 前景：尘埃、雾、近景剪影 */
  drawFront(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const b = this.biome;
    // 漂浮尘埃
    if (quality.ambient) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const m of this.motes) {
        const x = ((m.x - cam.x * m.z * 0.6 + Math.sin(time * 0.3 + m.ph) * 20) % VIEW_W + VIEW_W) % VIEW_W;
        const y = ((m.y - cam.y * m.z * 0.6 - time * 8 * m.z) % VIEW_H + VIEW_H) % VIEW_H;
        const a = 0.25 + 0.25 * Math.sin(time * 1.3 + m.ph);
        ctx.fillStyle = `rgba(${b.light},${a * Math.min(1, m.z)})`;
        ctx.beginPath(); ctx.arc(x, y, m.s * m.z, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // 底部雾带
    const fogY = VIEW_H * 0.62;
    const grd = ctx.createLinearGradient(0, fogY, 0, VIEW_H);
    grd.addColorStop(0, `rgba(${b.fog},0)`);
    grd.addColorStop(1, `rgba(${b.fog},0.13)`);
    ctx.fillStyle = grd; ctx.fillRect(0, fogY, VIEW_W, VIEW_H - fogY);
    // 近景剪影（视差 > 1）：垂下的经幡与挂符的绳、地面的枯苇
    ctx.fillStyle = 'rgba(4,3,2,0.93)'; ctx.strokeStyle = 'rgba(4,3,2,0.93)';
    for (const f of this.fg) {
      const x = f.x - cam.x * 1.25 + VIEW_W / 2;
      if (x < -100 || x > VIEW_W + 100) continue;
      const sway = Math.sin(time * 0.8 + f.seed) * 6;
      if (f.y === 0) {
        if (f.kind === 'vine') {
          // 长幡：顶端横杆，幡身随风摆，末端剪成燕尾
          ctx.fillRect(x - 22, -4, 44, 6);
          ctx.beginPath();
          ctx.moveTo(x - 14, 0); ctx.lineTo(x + 14, 0);
          ctx.quadraticCurveTo(x + 14 + sway * 0.5, f.len * 0.5, x + 14 + sway, f.len);
          ctx.lineTo(x + sway, f.len - 16); ctx.lineTo(x - 14 + sway, f.len);
          ctx.quadraticCurveTo(x - 14 + sway * 0.5, f.len * 0.5, x - 14, 0);
          ctx.fill();
        } else {
          // 垂绳与镇魂符
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x, -5); ctx.quadraticCurveTo(x + sway, f.len * 0.5, x + sway * 1.4, f.len); ctx.stroke();
          for (let k = 1; k <= 3; k++) { const t = k / 3.5; ctx.fillRect(x + sway * 1.4 * t - 5, f.len * t, 10, 24); }
        }
      } else {
        // 枯苇
        ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        for (let k = 0; k < 9; k++) {
          const bx = x + (k - 4) * 9, hgt = 34 + ((f.seed * (k + 3)) % 44);
          const sw = Math.sin(time * 1.2 + k + f.seed) * 5;
          ctx.beginPath(); ctx.moveTo(bx, VIEW_H + 5); ctx.quadraticCurveTo(bx + sw, VIEW_H - hgt * 0.5, bx + sw * 2, VIEW_H - hgt); ctx.stroke();
          if (k % 3 === 0) { ctx.beginPath(); ctx.ellipse(bx + sw * 2, VIEW_H - hgt - 6, 2.5, 7, sw * 0.05, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    }
    ctx.lineCap = 'butt';
  }
}

/** 歇山式屋顶：正脊两端起鸱吻，檐口两角上翘 */
function eaveRoof(g: CanvasRenderingContext2D, cx: number, y: number, w: number, h: number) {
  const hw = w / 2;
  g.beginPath();
  g.moveTo(cx - hw - 20, y - 18);
  g.quadraticCurveTo(cx - hw + 10, y + 4, cx - hw * 0.6, y + 2);
  g.lineTo(cx + hw * 0.6, y + 2);
  g.quadraticCurveTo(cx + hw - 10, y + 4, cx + hw + 20, y - 18);
  g.quadraticCurveTo(cx + hw * 0.7, y - h * 0.35, cx + hw * 0.42, y - h);
  g.lineTo(cx - hw * 0.42, y - h);
  g.quadraticCurveTo(cx - hw * 0.7, y - h * 0.35, cx - hw - 20, y - 18);
  g.fill();
  // 正脊与鸱吻
  g.fillRect(cx - hw * 0.45, y - h - 8, hw * 0.9, 10);
  for (const s of [-1, 1]) {
    const ex = cx + s * hw * 0.45;
    g.beginPath(); g.moveTo(ex, y - h - 8); g.quadraticCurveTo(ex + s * 4, y - h - 30, ex - s * 10, y - h - 26); g.lineTo(ex - s * 6, y - h); g.fill();
  }
}

function pagoda(g: CanvasRenderingContext2D, cx: number, base: number, tiers: number, w: number) {
  let y = base;
  for (let i = 0; i < tiers; i++) {
    const k = 1 - i / (tiers + 2), tw = w * k, th = 34 * k + 10;
    g.fillRect(cx - tw * 0.32, y - th, tw * 0.64, th);
    eaveRoof(g, cx, y - th, tw * 1.1, 14 * k + 6);
    y -= th + 14 * k + 6;
  }
  // 塔刹
  g.fillRect(cx - 2, y - 60, 4, 60);
  for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(cx, y - 14 - i * 7, 7 - i * 0.7, 2, 0, 0, Math.PI * 2); g.fill(); }
}

function buddha(g: CanvasRenderingContext2D, cx: number, base: number, s: number) {
  g.save(); g.translate(cx, base); g.scale(s, s);
  // 莲座
  g.beginPath(); g.ellipse(0, -18, 150, 22, 0, 0, Math.PI * 2); g.fill();
  for (let i = -6; i <= 6; i++) { g.beginPath(); g.ellipse(i * 23, -36, 14, 22, i * 0.08, 0, Math.PI * 2); g.fill(); }
  // 盘腿
  g.beginPath(); g.ellipse(0, -62, 130, 34, 0, 0, Math.PI * 2); g.fill();
  // 身躯与双肩
  g.beginPath();
  g.moveTo(-100, -70); g.quadraticCurveTo(-112, -170, -70, -215); g.quadraticCurveTo(-30, -235, 0, -232);
  g.quadraticCurveTo(30, -235, 70, -215); g.quadraticCurveTo(112, -170, 100, -70); g.closePath(); g.fill();
  // 禅定印的双手
  g.beginPath(); g.ellipse(0, -92, 40, 15, 0, 0, Math.PI * 2); g.fill();
  // 颈、头、长耳、肉髻
  g.fillRect(-18, -262, 36, 34);
  g.beginPath(); g.ellipse(0, -300, 44, 54, 0, 0, Math.PI * 2); g.fill();
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 44, -288, 9, 32, sx * 0.1, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.ellipse(0, -356, 22, 18, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** 梵钟剪影：钟纽 + 微张的钟身 */
function templeBell(g: CanvasRenderingContext2D, cx: number, top: number, w: number) {
  const h = w * 1.2;
  g.moveTo(cx - w * 0.32, top + h * 0.08);
  g.quadraticCurveTo(cx, top - h * 0.04, cx + w * 0.32, top + h * 0.08);
  g.quadraticCurveTo(cx + w * 0.4, top + h * 0.6, cx + w * 0.5, top + h);
  g.lineTo(cx - w * 0.5, top + h);
  g.quadraticCurveTo(cx - w * 0.4, top + h * 0.6, cx - w * 0.32, top + h * 0.08);
  g.closePath();
}

function banner(g: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, color: string, mark: string) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x + w / 2, y + len);
  g.lineTo(x, y + len - w * 0.6); g.lineTo(x - w / 2, y + len); g.closePath(); g.fill();
  g.fillStyle = mark;
  for (let k = 0; k < len / 26 - 1; k++) g.fillRect(x - w * 0.22, y + 12 + k * 26, w * 0.44, 14);
}

/** 编钟架：上下两道平直的横梁，梁头雕成龙首；上层挂小钮钟，下层挂大甬钟 */
function bellRack(g: CanvasRenderingContext2D, x: number, base: number, w: number, rng: RNG) {
  const hgt = rng.range(120, 160);
  g.fillRect(x, base - hgt, 9, hgt); g.fillRect(x + w - 9, base - hgt, 9, hgt);
  // 立柱下的兽座
  for (const px of [x + 4.5, x + w - 4.5]) { g.beginPath(); g.ellipse(px, base - 6, 16, 9, 0, Math.PI, 0); g.fill(); }
  for (const [y, n, bw] of [[base - hgt, rng.int(6, 9), 15], [base - hgt * 0.52, rng.int(3, 5), 26]] as const) {
    g.fillRect(x - 6, y - 7, w + 12, 8);
    // 龙首梁头
    for (const s of [-1, 1]) {
      const ex = s < 0 ? x - 6 : x + w + 6;
      g.beginPath(); g.moveTo(ex, y - 7); g.quadraticCurveTo(ex + s * 12, y - 12, ex + s * 14, y - 3); g.lineTo(ex, y + 1); g.fill();
    }
    for (let i = 0; i < n; i++) {
      const bx = x + 20 + (i / (n - 1)) * (w - 40), sz = bw * (1 - i * 0.05);
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, y); g.lineTo(bx, y + 6); g.stroke();
      g.beginPath(); templeBell(g, bx, y + 6, sz * 0.7); g.fill();
    }
  }
}

function stoneLantern(g: CanvasRenderingContext2D, x: number, base: number, s: number) {
  g.save(); g.translate(x, base); g.scale(s, s);
  g.fillRect(-16, -8, 32, 8); g.fillRect(-6, -54, 12, 46); g.fillRect(-18, -62, 36, 8);
  g.fillRect(-12, -88, 24, 26);
  g.beginPath(); g.moveTo(-26, -86); g.quadraticCurveTo(0, -112, 26, -86); g.lineTo(18, -92); g.lineTo(-18, -92); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, -108, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,190,120,0.35)'; g.fillRect(-6, -82, 12, 14);
  g.restore();
}

function dharaniPillar(g: CanvasRenderingContext2D, x: number, base: number, hgt: number) {
  g.fillRect(x - 22, base - 14, 44, 14);
  g.fillRect(x - 12, base - hgt, 24, hgt - 14);
  for (let i = 0; i < 3; i++) {
    const y = base - hgt * (0.45 + i * 0.25);
    g.beginPath(); g.moveTo(x - 24 + i * 3, y); g.quadraticCurveTo(x, y - 14, x + 24 - i * 3, y); g.lineTo(x + 16, y + 6); g.lineTo(x - 16, y + 6); g.closePath(); g.fill();
  }
  g.beginPath(); g.arc(x, base - hgt - 16, 9, 0, Math.PI * 2); g.fill();
}

export function chain(g: CanvasRenderingContext2D, x: number, y: number, len: number, color: string, link = 5) {
  g.strokeStyle = color; g.lineWidth = Math.max(1.2, link * 0.35);
  for (let yy = 0; yy < len; yy += link * 1.6) {
    g.beginPath();
    if ((yy / (link * 1.6)) % 2 < 1) g.ellipse(x, y + yy, link * 0.45, link, 0, 0, Math.PI * 2);
    else { g.moveTo(x, y + yy - link); g.lineTo(x, y + yy + link); }
    g.stroke();
  }
}
