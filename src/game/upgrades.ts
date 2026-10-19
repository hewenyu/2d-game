// 灯龛休憩时可用余烬购买的强化。新增强化：往 UPGRADES 里加一项，并在 statsFor 中生效。
import { PLAYER_BASE } from '../config';
import type { PlayerStats } from '../entities/player';

export type UpgradeId = 'hp' | 'flask' | 'slash' | 'recall';

export interface Upgrade { id: UpgradeId; name: string; desc: string; max: number; cost: (owned: number) => number }

export const UPGRADES: Upgrade[] = [
  { id: 'hp', name: '坚铃', desc: '最大生命 +1', max: 3, cost: (n) => 70 + n * 60 },
  { id: 'flask', name: '添油', desc: '灯油瓶 +1（每瓶回复 2 点生命）', max: 2, cost: (n) => 90 + n * 80 },
  { id: 'slash', name: '砺锋', desc: '斩击伤害 +20%', max: 3, cost: (n) => 55 + n * 50 },
  { id: 'recall', name: '回锋', desc: '召回贯穿伤害 +25%', max: 3, cost: (n) => 55 + n * 50 },
];

export type Owned = Record<UpgradeId, number>;
export const noUpgrades = (): Owned => ({ hp: 0, flask: 0, slash: 0, recall: 0 });

export function statsFor(o: Owned): PlayerStats {
  return {
    maxHp: PLAYER_BASE.maxHp + o.hp,
    maxFlasks: PLAYER_BASE.flasks + o.flask,
    slashDmg: Math.round(PLAYER_BASE.slashDmg * (1 + 0.2 * o.slash)),
    recallDmg: Math.round(PLAYER_BASE.recallDmg * (1 + 0.25 * o.recall)),
  };
}
