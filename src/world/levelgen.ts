// 箱庭关卡生成：
// 1. 在房间网格上随机走出一条「从顶行到底行」的主路径（只会向左右或向下）
// 2. 旁支房间以一定概率横向接入，作为可选探索区（遗骸、捷径）
// 3. 每个房间套用随机模板并随机镜像，然后按连通关系开凿出入口
// 4. Boss 关在最底下额外接一个竞技场
// 5. 用近似的跳跃可达性 BFS 验证起点能抵达出口，失败则换种子重来
import { ROOM_H, ROOM_W, TILE } from '../config';
import { clamp } from '../core/math';
import { RNG } from '../core/rng';
import type { EnemyKind, LevelConfig } from '../data/chapters';
import { ROOMS, START_ROOM, type RoomTemplate } from './rooms';
import { T, TileMap } from './tilemap';

export interface Point { x: number; y: number }
export interface Spawn { kind: EnemyKind; x: number; y: number }
export interface Arena {
  x0: number; x1: number; y0: number; floorY: number;
  gate: { tx: number; ty: number }[];
  boss: Point;
  pit: { tx0: number; tx1: number; ty0: number; ty1: number };
}
export interface LevelData {
  seed: number;
  map: TileMap;
  start: Point;
  shrines: Point[];
  spawns: Spawn[];
  caches: Point[];
  /** 碑文的位置（每层最多两块） */
  steles: Point[];
  lanterns: Point[];
  chains: { x: number; y: number; len: number; heavy?: boolean }[];
  /** 出口（深渊）的世界 x 坐标，用于画光 */
  exitX: number | null;
  exitY: number | null;
  arena: Arena | null;
}

interface Marker { ch: string; tx: number; ty: number }
interface Cell { used: boolean; path: boolean; start: boolean; exit: boolean; L: boolean; R: boolean; T: boolean; B: boolean; markers: Marker[] }

export function generateLevel(cfg: LevelConfig, seed: number): LevelData {
  for (let attempt = 0; attempt < 60; attempt++) {
    const d = tryBuild(cfg, (seed + attempt * 7919) >>> 0);
    if (d) return d;
  }
  throw new Error('关卡生成失败');
}

