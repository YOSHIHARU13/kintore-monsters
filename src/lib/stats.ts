import { CONFIG } from '../config/gameConfig'
import { starsOf } from './gacha'
import type { MonsterDef, OwnedMonster } from '../types'

/** 攻撃力：星の数 × perStar ＋ ＋の数 × perPlus。クエストのダメージと相棒の倍率はこの数字で決まる */
export function attackOf(mon: OwnedMonster, def: MonsterDef): number {
  const { perStar, perPlus } = CONFIG.attack
  return starsOf(def, mon.nodeId) * perStar + (mon.plus ?? 0) * perPlus
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
