import { TILE } from '../config';

export const T = { Empty: 0, Solid: 1, OneWay: 2, Spike: 3, Gate: 4 } as const;
export type TileId = (typeof T)[keyof typeof T];

export class TileMap {
  readonly data: Uint8Array;
  /** 门格（Boss 竞技场入口）是否封闭 */
  gateClosed = false;

  constructor(readonly w: number, readonly h: number, fill: TileId = T.Solid) {
    this.data = new Uint8Array(w * h).fill(fill);
  }
  get pxW() { return this.w * TILE; }
  get pxH() { return this.h * TILE; }

  /** 越界：左右上视为实心，下方视为空（可以跳进深渊进入下一层） */
  get(tx: number, ty: number): number {
    if (tx < 0 || tx >= this.w || ty < 0) return T.Solid;
    if (ty >= this.h) return T.Empty;
    return this.data[ty * this.w + tx];
  }
  set(tx: number, ty: number, v: TileId) {
    if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) this.data[ty * this.w + tx] = v;
  }
  solid(tx: number, ty: number): boolean {
    const v = this.get(tx, ty);
    return v === T.Solid || (v === T.Gate && this.gateClosed);
  }
  solidAt(px: number, py: number) { return this.solid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  spikeAt(px: number, py: number) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)) === T.Spike; }
}