function tryBuild(cfg: LevelConfig, seed: number): LevelData | null {
  const rng = new RNG(seed);
  const C = cfg.cols, R = cfg.rows, isBoss = cfg.kind === 'boss';
  const W = C * ROOM_W, H = (R + (isBoss ? 1 : 0)) * ROOM_H;
  const map = new TileMap(W, H, T.Solid);
  const cells: Cell[][] = Array.from({ length: R }, () =>
    Array.from({ length: C }, () => ({ used: false, path: false, start: false, exit: false, L: false, R: false, T: false, B: false, markers: [] as Marker[] })));

  // ---------- 主路径 ----------
  let x = rng.int(0, C - 1), y = 0;
  const path: { c: number; r: number }[] = [{ c: x, r: y }];
  cells[y][x].used = cells[y][x].path = cells[y][x].start = true;
  let dir = rng.chance(0.5) ? -1 : 1;
  let exit = { c: x, r: y };
  for (let guard = 0; guard < 300; guard++) {
    let down = rng.chance(0.26);
    if (!down) {
      const nx = x + dir;
      if (nx < 0 || nx >= C) down = true;
      else {
        if (dir > 0) { cells[y][x].R = true; cells[y][nx].L = true; } else { cells[y][x].L = true; cells[y][nx].R = true; }
        x = nx; cells[y][x].used = cells[y][x].path = true; path.push({ c: x, r: y });
        continue;
      }
    }
    if (y === R - 1) { exit = { c: x, r: y }; break; }
    cells[y][x].B = true; cells[y + 1][x].T = true;
    y++; cells[y][x].used = cells[y][x].path = true; path.push({ c: x, r: y });
    dir = rng.chance(0.5) ? -1 : 1;
  }
  if (path.length < Math.ceil(C * R * 0.45)) return null;
  const exitCell = cells[exit.r][exit.c];
  exitCell.exit = true; exitCell.B = true;

  // ---------- 旁支房间 ----------
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cell = cells[r][c];
      if (cell.used || !rng.chance(0.62)) continue;
      const opts: number[] = [];
      if (c > 0 && cells[r][c - 1].used) opts.push(-1);
      if (c < C - 1 && cells[r][c + 1].used) opts.push(1);
      if (!opts.length) continue;
      const d = rng.pick(opts);
      cell.used = true;
      if (d < 0) { cell.L = true; cells[r][c - 1].R = true; } else { cell.R = true; cells[r][c + 1].L = true; }
    }
  }

  // ---------- 套模板 ----------
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const cell = cells[r][c];
    if (!cell.used) continue;
    const tpl = cell.start ? START_ROOM : rng.pick(ROOMS);
    stamp(map, cell, tpl, rng.chance(0.5), c * ROOM_W, r * ROOM_H, rng);
  }
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const cell = cells[r][c];
    if (cell.used) carveExits(map, cell, c * ROOM_W, r * ROOM_H);
  }

  // ---------- Boss 竞技场 ----------
  let arena: Arena | null = null;
  if (isBoss) {
    const oy = R * ROOM_H;
    const holeTx = exit.c * ROOM_W + 15;
    const ax0 = clamp(holeTx - 20, 0, W - 40), ax1 = ax0 + 40;
    for (let ty = oy + 1; ty <= oy + 14; ty++) for (let tx = ax0 + 1; tx <= ax1 - 2; tx++) map.set(tx, ty, T.Empty);
    for (let tx = ax0 + 7; tx <= ax0 + 12; tx++) map.set(tx, oy + 10, T.OneWay);
    for (let tx = ax1 - 13; tx <= ax1 - 8; tx++) map.set(tx, oy + 10, T.OneWay);
    const gate: { tx: number; ty: number }[] = [];
    for (let tx = exit.c * ROOM_W + 12; tx <= exit.c * ROOM_W + 17; tx++) { map.set(tx, oy, T.Gate); gate.push({ tx, ty: oy }); }
    const hx = holeTx * TILE, mid = (ax0 + 20) * TILE;
    arena = {
      x0: (ax0 + 1) * TILE, x1: (ax1 - 1) * TILE, y0: (oy + 1) * TILE, floorY: (oy + 15) * TILE,
      gate,
      boss: { x: hx < mid ? (ax1 - 9) * TILE : (ax0 + 9) * TILE, y: (oy + 15) * TILE },
      pit: { tx0: ax0 + 18, tx1: ax0 + 21, ty0: oy + 15, ty1: oy + 16 },
    };
  }

  // ---------- 标记点 → 实体 ----------
  const startCell = cells[path[0].r][path[0].c];
  const pMark = startCell.markers.find((m) => m.ch === 'P');
  if (!pMark) return null;
  const start = { x: pMark.tx * TILE + TILE / 2, y: (pMark.ty + 1) * TILE };

  const standable = (tx: number, ty: number) =>
    !blocks(map, tx, ty) && !blocks(map, tx, ty - 1) && (map.solid(tx, ty + 1) || map.get(tx, ty + 1) === T.OneWay);
  const groundBelow = (tx: number, ty: number) => {
    for (let yy = ty; yy < Math.min(map.h, ty + 8); yy++) {
      const v = map.get(tx, yy + 1);
      if (v === T.Spike) return -1;
      if (v === T.Solid || v === T.OneWay) return standable(tx, yy) ? yy : -1;
    }
    return -1;
  };
  const shrineSpot = (cell: Cell, c: number, r: number): Point | null => {
    const s = cell.markers.find((m) => m.ch === 'S' && standable(m.tx, m.ty));
    if (s) return { x: s.tx * TILE + TILE / 2, y: (s.ty + 1) * TILE };
    const cand: Point[] = [];
    for (let ry = 2; ry <= 14; ry++) for (let rx = 3; rx <= 26; rx++) {
      if (rx >= 11 && rx <= 18) continue;
      const tx = c * ROOM_W + rx, ty = r * ROOM_H + ry;
      if (standable(tx, ty) && map.solid(tx, ty + 1)) cand.push({ x: tx * TILE + TILE / 2, y: (ty + 1) * TILE });
    }
    return cand.length ? rng.pick(cand) : null;
  };

  const shrines: Point[] = [];
  const s0 = shrineSpot(startCell, path[0].c, path[0].r);
  if (!s0) return null;
  shrines.push(s0);
  const midIdx = isBoss ? path.length - 1 : Math.max(1, Math.floor(path.length * 0.6));
  if (midIdx > 0 && midIdx < path.length) {
    const p = path[midIdx];
    const s1 = shrineSpot(cells[p.r][p.c], p.c, p.r);
    if (s1) shrines.push(s1);
  }

  // 敌人
  const spawns: Spawn[] = [];
  const groundKinds: Partial<Record<EnemyKind, number>> = {};
  if (cfg.pool.pilgrim) groundKinds.pilgrim = cfg.pool.pilgrim;
  if (cfg.pool.guard) groundKinds.guard = cfg.pool.guard;
  const cands: { m: Marker; key: string; w: number; used?: boolean }[] = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const cell = cells[r][c];
    if (!cell.used || cell.start || (isBoss && cell.exit)) continue;
    for (const m of cell.markers) if ('egf'.includes(m.ch)) cands.push({ m, key: `${c},${r}`, w: cell.path ? 1 : 0.7 });
  }
  rng.shuffle(cands);
  cands.sort((a, b) => b.w - a.w + (rng.next() - 0.5) * 0.8);
  // 按权重分配各类敌人的名额，避免某种模板标记过多导致比例失衡
  const quota: Partial<Record<EnemyKind, number>> = {};
  const kinds = Object.keys(cfg.pool) as EnemyKind[];
  const wsum = kinds.reduce((t, k) => t + (cfg.pool[k] ?? 0), 0);
  let given = 0;
  for (const k of kinds) { quota[k] = Math.floor(cfg.enemies * (cfg.pool[k] ?? 0) / wsum); given += quota[k]!; }
  while (given < cfg.enemies) { const k = rng.weighted(cfg.pool) ?? 'pilgrim'; quota[k] = (quota[k] ?? 0) + 1; given++; }
  const pickGround = (prefer?: EnemyKind): EnemyKind | null => {
    if (prefer && (quota[prefer] ?? 0) > 0) return prefer;
    const w: Partial<Record<EnemyKind, number>> = {};
    for (const k of ['pilgrim', 'guard'] as EnemyKind[]) if ((quota[k] ?? 0) > 0) w[k] = groundKinds[k] ?? 1;
    return rng.weighted(w);
  };
  const perRoom = new Map<string, number>();
  for (let pass = 0; pass < 2; pass++) {
    for (const c of cands) {
      const { m, key } = c;
      if (spawns.length >= cfg.enemies) break;
      if ((perRoom.get(key) ?? 0) >= 3 || c.used) continue;
      // 灯龛附近留出安全区
      const mx = m.tx * TILE + TILE / 2, my = (m.ty + 1) * TILE;
      if (shrines.some((sh) => Math.abs(sh.x - mx) < 8 * TILE && Math.abs(sh.y - my) < 4 * TILE)) continue;
      let kind: EnemyKind | null;
      if (m.ch === 'f') kind = (quota.moth ?? 0) > 0 ? 'moth' : pass ? pickGround() : null;
      else kind = pickGround(m.ch === 'g' ? 'guard' : undefined);
      if (!kind) continue;
      let py = (m.ty + 1) * TILE;
      if (kind !== 'moth') {
        const gy = groundBelow(m.tx, m.ty);
        if (gy < 0) continue;
        py = (gy + 1) * TILE;
      }
      c.used = true;
      quota[kind] = (quota[kind] ?? 0) - 1;
      spawns.push({ kind, x: m.tx * TILE + TILE / 2, y: py });
      perRoom.set(key, (perRoom.get(key) ?? 0) + 1);
    }
  }

  // 遗骸
  const caches: Point[] = [];
  const cacheCands: { m: Marker; side: boolean }[] = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const cell = cells[r][c];
    if (!cell.used || cell.start) continue;
    for (const m of cell.markers) if (m.ch === '$') cacheCands.push({ m, side: !cell.path });
  }
  rng.shuffle(cacheCands).sort((a, b) => Number(b.side) - Number(a.side));
  for (const { m, side } of cacheCands) {
    if (caches.length >= cfg.loot) break;
    if (!side && !rng.chance(0.4)) continue;
    const gy = groundBelow(m.tx, m.ty);
    if (gy >= 0) caches.push({ x: m.tx * TILE + TILE / 2, y: (gy + 1) * TILE });
  }

  // 装饰
  const lanterns: Point[] = [];
  const chains: { x: number; y: number; len: number; heavy?: boolean }[] = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const cell = cells[r][c];
    if (!cell.used) continue;
    for (const m of cell.markers) if (m.ch === 'L') lanterns.push({ x: m.tx * TILE + TILE / 2, y: m.ty * TILE });
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const tx = c * ROOM_W + rng.int(2, 27);
      for (let ty = r * ROOM_H + 1; ty < r * ROOM_H + 8; ty++) {
        if (!map.solid(tx, ty) && map.solid(tx, ty - 1)) {
          chains.push({ x: tx * TILE + rng.range(6, 26), y: ty * TILE, len: rng.range(40, 170) });
          break;
        }
      }
    }
  }

  // 悬石：底下留一格可钻空隙的石块，用两根粗铁链吊在上方的岩顶上，让它「为什么悬在那儿」一目了然
  const hung: { x: number; y: number; len: number; heavy: true }[] = [];
  const seen = new Set<number>();
  for (let ty = 1; ty < map.h - 2; ty++) for (let tx = 1; tx < map.w - 1; tx++) {
    if (!map.solid(tx, ty) || map.solid(tx, ty + 1) || !map.solid(tx, ty + 2) || seen.has(ty * map.w + tx)) continue;
    // 这一行底边连续的一段
    let x1 = tx;
    while (x1 + 1 < map.w && map.solid(x1 + 1, ty) && !map.solid(x1 + 1, ty + 1) && map.solid(x1 + 1, ty + 2)) x1++;
    for (let x = tx; x <= x1; x++) seen.add(ty * map.w + x);
    // 石块顶面
    let top = ty;
    while (top > 0 && map.solid(tx, top - 1)) top--;
    if (top <= 1 || top < ty - 4) continue;
    for (const cx of x1 > tx ? [tx, x1] : [tx]) {
      let c = top - 1;
      while (c > 0 && !map.solid(cx, c)) c--;
      if (top - c > 1 && top - c < 14) hung.push({ x: cx * TILE + TILE / 2, y: (c + 1) * TILE, len: (top - c - 1) * TILE + 4, heavy: true });
    }
  }
  chains.push(...hung);

  // ---------- 可达性验证 ----------
  const goalRow = isBoss ? R * ROOM_H + 1 : null;
  if (!reachable(map, pMark.tx, pMark.ty, goalRow)) return null;

  // 碑文：用独立的随机流，不扰动上面的生成结果。优先放在主路径上、远离灯龛/遗骸/敌人的地面。
  const srng = new RNG((seed ^ 0x51e1e) >>> 0);
  const steles: Point[] = [];
  const taken = [...shrines, ...caches, ...spawns];
  const cellOrder: { c: number; r: number; w: number }[] = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const cell = cells[r][c];
    if (cell.used && !cell.start) cellOrder.push({ c, r, w: (cell.path ? 1 : 0.4) + srng.next() * 0.6 });
  }
  cellOrder.sort((a, b) => b.w - a.w);
  for (const { c, r } of cellOrder) {
    if (steles.length >= 2) break;
    const cand: Point[] = [];
    for (let ry = 2; ry <= 14; ry++) for (let rx = 3; rx <= 26; rx++) {
      const tx = c * ROOM_W + rx, ty = r * ROOM_H + ry;
      if (!standable(tx, ty) || !map.solid(tx, ty + 1) || !map.solid(tx - 1, ty + 1) || !map.solid(tx + 1, ty + 1)) continue;
      const pt = { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE };
      if ([...taken, ...steles].some((q) => Math.abs(q.x - pt.x) < 6 * TILE && Math.abs(q.y - pt.y) < 3 * TILE)) continue;
      cand.push(pt);
    }
    if (cand.length) steles.push(srng.pick(cand));
  }

  const exitX = (exit.c * ROOM_W + 15) * TILE;
  return {
    seed, map, start, shrines, spawns, caches, steles, lanterns, chains, arena,
    exitX: isBoss ? null : exitX,
    exitY: isBoss ? null : (exit.r * ROOM_H + 15) * TILE,
  };
}

