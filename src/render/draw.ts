// 通用绘图工具
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  if (a <= 0.003 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.4, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 加色混合的光晕 */
export function addGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r, rgb, a);
  ctx.globalCompositeOperation = op;
}

/** 四角星闪光：攻击即将落下的「破绽/危险」提示 */
export function glint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, rgb = '255,250,235') {
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r * 1.8, rgb, a * 0.55);
  ctx.fillStyle = `rgba(${rgb},${a})`;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();
  ctx.restore();
}

/** 钟形轮廓 */
export function bellPath(ctx: CanvasRenderingContext2D | Path2D, cx: number, top: number, w: number, h: number) {
  ctx.moveTo(cx - w * 0.16, top);
  ctx.quadraticCurveTo(cx - w * 0.36, top, cx - w * 0.36, top + h * 0.38);
  ctx.quadraticCurveTo(cx - w * 0.36, top + h * 0.78, cx - w * 0.5, top + h);
  ctx.lineTo(cx + w * 0.5, top + h);
  ctx.quadraticCurveTo(cx + w * 0.36, top + h * 0.78, cx + w * 0.36, top + h * 0.38);
  ctx.quadraticCurveTo(cx + w * 0.36, top, cx + w * 0.16, top);
  ctx.closePath();
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export const FONT = '"Songti SC","STSong","Noto Serif SC","Source Han Serif SC","SimSun",serif';

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', weight = '') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** 朱砂印章：方形红底，白文单字，四角略残 */
export function seal(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, ch: string, alpha = 0.9) {
  const h = size / 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#9e2a1c';
  ctx.beginPath();
  ctx.moveTo(cx - h + 1, cy - h); ctx.lineTo(cx + h, cy - h + 0.5); ctx.lineTo(cx + h - 0.5, cy + h - 1.5);
  ctx.lineTo(cx + h - 2, cy + h); ctx.lineTo(cx - h, cy + h - 0.5); ctx.lineTo(cx - h + 0.5, cy - h + 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(240,220,200,0.55)'; ctx.lineWidth = 1;
  ctx.strokeRect(cx - h + 2.5, cy - h + 2.5, size - 5, size - 5);
  text(ctx, ch, cx, cy + 0.5, size * 0.62, 'rgba(245,228,210,0.95)');
  ctx.restore();
}
