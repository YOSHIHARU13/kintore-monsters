import { CONFIG } from '../config/gameConfig'
import { rarityOf } from './gacha'
import { isHidden, type MonsterDef, type Quest, type QuestTier } from '../types'

/** アビリティの名前の表（ギミック名 → アビリティ名）：最初からある分・以前あった分・クエストで作った分 */
export function allGimmicks(quests: Pick<Quest, 'customGimmicks'>[]): Record<string, string> {
  return Object.assign({}, CONFIG.gimmicks.legacy, CONFIG.gimmicks.defaults, ...quests.map((q) => q.customGimmicks ?? {}))
}

/** 選べるアビリティ（以前あった分は選べない） */
export function selectableGimmicks(quests: Pick<Quest, 'customGimmicks'>[]): string[] {
  return [...new Set([...Object.keys(CONFIG.gimmicks.defaults), ...quests.flatMap((q) => Object.keys(q.customGimmicks ?? {}))])]
}

/** アビリティ（スキル）の名前。見つからなければ内部の名前のまま */
export function abilityName(gimmick: string, names: Record<string, string> = CONFIG.gimmicks.defaults): string {
  return names[gimmick] ?? gimmick
}

/** そのモンスターが持てるアビリティの数（レア度の格） */
export function abilitySlots(
  def: Pick<MonsterDef, 'recipe' | 'rarity' | 'common' | 'jogressGrade'> & { questOnly?: boolean; questTier?: QuestTier | null },
): number {
  const slots = CONFIG.gimmicks.slots
  if (isHidden(def as MonsterDef)) return slots.jogress
  // 爆絶級・ラスボス級の降臨は、レア度に関係なく格の数
  if (def.questOnly && def.questTier) return CONFIG.gimmicks.questTierSlots[def.questTier]
  const n = slots[rarityOf(def as MonsterDef)]
  // 降臨は激レアでもガチャより弱く
  return def.questOnly ? Math.min(n, CONFIG.gimmicks.questOnlyMax) : n
}

/** ジョグレスの格：レシピの素材のうち激レアの数 */
export function jogressGradeOf(recipe: string[], defs: MonsterDef[]): number {
  return recipe.filter((id) => {
    const d = defs.find((x) => x.id === id)
    return !!d && rarityOf(d) === 'superRare'
  }).length
}
