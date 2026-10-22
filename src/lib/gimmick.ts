import { CONFIG } from '../config/gameConfig'
import { rarityOf } from './gacha'
import { isHidden, type MonsterDef, type Quest } from '../types'

/** アビリティの名前の表（ギミック名 → アビリティ名）：最初からある分・以前あった分・クエストで作った分 */
export function allGimmicks(quests: Pick<Quest, 'customGimmicks'>[]): Record<string, string> {
  return Object.assign({}, CONFIG.gimmicks.legacy, CONFIG.gimmicks.defaults, ...quests.map((q) => q.customGimmicks ?? {}))
}

/** 選べるアビリティ（以前あった分は選べない） */
export function selectableGimmicks(quests: Pick<Quest, 'customGimmicks'>[]): string[] {
  return [...new Set([...Object.keys(CONFIG.gimmicks.defaults), ...quests.flatMap((q) => Object.keys(q.customGimmicks ?? {}))])]
}

/** アビリティの名前（ギミックに対応するもの。見つからなければ「○○ブレイカー」） */
export function abilityName(gimmick: string, names: Record<string, string> = CONFIG.gimmicks.defaults): string {
  return names[gimmick] ?? `${gimmick}ブレイカー`
}

/** そのモンスターが持てるアビリティの数（レア度の格） */
export function abilitySlots(def: Pick<MonsterDef, 'recipe' | 'rarity' | 'common' | 'jogressGrade'>): number {
  const slots = CONFIG.gimmicks.slots
  if (isHidden(def as MonsterDef)) return slots.jogress
  return slots[rarityOf(def as MonsterDef)]
}

/** ジョグレスの格：レシピの素材のうち激レアの数 */
export function jogressGradeOf(recipe: string[], defs: MonsterDef[]): number {
  return recipe.filter((id) => {
    const d = defs.find((x) => x.id === id)
    return !!d && rarityOf(d) === 'superRare'
  }).length
}
