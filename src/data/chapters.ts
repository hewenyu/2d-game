// 关卡进程配置。往后加关卡：在 levels 里追加一项；加章节：追加一个 ChapterConfig。
import type { BiomeId } from '../world/biomes';

export type EnemyKind = 'pilgrim' | 'guard' | 'moth';
export type BossKind = 'bellkeeper';

export interface LevelConfig {
  kind: 'normal' | 'boss';
  /** 房间网格列数 / 行数（每个房间 30×17 格） */
  cols: number;
  rows: number;
  /** 敌人数量 */
  enemies: number;
  /** 敌人种类权重 */
  pool: Partial<Record<EnemyKind, number>>;
  /** 遗骸（余烬宝箱）上限 */
  loot: number;
  /** 敌人血量倍率 */
  hpScale?: number;
  boss?: BossKind;
  /** Boss 强化版（更快、更多血、一开始就会钟鸣） */
  elite?: boolean;
}

export interface ChapterConfig {
  name: string;
  biome: BiomeId;
  levels: LevelConfig[];
}

export const CHAPTERS: ChapterConfig[] = [
  {
    name: '沉钟寺 · 外墓',
    biome: 'crypt',
    levels: [
      { kind: 'normal', cols: 4, rows: 3, enemies: 7, pool: { pilgrim: 3, moth: 1 }, loot: 3 },
      { kind: 'normal', cols: 4, rows: 3, enemies: 10, pool: { pilgrim: 3, moth: 1.5, guard: 1.6 }, loot: 3 },
      { kind: 'boss', cols: 3, rows: 2, enemies: 5, pool: { pilgrim: 2, moth: 1, guard: 1 }, loot: 2, boss: 'bellkeeper' },
    ],
  },
  {
    name: '溺钟渊',
    biome: 'abyss',
    levels: [
      { kind: 'normal', cols: 4, rows: 4, enemies: 13, pool: { pilgrim: 2, moth: 2, guard: 2 }, loot: 4, hpScale: 1.3 },
      { kind: 'normal', cols: 5, rows: 3, enemies: 15, pool: { pilgrim: 2, moth: 2.5, guard: 2 }, loot: 4, hpScale: 1.45 },
      { kind: 'boss', cols: 3, rows: 2, enemies: 6, pool: { pilgrim: 1, moth: 2, guard: 1 }, loot: 2, boss: 'bellkeeper', elite: true, hpScale: 1.5 },
    ],
  },
];

export const TOTAL_LEVELS = CHAPTERS.reduce((s, c) => s + c.levels.length, 0);

export function levelAt(depth: number): { chapter: ChapterConfig; chapterIdx: number; level: LevelConfig; levelIdx: number } | null {
  let d = depth;
  for (let i = 0; i < CHAPTERS.length; i++) {
    const c = CHAPTERS[i];
    if (d < c.levels.length) return { chapter: c, chapterIdx: i, level: c.levels[d], levelIdx: d };
    d -= c.levels.length;
  }
  return null;
}
