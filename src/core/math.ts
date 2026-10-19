export interface Rect { x: number; y: number; w: number; h: number }
export interface Vec { x: number; y: number }

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const approach = (v: number, t: number, d: number) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeIn = (t: number) => t * t * t;
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
/** 帧率无关的指数趋近系数 */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 线段与矩形相交（Liang–Barsky） */
export function segRect(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

export function circleRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const px = clamp(cx, rect.x, rect.x + rect.w), py = clamp(cy, rect.y, rect.y + rect.h);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

/** 矩形是否触碰到圆环带 [R - th/2, R + th/2] */
export function ringRect(cx: number, cy: number, R: number, th: number, rect: Rect): boolean {
  const px = clamp(cx, rect.x, rect.x + rect.w), py = clamp(cy, rect.y, rect.y + rect.h);
  const near = Math.hypot(px - cx, py - cy);
  const fx = Math.max(Math.abs(rect.x - cx), Math.abs(rect.x + rect.w - cx));
  const fy = Math.max(Math.abs(rect.y - cy), Math.abs(rect.y + rect.h - cy));
  const far = Math.hypot(fx, fy);
  return near <= R + th / 2 && far >= R - th / 2;
}
