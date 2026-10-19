/** 可复现的随机数（mulberry32）。同一种子生成同一关卡。 */
export class RNG {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 0x9e3779b9; }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return a + this.next() * (b - a); }
  int(a: number, b: number) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p: number) { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  weighted<K extends string>(w: Partial<Record<K, number>>): K | null {
    const entries = Object.entries(w) as [K, number][];
    const total = entries.reduce((s, [, v]) => s + (v || 0), 0);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const [k, v] of entries) { r -= v || 0; if (r <= 0) return k; }
    return entries[entries.length - 1][0];
  }
}

export function hashInts(...ns: number[]): number {
  let h = 2166136261;
  for (const n of ns) { h ^= n | 0; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  return (h ^ (h >>> 13)) >>> 0;
}
/** [0,1) 的确定性哈希，用于逐格装饰 */
export const hash01 = (...ns: number[]) => hashInts(...ns) / 4294967296;
