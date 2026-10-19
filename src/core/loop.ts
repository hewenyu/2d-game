// 主循环的时间预算：逻辑视口与碰撞子步长都是硬约束，不能为了追帧把子步做大。

/** 单帧最多推进的真实时间；超出部分直接丢弃（追不上就慢下来，而不是补一大堆步） */
export const MAX_FRAME_SECONDS = 0.1;
/** 物理子步上限：1/120 秒 */
export const PHYSICS_STEP = 1 / 120;
/** 单帧最多跑的子步数，等于 MAX_FRAME_SECONDS / PHYSICS_STEP */
export const MAX_SUBSTEPS = 12;

export interface SubstepPlan {
  /** 实际推进的时间（已按 MAX_FRAME_SECONDS 截断） */
  dt: number;
  steps: number;
  /** 每个子步的时长，恒 <= step */
  sub: number;
}

/**
 * 半固定步长：把这一帧的真实时长均分成若干个不超过 step 的子步。
 * 纯固定步长在帧间隔抖动时会出现「这帧 1 步、下帧 3 步」，画面一顿一顿的。
 * 卡顿/后台回来时 dt 可能很大，这里同时截断总时长并限制子步数。
 */
export function planSubsteps(
  dt: number,
  step: number = PHYSICS_STEP,
  maxFrame: number = MAX_FRAME_SECONDS,
  maxSubsteps: number = MAX_SUBSTEPS,
): SubstepPlan {
  // 先按子步数封顶，再按最大帧时长封顶：两个上限都要真的成立。
  const clamped = Math.min(Math.max(dt, 0), maxFrame, step * maxSubsteps);
  if (!(clamped > 0)) return { dt: 0, steps: 0, sub: 0 };
  // 不加 epsilon：ceil 保证 steps >= clamped/step，因此 sub <= step 是硬上界。
  // （加 epsilon 会让 dt 刚好略大于 step 时算出 1 个子步，sub 反而超过 1/120。）
  const steps = Math.min(maxSubsteps, Math.max(1, Math.ceil(clamped / step)));
  return { dt: clamped, steps, sub: Math.min(clamped / steps, step) };
}
