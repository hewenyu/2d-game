import type { Rect } from '../core/math';

export type HitKind = 'slash' | 'pogo' | 'throw' | 'rip' | 'recall';
export interface HitInfo {
  dmg: number;
  poise: number;
  kind: HitKind;
  /** 攻击来源点（用于盾牌判定与击退方向） */
  x: number;
  y: number;
  id: number;
}
export type HitResult = 'hit' | 'kill' | 'blocked' | 'immune' | 'none';

export interface AttackBox { box: Rect; dmg: number; id: number; cause: string; hit: boolean; knock?: number }
