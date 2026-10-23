import { CONFIG } from '../config/gameConfig'
import { rarityOf, bossGradeOf } from './gacha'
import { isHidden, type MonsterDef, type Quest } from '../types'

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
  def: Pick<MonsterDef, 'recipe' | 'tier' | 'rarity' | 'common' | 'jogressGrade' | 'bossGrade' | 'series'> & { questOnly?: boolean },
): number {
  const slots = CONFIG.gimmicks.slots
  if (isHidden(def as MonsterDef)) return slots.jogress
  // 金の獣神化した個体（2体の合体）は、以前のジョグレスと同じ数
  if ((def as MonsterDef).goldElements) return slots.jogress
  // 降臨は格で決まる
  const grade = bossGradeOf(def as MonsterDef)
  if (grade) return CONFIG.quest.bossGrades[grade].abilities
  return slots[rarityOf(def as MonsterDef)]
}

/** ジョグレスの格：レシピの素材のうち激レアの数 */
export function jogressGradeOf(recipe: string[], defs: MonsterDef[]): number {
  return recipe.filter((id) => {
    const d = defs.find((x) => x.id === id)
    return !!d && rarityOf(d) === 'superRare'
  }).length
}
