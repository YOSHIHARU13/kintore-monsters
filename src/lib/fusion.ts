import { CONFIG } from '../config/gameConfig'
import { elementInfo } from './element'
import type { MonsterDef, OwnedMonster } from '../types'

/**
 * ＋の素材にできるか：同じ属性を持つ、別のモンスター（無属性どうしもOK）。
 * 同じモンスターは運のほうに食べさせる。ハズレも＋の素材になるので、激レアでも＋5を目指せる。
 */
export function canFeed(base: MonsterDef, food: MonsterDef): boolean {
  if (base.id === food.id) return false
  const a = elementInfo(base).elements
  const b = elementInfo(food).elements
  if (a.length === 0 || b.length === 0) return a.length === 0 && b.length === 0
  return a.some((e) => b.includes(e))
}

/** 食べさせたときに上がる＋（食べさせた側の＋も引き継ぐ） */
export function fusionGain(_base: MonsterDef, _food: MonsterDef, foodMon: OwnedMonster): number {
  return CONFIG.fusion.gain.sameElement + (foodMon.plus ?? 0)
}

/** 運（なければ1） */
export function luckOf(mon: Pick<OwnedMonster, 'luck'>): number {
  return mon.luck ?? 1
}

export function isLuckMax(mon: Pick<OwnedMonster, 'luck'>): boolean {
  return luckOf(mon) >= CONFIG.luck.max
}

/** 運に食べさせたあとの運：食べさせた側の運をそのまま足す（最大99） */
export function luckAfter(base: Pick<OwnedMonster, 'luck'>, food: Pick<OwnedMonster, 'luck'>): number {
  return Math.min(CONFIG.luck.max, luckOf(base) + luckOf(food))
}

/** 運極ボーナス：出撃メンバーの運極の数で、報酬Gの倍率と、核が落ちる確率の上乗せ */
export function luckBonus(party: Pick<OwnedMonster, 'luck'>[]): { count: number; goldRate: number; coreRate: number } {
  const count = party.filter(isLuckMax).length
  return { count, goldRate: 1 + CONFIG.luck.goldBonus * count, coreRate: CONFIG.luck.coreBonus * count }
}
