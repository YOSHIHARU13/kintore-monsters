import { CONFIG } from '../config/gameConfig'
import { elementInfo } from './element'
import type { MonsterDef, OwnedMonster } from '../types'

/**
 * 合体の素材にできるか：同じモンスターか、同じ属性を持つモンスター（無属性どうしもOK）。
 * ダブりやハズレも＋の素材になるので、激レアでも＋5を目指せる。
 */
export function canFeed(base: MonsterDef, food: MonsterDef): boolean {
  if (base.id === food.id) return true
  const a = elementInfo(base).elements
  const b = elementInfo(food).elements
  if (a.length === 0 || b.length === 0) return a.length === 0 && b.length === 0
  return a.some((e) => b.includes(e))
}

/** 食べさせたときに上がる＋：同じモンスターなら sameMonster、同じ属性なら sameElement（食べさせた側の＋も引き継ぐ） */
export function fusionGain(base: MonsterDef, food: MonsterDef, foodMon: OwnedMonster): number {
  const gain = base.id === food.id ? CONFIG.fusion.gain.sameMonster : CONFIG.fusion.gain.sameElement
  return gain + (foodMon.plus ?? 0)
}
