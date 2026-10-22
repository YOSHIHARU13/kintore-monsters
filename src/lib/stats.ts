import { CONFIG } from '../config/gameConfig'
import { rarityOf, starsOf } from './gacha'
import { isHidden, type MonsterDef, type OwnedMonster } from '../types'

/**
 * 攻撃力：形態の格 × perStar ＋ レア度の上乗せ ＋ ＋の数 × perPlus。クエストのダメージと相棒の倍率はこの数字で決まる。
 * 形態の格は「星 − formStarBase」（★1で1、★2で2…）
 */
export function attackOf(mon: OwnedMonster, def: MonsterDef): number {
  const { perStar, perPlus } = CONFIG.attack
  const level = starsOf(def, mon.nodeId) - CONFIG.gacha.formStarBase
  const bonus = isHidden(def) ? CONFIG.gacha.jogressAttackBonus : CONFIG.gacha.rarities[rarityOf(def)].attackBonus
  return level * perStar + bonus + (mon.plus ?? 0) * perPlus
}

/** ジョグレスの条件：素材は「生まれるときの星の1つ下」以上で、レシピの＋以上 */
export function jogressNeed(hidden: MonsterDef): { stars: number; plus: number } {
  return { stars: starsOf(hidden, 'n1') - 1, plus: hidden.jogressPlus ?? CONFIG.fusion.maxPlus }
}

/** そのモンスターが、その隠しモンスターのジョグレスの素材になれるか */
export function isJogressReady(mon: OwnedMonster, def: MonsterDef, hidden: MonsterDef): boolean {
  const need = jogressNeed(hidden)
  return starsOf(def, mon.nodeId) >= need.stars && (mon.plus ?? 0) >= need.plus
}
