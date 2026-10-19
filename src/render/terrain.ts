// 地形渲染：沉寺的砖石基座 + 切割整齐的石板沿 + 朱漆木梁平台 + 铜戟尖刺。
// 每 16×16 格为一个区块，预先构建 Path2D，运行时只绘制可见区块（任何分辨率下都清晰）。
import { TILE } from '../config';
import type { Camera } from '../core/camera';
import { hash01 } from '../core/rng';
import type { Biome } from '../world/biomes';
import { T, TileMap } from '../world/tilemap';

const CH = 16;

interface Chunk {
  solid: Path2D; tex: Path2D; crack: Path2D; drip: Path2D; cap: Path2D; capHi: Path2D;
  edge: Path2D; moss: Path2D; plat: Path2D; platHi: Path2D; spike: Path2D;
  seam: Path2D; joint: Path2D; beamEnd: Path2D;
}

export class TerrainRenderer {
  private chunks: (Chunk | null)[] = [];
  private cw: number;
  private chh: number;

  constructor(private map: TileMap, private biome: Biome) {
    this.cw = Math.ceil(map.w / CH);
    this.chh = Math.ceil(map.h / CH);
    for (let cy = 0; cy < this.chh; cy++) for (let cx = 0; cx < this.cw; cx++) this.chunks.push(this.build(cx, cy));
  }