function stamp(map: TileMap, cell: Cell, tpl: RoomTemplate, flip: boolean, ox: number, oy: number, rng: RNG) {
  for (let ry = 0; ry < ROOM_H; ry++) {
    const row = tpl[ry] ?? '';
    for (let rx = 0; rx < ROOM_W; rx++) {
      const ch = row[flip ? ROOM_W - 1 - rx : rx] ?? '#';
      const tx = ox + rx, ty = oy + ry;
      switch (ch) {
        case '#': map.set(tx, ty, T.Solid); break;
        case '?': map.set(tx, ty, rng.chance(0.5) ? T.Solid : T.Empty); break;
        case '=': map.set(tx, ty, T.OneWay); break;
        case '^': map.set(tx, ty, T.Spike); break;
        case '.': map.set(tx, ty, T.Empty); break;
        default: map.set(tx, ty, T.Empty); cell.markers.push({ ch, tx, ty });
      }
    }
  }
}

function carveExits(map: TileMap, cell: Cell, ox: number, oy: number) {
  const set = (x: number, y: number, v: (typeof T)[keyof typeof T]) => map.set(ox + x, oy + y, v);
  const get = (x: number, y: number) => map.get(ox + x, oy + y);
  const side = (open: boolean, x0: number, x1: number, edge: number) => {
    if (open) {
      for (let y = 11; y <= 14; y++) for (let x = x0; x <= x1; x++) set(x, y, T.Empty);
      for (let x = x0; x <= x1; x++) { set(x, 15, T.Solid); set(x, 16, T.Solid); }
    } else for (let y = 0; y < ROOM_H; y++) set(edge, y, T.Solid);
  };
  side(cell.L, 0, 2, 0);
  side(cell.R, ROOM_W - 3, ROOM_W - 1, ROOM_W - 1);
  if (cell.T) { for (let y = 0; y <= 6; y++) for (let x = 12; x <= 17; x++) if (get(x, y) === T.Solid) set(x, y, T.Empty); }
  else for (let x = 0; x < ROOM_W; x++) set(x, 0, T.Solid);
  if (cell.B) { for (let y = 13; y < ROOM_H; y++) for (let x = 12; x <= 17; x++) set(x, y, T.Empty); }
  else for (let x = 0; x < ROOM_W; x++) set(x, ROOM_H - 1, T.Solid);
}

