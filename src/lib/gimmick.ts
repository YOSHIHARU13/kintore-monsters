import { CONFIG } from '../config/gameConfig'
import { rarityOf } from './gacha'
import { isHidden, type MonsterDef, type Quest } from '../types'

/** 選べるギミック → 対応するアビリティ名：最初からある分と、クエストで作った分 */
export function allGimmicks(quests: Pick<Quest, 'customGimmicks'>[]): Record<string, string> {
  return Object.assign({}, CONFIG.gimmicks.defaults, ...quests.map((q) => q.customGimmicks ?? {}))
}

/** アビリティの名前（ギミックに対応するもの。見つからなければ「○○ブレイカー」） */
export function abilityName(gimmick: string, names: Record<string, string> = CONFIG.gimmicks.defaults): string {
  return names[gimmick] ?? `${gimmick}ブレイカー`
}

/** そのモンスターが持てるアビリティの数（レア度の格） */
export function abilitySlots(def: Pick<MonsterDef, 'recipe' | 'rarity' | 'common'>): number {
  const slots = CONFIG.gimmicks.slots
  return isHidden(def as MonsterDef) ? slots.jogress : slots[rarityOf(def as MonsterDef)]
}

/** ボスのギミックのうち、そのモンスターが対応できていないもの */
export function unmatchedGimmicks(def: MonsterDef, quest: Pick<Quest, 'gimmicks'>): string[] {
  const own = new Set((def.abilities ?? []).slice(0, abilitySlots(def)))
  return (quest.gimmicks ?? []).filter((g) => !own.has(g))
}

/** ギミックによる攻撃の倍率：未対応1つにつき penaltyPerGimmick 減る */
export function gimmickRate(def: MonsterDef, quest: Pick<Quest, 'gimmicks'>): number {
  const { penaltyPerGimmick, minRate } = CONFIG.gimmicks
  return Math.max(minRate, 1 - penaltyPerGimmick * unmatchedGimmicks(def, quest).length)
}
