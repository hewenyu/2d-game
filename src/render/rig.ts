// 角色建模的基础工具：仿射变换（局部 → 世界）、两段 IK、胶囊肢体、背光描边、绳/布料模拟。
// 所有角色模型都在「脚底中心为原点、面朝 +x」的局部坐标中绘制。

export interface Pt { x: number; y: number }

/** 与 ctx 变换同步的 2D 仿射矩阵。布料要在世界空间模拟，需要把局部锚点换算出来。 */
export class Xf {
  constructor(public a = 1, public b = 0, public c = 0, public d = 1, public e = 0, public f = 0) {}
  clone() { return new Xf(this.a, this.b, this.c, this.d, this.e, this.f); }
  translate(x: number, y: number) { this.e += this.a * x + this.c * y; this.f += this.b * x + this.d * y; return this; }
  rotate(r: number) {
    const cs = Math.cos(r), sn = Math.sin(r);
    const a = this.a * cs + this.c * sn, b = this.b * cs + this.d * sn;
    const c = -this.a * sn + this.c * cs, d = -this.b * sn + this.d * cs;
    this.a = a; this.b = b; this.c = c; this.d = d; return this;
  }
  scale(sx: number, sy: number) { this.a *= sx; this.b *= sx; this.c *= sy; this.d *= sy; return this; }
  apply(x: number, y: number): Pt { return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f }; }
  /** 把世界坐标写回 ctx（在世界空间基准之上） */
  set(ctx: CanvasRenderingContext2D, base: DOMMatrix) {
    ctx.setTransform(base.multiply(new DOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f])));
  }
}

/** 两段 IK：从 a 指向目标 t，返回关节与末端。bend=1 时关节偏向 +x 一侧（局部坐标里膝盖朝前）。 */
export function ik(ax: number, ay: number, tx: number, ty: number, l1: number, l2: number, bend: number) {
  let dx = tx - ax, dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.001;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  d = Math.max(d, 0.001);
  const base = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const ang = base - bend * A;
  return { kx: ax + Math.cos(ang) * l1, ky: ay + Math.sin(ang) * l1, ex: ax + dx, ey: ay + dy };
}

/** 两端半径不同的胶囊，追加进 Path2D（多段可叠成一条肢体） */
export function capsule(p: Path2D, x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = Math.PI / 2;
  p.moveTo(x1 + Math.cos(a + h) * r1, y1 + Math.sin(a + h) * r1);
  p.arc(x1, y1, r1, a + h, a + 3 * h);
  p.arc(x2, y2, r2, a - h, a + h);
  p.closePath();
}

/**
 * 背光描边填充：先整体填亮色，再在形状内部错位填暗色，只在背光一侧留下一道细亮边。
 * ox/oy 是暗色的错位量（局部坐标；面朝 +x 时正值让亮边落在「背后上方」）。
 */
export function rim(ctx: CanvasRenderingContext2D, path: Path2D, fill: string | CanvasGradient, light: string, ox = 1.1, oy = 1.1) {
  ctx.fillStyle = light; ctx.fill(path);
  ctx.save(); ctx.clip(path); ctx.translate(ox, oy);
  ctx.fillStyle = fill; ctx.fill(path);
  ctx.restore();
}

