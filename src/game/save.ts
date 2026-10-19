// 存档与记录：纯函数，便于单元测试。练习局（从中途开始）不计入任何记录。

export interface Save {
  bestDepth: number;
  bestTime: number | null;
  wins: number;
}

export const SAVE_KEY = 'huifeng_save';

export function defaultSave(): Save {
  return { bestDepth: 0, bestTime: null, wins: 0 };
}

export function parseSave(raw: string | null | undefined): Save {
  let parsed: unknown;
  try { parsed = JSON.parse(raw || '{}'); } catch { return defaultSave(); }
  if (!parsed || typeof parsed !== 'object') return defaultSave();
  const o = parsed as Record<string, unknown>;
  // 逐字段校验类型：存档可能来自旧版本或被手改过，字符串 "31" 之类的值不能被当数字用。
  const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const time = typeof o.bestTime === 'number' && Number.isFinite(o.bestTime) && o.bestTime >= 0 ? o.bestTime : null;
  return { bestDepth: int(o.bestDepth), bestTime: time, wins: int(o.wins) };
}

/** 进入新层：练习局不记录。返回是否发生改动。 */
export function recordLevelReached(save: Save, run: { practice: boolean; depth: number }): boolean {
  if (run.practice || run.depth <= save.bestDepth) return false;
  save.bestDepth = run.depth;
  return true;
}

/**
 * 通关：练习局不计胜场、最佳时间，也不把 bestDepth 顶到满层。
 * 返回是否发生改动。
 */
export function recordVictory(
  save: Save,
  run: { practice: boolean; time: number },
  totalLevels: number,
): boolean {
  if (run.practice) return false;
  save.wins++;
  if (save.bestTime === null || run.time < save.bestTime) save.bestTime = run.time;
  save.bestDepth = Math.max(save.bestDepth, totalLevels);
  return true;
}
