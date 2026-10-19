import { TILE } from '../config';
import type { Rect } from '../core/math';
import { T, TileMap } from './tilemap';

export interface Body { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean }
export interface MoveResult { hitX: boolean; wallDir: number; landed: boolean; ceiling: boolean }

/** AABB 与瓦片地图的分轴碰撞。platforms 为额外的单向平台（例如钉在墙上的刃）。 */
export function moveBody(b: Body, dt: number, map: TileMap, platforms: Rect[] = [], dropThrough = false): MoveResult {
  const res: MoveResult = { hitX: false, wallDir: 0, landed: false, ceiling: false };
  const wasGround = b.onGround;
  b.onGround = false;

  const dx = b.vx * dt;
  if (dx !== 0) {
    const steps = Math.ceil(Math.abs(dx) / 8), sx = Math.sign(dx);
    for (let i = 0; i < steps; i++) {
      b.x += dx / steps;
      if (collideX(b, map, sx)) { res.hitX = true; res.wallDir = sx; b.vx = 0; break; }
    }
  }
  const dy = b.vy * dt;
  if (dy !== 0) {
    const steps = Math.ceil(Math.abs(dy) / 8);
    for (let i = 0; i < steps; i++) {
      const prevBottom = b.y + b.h;
      b.y += dy / steps;
      if (dy > 0) {
        if (landY(b, map, prevBottom, platforms, dropThrough)) { b.onGround = true; b.vy = 0; res.landed = !wasGround; break; }
      } else if (ceilY(b, map)) { res.ceiling = true; b.vy = 0; break; }
    }
  }
  return res;
}

function rows(b: Body) { return [Math.floor(b.y / TILE), Math.floor((b.y + b.h - 0.001) / TILE)]; }
function cols(b: Body) { return [Math.floor(b.x / TILE), Math.floor((b.x + b.w - 0.001) / TILE)]; }

function collideX(b: Body, map: TileMap, dir: number): boolean {
  const [ty0, ty1] = rows(b);
  const tx = dir > 0 ? Math.floor((b.x + b.w - 0.001) / TILE) : Math.floor(b.x / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    if (map.solid(tx, ty)) { b.x = dir > 0 ? tx * TILE - b.w : (tx + 1) * TILE; return true; }
  }
  return false;
}

function landY(b: Body, map: TileMap, prevBottom: number, platforms: Rect[], drop: boolean): boolean {
  const bottom = b.y + b.h;
  const ty = Math.floor((bottom - 0.001) / TILE);
  const [tx0, tx1] = cols(b);
  const top = ty * TILE;
  for (let tx = tx0; tx <= tx1; tx++) {
    if (map.solid(tx, ty)) { b.y = top - b.h; return true; }
    if (!drop && map.get(tx, ty) === T.OneWay && prevBottom <= top + 0.5) { b.y = top - b.h; return true; }
  }
  if (!drop) for (const p of platforms) {
    if (prevBottom <= p.y + 0.5 && bottom >= p.y && b.x + b.w > p.x && b.x < p.x + p.w) { b.y = p.y - b.h; return true; }
  }
  return false;
}

function ceilY(b: Body, map: TileMap): boolean {
  const ty = Math.floor(b.y / TILE);
  const [tx0, tx1] = cols(b);
  for (let tx = tx0; tx <= tx1; tx++) if (map.solid(tx, ty)) { b.y = (ty + 1) * TILE; return true; }
  return false;
}

/** 身体（略内缩）是否碰到尖刺 */
export function touchesSpike(b: Rect, map: TileMap): boolean {
  const x0 = Math.floor((b.x + 4) / TILE), x1 = Math.floor((b.x + b.w - 4) / TILE);
  const y0 = Math.floor((b.y + 4) / TILE), y1 = Math.floor((b.y + b.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (map.get(tx, ty) === T.Spike) {
      // 尖刺只占格子下半部分
      if (b.y + b.h > ty * TILE + TILE * 0.45) return true;
    }
  }
  return false;
}

/** 站立处是否为坚实地面（用于记录安全落脚点） */
export function solidGroundUnder(b: Rect, map: TileMap): boolean {
  const ty = Math.floor((b.y + b.h + 2) / TILE);
  const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.001) / TILE);
  for (let tx = x0; tx <= x1; tx++) if (!map.solid(tx, ty)) return false;
  for (let tx = x0 - 1; tx <= x1 + 1; tx++) if (map.get(tx, ty) === T.Spike || map.get(tx, ty - 1) === T.Spike) return false;
  return true;
}