/** 简单的平滑多边形（经过各点中点的二次曲线） */
export function smoothPoly(p: Path2D, pts: Pt[], closed = true) {
  const n = pts.length;
  if (n < 3) return;
  const mid = (i: number) => { const a = pts[(i + n) % n], b = pts[(i + 1) % n]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  if (closed) {
    const m0 = mid(n - 1);
    p.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) { const m = mid(i); p.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
    p.closePath();
  } else {
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) { const m = mid(i); p.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
    p.lineTo(pts[n - 1].x, pts[n - 1].y);
  }
}

export interface RopeOpts {
  /** 重力 px/s² */
  grav?: number;
  /** 每步速度保留比例 */
  damp?: number;
  /** 第 i 个点相对锚点的「静止形状」偏移（世界坐标），配合 stiff 让布料保持轮廓 */
  rest?: (i: number) => Pt;
  stiff?: number;
  /** 风：水平飘动的幅度 */
  wind?: number;
  time?: number;
}

/**
 * 绳 / 布条：Verlet 积分 + 跟随约束（子节点只被父节点拉动，稳定、不会抖散）。
 * 在世界空间里模拟；锚点每帧由角色姿态给出。
 */
export class Rope {
  x: number[]; y: number[]; px: number[]; py: number[];
  private ax = 0; private ay = 0; private inited = false;
  constructor(public n: number, public seg: number) {
    this.x = new Array(n).fill(0); this.y = new Array(n).fill(0);
    this.px = new Array(n).fill(0); this.py = new Array(n).fill(0);
  }

  reset(ax: number, ay: number, o: RopeOpts = {}) {
    for (let i = 0; i < this.n; i++) {
      const r = o.rest ? o.rest(i) : { x: 0, y: i * this.seg };
      this.x[i] = this.px[i] = ax + r.x; this.y[i] = this.py[i] = ay + r.y;
    }
    this.ax = ax; this.ay = ay; this.inited = true;
  }

  step(ax: number, ay: number, dt: number, o: RopeOpts = {}) {
    if (!this.inited || Math.hypot(ax - this.ax, ay - this.ay) > 120) { this.reset(ax, ay, o); return; }
    if (dt <= 0) { this.shift(ax, ay); return; }
    const grav = o.grav ?? 900, damp = o.damp ?? 0.94, stiff = o.stiff ?? 0, wind = o.wind ?? 0, time = o.time ?? 0;
    const steps = Math.max(1, Math.min(6, Math.ceil(dt / (1 / 120))));
    const h = dt / steps;
    const sx = this.ax, sy = this.ay;
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      const cx = sx + (ax - sx) * k, cy = sy + (ay - sy) * k;
      this.x[0] = this.px[0] = cx; this.y[0] = this.py[0] = cy;
      for (let i = 1; i < this.n; i++) {
        let fx = Math.sin(time * 3.1 + i * 0.9) * wind, fy = grav;
        if (stiff > 0 && o.rest) {
          const r = o.rest(i);
          fx += (cx + r.x - this.x[i]) * stiff; fy += (cy + r.y - this.y[i]) * stiff;
        }
        const vx = (this.x[i] - this.px[i]) * damp, vy = (this.y[i] - this.py[i]) * damp;
        this.px[i] = this.x[i]; this.py[i] = this.y[i];
        this.x[i] += vx + fx * h * h; this.y[i] += vy + fy * h * h;
      }
      for (let i = 1; i < this.n; i++) {
        const dx = this.x[i] - this.x[i - 1], dy = this.y[i] - this.y[i - 1];
        const d = Math.hypot(dx, dy) || 0.0001;
        const m = this.seg / d;
        this.x[i] = this.x[i - 1] + dx * m; this.y[i] = this.y[i - 1] + dy * m;
      }
    }
    this.ax = ax; this.ay = ay;
  }

  /** 暂停（顿帧）时只跟着锚点平移，不模拟 */
  private shift(ax: number, ay: number) {
    const dx = ax - this.ax, dy = ay - this.ay;
    if (dx === 0 && dy === 0) return;
    for (let i = 0; i < this.n; i++) { this.x[i] += dx; this.y[i] += dy; this.px[i] += dx; this.py[i] += dy; }
    this.ax = ax; this.ay = ay;
  }

  /**
   * 生成带宽度的布条轮廓。width(t) 为沿长度 0..1 的宽度；tatter>0 时末端剪成参差的布须。
   * seed 决定布须的形状，保证每条布看起来不一样。
   */
  ribbon(width: (t: number) => number, tatter = 0, seed = 0): Path2D {
    const n = this.n, L: Pt[] = [], R: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      let tx = this.x[i1] - this.x[i0], ty = this.y[i1] - this.y[i0];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const w = width(i / (n - 1)) / 2;
      L.push({ x: this.x[i] - ty * w, y: this.y[i] + tx * w });
      R.push({ x: this.x[i] + ty * w, y: this.y[i] - tx * w });
    }
    const p = new Path2D();
    p.moveTo(L[0].x, L[0].y);
    for (let i = 1; i < n; i++) { const m = { x: (L[i - 1].x + L[i].x) / 2, y: (L[i - 1].y + L[i].y) / 2 }; p.quadraticCurveTo(L[i - 1].x, L[i - 1].y, m.x, m.y); }
    p.lineTo(L[n - 1].x, L[n - 1].y);
    // 末端布须
    const a = L[n - 1], b = R[n - 1];
    if (tatter > 0) {
      const ex = this.x[n - 1] - this.x[n - 2], ey = this.y[n - 1] - this.y[n - 2];
      const el = Math.hypot(ex, ey) || 1;
      const ux = ex / el, uy = ey / el;
      const teeth = 4;
      for (let k = 1; k <= teeth * 2 - 1; k++) {
        const t = k / (teeth * 2);
        const bx = a.x + (b.x - a.x) * t, by = a.y + (b.y - a.y) * t;
        const len = k % 2 ? tatter * (0.5 + 0.5 * frac(Math.sin(seed * 12.9 + k * 78.2) * 43758.5)) : tatter * 0.1;
        p.lineTo(bx + ux * len, by + uy * len);
      }
    }
    p.lineTo(b.x, b.y);
    for (let i = n - 1; i > 0; i--) { const m = { x: (R[i].x + R[i - 1].x) / 2, y: (R[i].y + R[i - 1].y) / 2 }; p.quadraticCurveTo(R[i].x, R[i].y, m.x, m.y); }
    p.lineTo(R[0].x, R[0].y);
    p.closePath();
    return p;
  }

  /** 沿绳画线（细绳、流苏） */
  line(ctx: CanvasRenderingContext2D) {
    ctx.beginPath(); ctx.moveTo(this.x[0], this.y[0]);
    for (let i = 1; i < this.n; i++) ctx.lineTo(this.x[i], this.y[i]);
    ctx.stroke();
  }
}

function frac(v: number) { return v - Math.floor(v); }

/** 模型共享的时间步：根据关卡时间差推进布料，暂停/顿帧时 dt=0 */
export class Clock {
  private last = -1;
  tick(time: number) {
    const dt = this.last < 0 ? 0 : Math.max(0, Math.min(0.05, time - this.last));
    this.last = time;
    return dt;
  }
}

/** 确定性的伪随机（细节纹理用，避免每帧闪烁） */
export function h01(a: number, b = 0) { return frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453); }

/** 在局部空间画世界空间的东西（布料） */
export function inWorld(ctx: CanvasRenderingContext2D, base: DOMMatrix, fn: () => void) {
  ctx.save(); ctx.setTransform(base); fn(); ctx.restore();
}
