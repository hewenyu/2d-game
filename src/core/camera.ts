import { VIEW_H, VIEW_W } from '../config';
import { clamp, damp } from './math';

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  targetZoom = 1;
  private shakeAmt = 0;
  private shakeT = 0;
  /** 方向性的冲击位移（命中时把画面往打击方向顶一下，再弹回） */
  private kx = 0;
  private ky = 0;
  sx = 0;
  sy = 0;
  bounds = { x0: 0, y0: 0, x1: VIEW_W, y1: VIEW_H };

  get viewW() { return VIEW_W / this.zoom; }
  get viewH() { return VIEW_H / this.zoom; }

  private clampTarget(tx: number, ty: number) {
    const hw = this.viewW / 2, hh = this.viewH / 2, b = this.bounds;
    const cx = b.x1 - b.x0 < hw * 2 ? (b.x0 + b.x1) / 2 : clamp(tx, b.x0 + hw, b.x1 - hw);
    const cy = b.y1 - b.y0 < hh * 2 ? (b.y0 + b.y1) / 2 : clamp(ty, b.y0 + hh, b.y1 - hh);
    return { cx, cy };
  }

  update(dt: number, tx: number, ty: number) {
    this.zoom += (this.targetZoom - this.zoom) * damp(2.5, dt);
    const { cx, cy } = this.clampTarget(tx, ty);
    this.x += (cx - this.x) * damp(7, dt);
    this.y += (cy - this.y) * damp(6, dt);
    this.tickShake(dt);
  }

  /** 只推进震屏（顿帧期间也要跑，否则画面整个僵住，像卡了） */
  tickShake(dt: number) {
    this.shakeT += dt;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    const a = this.shakeAmt, t = this.shakeT;
    // 用几组不同频率的正弦叠加，而不是每步随机：振动连贯、有重量，不会变成噪点式的抖
    const kd = Math.exp(-16 * dt);
    this.kx *= kd; this.ky *= kd;
    this.sx = a * (Math.sin(t * 71) * 0.6 + Math.sin(t * 113 + 1.3) * 0.4) + this.kx;
    this.sy = a * (Math.sin(t * 61 + 2) * 0.6 + Math.sin(t * 97 + 0.7) * 0.4) + this.ky;
  }

  snap(tx: number, ty: number) {
    this.zoom = this.targetZoom;
    const { cx, cy } = this.clampTarget(tx, ty);
    this.x = cx; this.y = cy;
  }

  shake(v: number) { this.shakeAmt = Math.max(this.shakeAmt, v); }
  kick(dx: number, dy: number) { this.kx += dx; this.ky += dy; }

  begin(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.sx, -this.y + this.sy);
  }
  end(ctx: CanvasRenderingContext2D) { ctx.restore(); }

  toWorld(sx: number, sy: number) {
    return { x: this.x + (sx - VIEW_W / 2) / this.zoom, y: this.y + (sy - VIEW_H / 2) / this.zoom };
  }
  toScreen(wx: number, wy: number) {
    return { x: (wx - this.x) * this.zoom + VIEW_W / 2, y: (wy - this.y) * this.zoom + VIEW_H / 2 };
  }
  /** 世界矩形是否可见 */
  visible(x: number, y: number, w: number, h: number, margin = 64) {
    const hw = this.viewW / 2 + margin, hh = this.viewH / 2 + margin;
    return x + w > this.x - hw && x < this.x + hw && y + h > this.y - hh && y < this.y + hh;
  }
}