  private build(cx: number, cy: number): Chunk {
    const m = this.map;
    const c: Chunk = {
      solid: new Path2D(), tex: new Path2D(), crack: new Path2D(), drip: new Path2D(), cap: new Path2D(), capHi: new Path2D(),
      edge: new Path2D(), moss: new Path2D(), plat: new Path2D(), platHi: new Path2D(), spike: new Path2D(),
      seam: new Path2D(), joint: new Path2D(), beamEnd: new Path2D(),
    };
    const isS = (x: number, y: number) => m.get(x, y) === T.Solid || x < 0 || x >= m.w || y >= m.h;
    const nearAir = (x: number, y: number) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (!isS(x + dx, y + dy) && m.get(x + dx, y + dy) !== T.Gate) return true; return false; };
    const jit = (x: number, y: number) => (hash01(x, y, 7) - 0.5) * 3;
    for (let ty = cy * CH; ty < Math.min(m.h, (cy + 1) * CH); ty++) {
      // 合并实心横条
      let run = -1;
      for (let tx = cx * CH; tx <= Math.min(m.w, (cx + 1) * CH); tx++) {
        const s = tx < Math.min(m.w, (cx + 1) * CH) && isS(tx, ty);
        if (s && run < 0) run = tx;
        if (!s && run >= 0) { c.solid.rect(run * TILE - 0.3, ty * TILE - 0.3, (tx - run) * TILE + 0.6, TILE + 0.6); run = -1; }
      }
      for (let tx = cx * CH; tx < Math.min(m.w, (cx + 1) * CH); tx++) {
        const v = m.get(tx, ty), X = tx * TILE, Y = ty * TILE;
        const h = hash01(tx, ty, 1), h2 = hash01(tx, ty, 2), h3 = hash01(tx, ty, 3);
        if (v === T.Solid) {
          // 靠近表面的砖缝：两皮砖一格，上下错缝
          if (nearAir(tx, ty)) {
            c.seam.moveTo(X, Y + TILE / 2); c.seam.lineTo(X + TILE, Y + TILE / 2);
            c.seam.moveTo(X, Y + TILE); c.seam.lineTo(X + TILE, Y + TILE);
            const off = (ty % 2) * TILE / 2;
            c.seam.moveTo(X + off, Y); c.seam.lineTo(X + off, Y + TILE / 2);
            c.seam.moveTo(X + TILE / 2 - off, Y + TILE / 2); c.seam.lineTo(X + TILE / 2 - off, Y + TILE);
          }
          const up = isS(tx, ty - 1) || m.get(tx, ty - 1) === T.Gate, down = isS(tx, ty + 1) || ty + 1 >= m.h;
          const left = isS(tx - 1, ty), right = isS(tx + 1, ty);
          if (up && down && left && right) {
            if (h < 0.2) c.tex.ellipse(X + h2 * TILE, Y + h3 * TILE, 4 + h * 30, 3 + h2 * 6, h3 * 3, 0, Math.PI * 2);
            if (h > 0.93) { c.crack.moveTo(X + h2 * 20, Y + 4); c.crack.lineTo(X + 16, Y + 16); c.crack.lineTo(X + 8 + h3 * 20, Y + 30); }
            continue;
          }
          if (!up) {
            // 石板沿：顶面平直，两端倒角，每两格一道接缝
            const yl = Y - 1 + jit(tx, ty) * 0.25, yr = Y - 1 + jit(tx + 1, ty) * 0.25;
            c.cap.moveTo(left ? X : X + 4, yl);
            c.cap.lineTo(right ? X + TILE : X + TILE - 4, yr);
            if (!right) c.cap.lineTo(X + TILE + 1, yr + 4);
            c.cap.lineTo(right ? X + TILE : X + TILE + 1, Y + 9);
            c.cap.lineTo(left ? X : X - 1, Y + 9);
            if (!left) c.cap.lineTo(X - 1, yl + 4);
            c.cap.closePath();
            c.capHi.moveTo(left ? X : X + 4, yl + 0.5);
            c.capHi.lineTo(right ? X + TILE : X + TILE - 4, yr + 0.5);
            if ((tx + Math.floor(h * 2)) % 2 === 0 && left) { c.joint.moveTo(X, yl + 1); c.joint.lineTo(X, Y + 9); }
            if (h3 > 0.85) { c.joint.moveTo(X + 6 + h * 14, yl + 1); c.joint.lineTo(X + 9 + h * 14, Y + 5); c.joint.lineTo(X + 7 + h * 14, Y + 9); }
            // 苔草
            if (h2 > 0.6) {
              const n = 2 + Math.floor(h3 * 4);
              for (let k = 0; k < n; k++) {
                const bx = X + 3 + hash01(tx, ty, 20 + k) * (TILE - 6), bh = 3 + hash01(tx, ty, 30 + k) * 8, lean = (hash01(tx, ty, 40 + k) - 0.5) * 6;
                c.moss.moveTo(bx, Y + 1); c.moss.quadraticCurveTo(bx + lean * 0.3, Y - bh * 0.6, bx + lean, Y - bh);
              }
            }
          }
          if (!down) {
            c.edge.moveTo(X, Y + TILE - 1); c.edge.lineTo(X + TILE, Y + TILE - 1);
            if (h > 0.8) {
              const a = 4 + h2 * 16, w = 3 + h3 * 4, len = 4 + h * 10;
              c.drip.moveTo(X + a, Y + TILE - 1); c.drip.lineTo(X + a + w, Y + TILE - 1); c.drip.lineTo(X + a + w * 0.45, Y + TILE + len); c.drip.closePath();
            }
          }
          if (!left) { c.edge.moveTo(X + 1, Y + (up ? 0 : 9)); c.edge.lineTo(X + 1, Y + TILE); }
          if (!right) { c.edge.moveTo(X + TILE - 1, Y + (up ? 0 : 9)); c.edge.lineTo(X + TILE - 1, Y + TILE); }
        } else if (v === T.OneWay) {
          const l = m.get(tx - 1, ty) !== T.OneWay, r = m.get(tx + 1, ty) !== T.OneWay;
          // 朱漆木梁：两端套铜帽，下方是雀替托木
          c.plat.rect(X, Y, TILE, 9);
          c.platHi.moveTo(X, Y + 0.5); c.platHi.lineTo(X + TILE, Y + 0.5);
          if (l) { c.beamEnd.rect(X - 2, Y - 1, 6, 11); c.plat.moveTo(X + 4, Y + 9); c.plat.lineTo(X + 16, Y + 9); c.plat.quadraticCurveTo(X + 8, Y + 11, X + 5, Y + 20); c.plat.lineTo(X + 4, Y + 20); c.plat.closePath(); }
          if (r) { c.beamEnd.rect(X + TILE - 4, Y - 1, 6, 11); c.plat.moveTo(X + TILE - 4, Y + 9); c.plat.lineTo(X + TILE - 16, Y + 9); c.plat.quadraticCurveTo(X + TILE - 8, Y + 11, X + TILE - 5, Y + 20); c.plat.lineTo(X + TILE - 4, Y + 20); c.plat.closePath(); }
          if (!l && !r && h > 0.7) { c.joint.moveTo(X + 16, Y + 1); c.joint.lineTo(X + 16, Y + 9); }
        } else if (v === T.Spike) {
          const base = Y + TILE;
          // 一排倒插的铜戟头
          c.spike.rect(X, base - 4, TILE, 4);
          for (let k = 0; k < 3; k++) {
            const sx = X + 5 + k * 11, sh = 15 + hash01(tx, ty, 50 + k) * 7;
            c.spike.moveTo(sx - 1.5, base - 4); c.spike.lineTo(sx - 1.5, base - sh * 0.55);
            c.spike.lineTo(sx - 4, base - sh * 0.62); c.spike.lineTo(sx, base - sh); c.spike.lineTo(sx + 4, base - sh * 0.62);
            c.spike.lineTo(sx + 1.5, base - sh * 0.55); c.spike.lineTo(sx + 1.5, base - 4); c.spike.closePath();
          }
        }
      }
    }
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const b = this.biome;
    const hw = cam.viewW / 2 + 40, hh = cam.viewH / 2 + 40;
    const x0 = Math.max(0, Math.floor((cam.x - hw) / (CH * TILE))), x1 = Math.min(this.cw - 1, Math.floor((cam.x + hw) / (CH * TILE)));
    const y0 = Math.max(0, Math.floor((cam.y - hh) / (CH * TILE))), y1 = Math.min(this.chh - 1, Math.floor((cam.y + hh) / (CH * TILE)));
    const vis: Chunk[] = [];
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const c = this.chunks[cy * this.cw + cx]; if (c) vis.push(c); }
    ctx.fillStyle = b.rock; for (const c of vis) ctx.fill(c.solid);
    ctx.fillStyle = b.rockTex; for (const c of vis) ctx.fill(c.tex);
    ctx.strokeStyle = b.rockTex; ctx.lineWidth = 1.5; for (const c of vis) ctx.stroke(c.crack);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.2; for (const c of vis) ctx.stroke(c.seam);
    ctx.strokeStyle = b.rockTex; ctx.lineWidth = 0.8; ctx.save(); ctx.translate(0, 1); for (const c of vis) ctx.stroke(c.seam); ctx.restore();
    ctx.fillStyle = b.rock; for (const c of vis) ctx.fill(c.drip);
    ctx.strokeStyle = b.rim; ctx.lineWidth = 2; for (const c of vis) ctx.stroke(c.edge);
    ctx.fillStyle = b.rim; for (const c of vis) ctx.fill(c.cap);
    ctx.strokeStyle = b.rimHi; ctx.lineWidth = 1.5; for (const c of vis) ctx.stroke(c.capHi);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; for (const c of vis) ctx.stroke(c.joint);
    ctx.strokeStyle = b.moss; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; for (const c of vis) ctx.stroke(c.moss);
    ctx.lineCap = 'butt';
    ctx.fillStyle = b.plat; for (const c of vis) ctx.fill(c.plat);
    ctx.strokeStyle = b.platHi; ctx.lineWidth = 1.5; for (const c of vis) ctx.stroke(c.platHi);
    ctx.fillStyle = '#8a6a3a'; for (const c of vis) ctx.fill(c.beamEnd);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; for (const c of vis) ctx.stroke(c.joint);
    ctx.fillStyle = '#a07a44'; ctx.strokeStyle = '#140c06'; ctx.lineWidth = 1.2;
    for (const c of vis) { ctx.fill(c.spike); ctx.stroke(c.spike); }
  }
}
