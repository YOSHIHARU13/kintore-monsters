import { CONFIG } from '../config/gameConfig'
import { rarityOf } from './gacha'
import { isHidden, type MonsterDef, type Quest } from '../types'

/** 選べるアビリティ（ギミック名 → アビリティ名）：最初からある分と、クエストで作った分 */
export function allGimmicks(quests: Pick<Quest, 'customGimmicks'>[]): Record<string, string> {
  return Object.assign({}, CONFIG.gimmicks.defaults, ...quests.map((q) => q.customGimmicks ?? {}))
}

/** アビリティの名前（ギミックに対応するもの。見つからなければ「○○ブレイカー」） */
export function abilityName(gimmick: string, names: Record<string, string> = CONFIG.gimmicks.defaults): string {
  return names[gimmick] ?? `${gimmick}ブレイカー`
}

/** そのモンスターが持てるアビリティの数（レア度の格） */
export function abilitySlots(def: Pick<MonsterDef, 'recipe' | 'rarity' | 'common' | 'jogressGrade'>): number {
  const slots = CONFIG.gimmicks.slots
  if (isHidden(def as MonsterDef)) return slots.jogress + ((def.jogressGrade ?? 0) > 0 ? 1 : 0)
  return slots[rarityOf(def as MonsterDef)]
}

/** ジョグレスの格：レシピの素材のうち激レアの数 */
export function jogressGradeOf(recipe: string[], defs: MonsterDef[]): number {
  return recipe.filter((id) => {
    const d = defs.find((x) => x.id === id)
    return !!d && rarityOf(d) === 'superRare'
  }).length
}
