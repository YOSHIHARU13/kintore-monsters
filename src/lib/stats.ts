import { CONFIG } from '../config/gameConfig'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { rarityOf, starsOf } from './gacha'
import { customAttack } from './custom'
import { isHidden, type MonsterDef, type OwnedMonster } from '../types'

/**
 * 攻撃力：形態の格 × perStar ＋ レア度の上乗せ ＋ ＋の数 × perPlus。クエストのダメージと相棒の倍率はこの数字で決まる。
 * 形態の格は「星 − formStarBase」（★1で1、★2で2…）
 */
/** その1体の星（神化していれば＋1） */
export function monStars(mon: Pick<OwnedMonster, 'nodeId' | 'shinka'>, def: MonsterDef): number {
  return starsOf(def, mon.nodeId) + (mon.shinka ? 1 : 0)
}

export function attackOf(mon: OwnedMonster, def: MonsterDef): number {
  const { perStar } = CONFIG.attack
  const level = monStars(mon, def) - CONFIG.gacha.formStarBase
  const bonus = isHidden(def)
    ? CONFIG.gacha.jogressAttackBonus + (def.jogressGrade ?? 0) * CONFIG.jogress.superRareBonus
    : def.questOnly && def.questTier
      ? CONFIG.gacha.questTierAttack[def.questTier]
      : def.questOnly
      ? Math.min(CONFIG.gacha.rarities[rarityOf(def)].attackBonus, CONFIG.gacha.questOnlyAttackBonusMax)
      : CONFIG.gacha.rarities[rarityOf(def)].attackBonus
  return level * perStar + bonus + customAttack(mon)
}

/** ジョグレスの条件：素材は「生まれるときの星の1つ下」以上で、どちらも最終形態 */
export function jogressNeed(hidden: MonsterDef): { stars: number } {
  return { stars: starsOf(hidden, 'n1') - 1 }
}

/** そのモンスターが、その隠しモンスターのジョグレスの素材になれるか（最終形態で、星が足りていること） */
export function isJogressReady(mon: OwnedMonster, def: MonsterDef, hidden: MonsterDef): boolean {
  const final = getNode(getTemplate(def.templateId), mon.nodeId).next.length === 0
  return final && starsOf(def, mon.nodeId) >= jogressNeed(hidden).stars
}
