import { CONFIG } from '../config/gameConfig'
import type { Judge } from '../types'

export interface SetReward {
  eligible: boolean
  exp: number
  gold: number
  countsBeat: boolean
}

/**
 * 1セット分の報酬。
 * 報酬対象は「基本セット数以内」かつ「前のセットから十分な間隔が空いている」セットだけ。
 * ボーナス枠（腹筋ローラー）はEXPではなくゴールドがもらえる。
 */
export function calcSetReward(p: { isBonus: boolean; setNo: number; judge: Judge; intervalOk: boolean }): SetReward {
  const eligible = p.intervalOk && p.setNo <= CONFIG.sets.perExercise
  if (!eligible) return { eligible, exp: 0, gold: 0, countsBeat: false }
  return {
    eligible,
    exp: p.isBonus ? 0 : CONFIG.exp[p.judge],
    gold: p.isBonus ? CONFIG.bonus.goldPerSet : 0,
    countsBeat: p.judge === 'beat',
  }
}

export function cardioGold(minutes: number): number {
  return Math.max(0, Math.floor(minutes)) * CONFIG.cardio.goldPerMinute
}