function blocks(map: TileMap, tx: number, ty: number) {
  return map.get(tx, ty) === T.Solid || map.get(tx, ty) === T.Spike;
}

/** 近似跳跃可达性：最多上跳 4 格、平跳 5 格。goalRow 为 null 时以「掉出地图底部」为终点。 */
export function reachable(map: TileMap, sx: number, sy: number, goalRow: number | null): boolean {
  const W = map.w, H = map.h;
  const vis = new Uint8Array(W * H);
  const blocked = (x: number, y: number) => blocks(map, x, y);
  const support = (x: number, y: number) => { const v = map.get(x, y); return v === T.Solid || v === T.OneWay; };
  const standable = (x: number, y: number) => x >= 0 && x < W && y >= 1 && y < H && !blocked(x, y) && !blocked(x, y - 1) && support(x, y + 1);
  const q: number[] = [];
  let head = 0, found = false;
  const push = (x: number, y: number) => {
    const i = y * W + x;
    if (vis[i]) return;
    vis[i] = 1; q.push(i);
    if (goalRow !== null && y >= goalRow) found = true;
  };
  const fall = (x: number, y: number) => {
    for (let yy = y; ; yy++) {
      if (yy >= H) { if (goalRow === null) found = true; return; }
      if (blocked(x, yy)) return;
      if (standable(x, yy)) { push(x, yy); return; }
    }
  };
  const clear = (x: number, y: number, tx: number, ty: number) => {
    const arc = Math.min(y, ty) - 2;
    for (let r = arc; r <= y - 1; r++) if (blocked(x, r)) return false;
    const s = Math.sign(tx - x);
    for (let cx = x; cx !== tx; cx += s) if (blocked(cx, arc) || blocked(cx, arc + 1)) return false;
    for (let r = arc; r <= ty; r++) if (blocked(tx, r)) return false;
    return true;
  };
  let y0 = sy;
  while (y0 < H && !standable(sx, y0)) y0++;
  if (y0 >= H) return false;
  push(sx, y0);
  while (head < q.length && !found) {
    const i = q[head++], x = i % W, y = (i / W) | 0;
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      if (nx < 0 || nx >= W) continue;
      if (standable(nx, y)) push(nx, y);
      else if (!blocked(nx, y) && !blocked(nx, y - 1)) fall(nx, y);
    }
    if (map.get(x, y + 1) === T.OneWay) fall(x, y + 1);
    for (let dy = -4; dy <= 3; dy++) {
      const lim = dy <= -4 ? 3 : dy === -3 ? 4 : 5;
      for (let dx = -lim; dx <= lim; dx++) {
        if (dx === 0) continue;
        const tx = x + dx, ty = y + dy;
        if (standable(tx, ty) && !vis[ty * W + tx] && clear(x, y, tx, ty)) push(tx, ty);
      }
    }
  }
  return found;
}
