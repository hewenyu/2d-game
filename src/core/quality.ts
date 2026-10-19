// 画质档位：只影响渲染分辨率与装饰性绘制。
// 逻辑视口恒为 960x540，输入与碰撞坐标不受影响；这里绝不改变物理或战斗数值。

export type QualityMode = 'high' | 'med' | 'low';
/** `auto` 会从 high 起步，按真实帧耗时自动降档 */
export type QualityRequest = QualityMode | 'auto';

export interface QualitySettings {
  mode: QualityMode;
  /** backing store 的设备像素上限（960x540 逻辑画布） */
  maxPixels: number;
  /** 背景视差层数（1..3，从远到近保留） */
  bgLayers: number;
  /** 光束、尘埃等氛围叠加 */
  ambient: boolean;
  /** 全屏暗角与色调 */
  postFx: boolean;
}

/** 1080p / 720p 的设备像素数，用来把「渲染分辨率」写成可读档位 */
export const PIXELS_1080P = 1920 * 1080;
export const PIXELS_720P = 1280 * 720;

export const QUALITY_PRESETS: Record<QualityMode, QualitySettings> = {
  // 不额外限制（仍然受 devicePixelRatio 上限 2 约束），用于高端设备或基准对比
  high: { mode: 'high', maxPixels: Infinity, bgLayers: 3, ambient: true, postFx: true },
  // 默认：设备像素不超过 1080p。960x540 的逻辑画布在 2x 设备缩放下正好是 1080p，
  // 再往上（4K 级别 backing）换来的清晰度提升很小，光栅成本却按面积线性上涨。
  med: { mode: 'med', maxPixels: PIXELS_1080P, bgLayers: 3, ambient: true, postFx: true },
  // 弱设备 / 无 GPU：720p 上限并关掉纯装饰性的氛围叠加与全屏后处理
  low: { mode: 'low', maxPixels: PIXELS_720P, bgLayers: 2, ambient: false, postFx: false },
};

export const DEFAULT_MODE: QualityMode = 'med';

/** 渲染代码读取的当前画质。整体替换字段，读取方每帧读一次即可。 */
export const quality: QualitySettings = { ...QUALITY_PRESETS[DEFAULT_MODE] };

export function applyQuality(mode: QualityMode): QualitySettings {
  Object.assign(quality, QUALITY_PRESETS[mode]);
  return quality;
}

/** 解析 `?q=` 参数；无法识别时返回 null（交给调用方用默认档位） */
export function parseQualityRequest(v: string | null | undefined): QualityRequest | null {
  switch ((v ?? '').toLowerCase()) {
    case 'high': return 'high';
    case 'med': case 'medium': return 'med';
    case 'low': return 'low';
    case 'auto': return 'auto';
    default: return null;
  }
}

export interface Backing {
  /** 每个逻辑像素对应的设备像素数 */
  scale: number;
  width: number;
  height: number;
  /** 是否被像素上限截断 */
  capped: boolean;
}

/**
 * 计算 canvas backing store 尺寸。
 *
 * CSS 尺寸仍按窗口算（scale 由窗口决定），这里只限制设备像素总数：高 DPR 大窗口下
 * 960x540 的逻辑画面会被放大成 4K 级别的 backing，光栅开销按面积线性增长，而观感提升
 * 有限。逻辑坐标与输入映射完全不变。
 */
export function resolveBacking(
  viewW: number,
  viewH: number,
  cssScale: number,
  dpr: number,
  maxPixels: number = Infinity,
): Backing {
  const ideal = Math.max(0.25, cssScale * dpr);
  const cap = maxPixels === Infinity ? Infinity : Math.sqrt(maxPixels / (viewW * viewH));
  const scale = Math.min(ideal, cap);
  return {
    scale,
    width: Math.max(1, Math.floor(viewW * scale)),
    height: Math.max(1, Math.floor(viewH * scale)),
    capped: scale < ideal - 1e-9,
  };
}

/**
 * 自适应画质：只在持续掉帧时降档，从不回弹，避免画质来回抖动。
 * 与渲染解耦，喂入真实帧耗时即可，方便单独测试。
 */
export class AdaptiveQuality {
  /** 采样窗口（帧） */
  window = 90;
  /** 降档后的冷却帧数 */
  cooldownFrames = 180;
  order: QualityMode[];
  private samples: number[] = [];
  private idx = 0;
  private cooldown = 0;

  constructor(order: QualityMode[] = ['high', 'med', 'low']) {
    this.order = order.slice();
  }

  get current(): QualityMode { return this.order[this.idx]; }
  get atLowest(): boolean { return this.idx >= this.order.length - 1; }

  /** 喂入一帧的真实耗时；返回需要切换到的档位，无需切换返回 null */
  sample(frameMs: number, budgetMs = 1000 / 45): QualityMode | null {
    if (this.cooldown > 0) { this.cooldown--; return null; }
    // 单帧卡顿（切层加载、GC、回到前台的补帧）不算稳定掉帧，丢弃并重新取样。
    if (!Number.isFinite(frameMs) || frameMs <= 0) return null;
    if (frameMs > 250) { this.samples.length = 0; return null; }
    this.samples.push(frameMs);
    if (this.samples.length < this.window) return null;
    const sorted = this.samples.slice().sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    this.samples.length = 0;
    if (p90 <= budgetMs || this.atLowest) return null;
    this.idx++;
    this.cooldown = this.cooldownFrames;
    return this.current;
  }
}
