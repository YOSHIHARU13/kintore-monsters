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

/** 歩数のゴールド。500歩ごとに1G */
export function stepsGold(steps: number): number {
  return Math.floor(Math.max(0, steps) / CONFIG.morning.stepsPerGold)
}

/** 禁欲n日目のゴールド。日数に比例して増え、上限の日数で頭打ち */
export function abstinenceGold(day: number): number {
  return Math.min(Math.max(0, Math.floor(day)), CONFIG.morning.abstinenceMaxDays) * CONFIG.morning.abstinenceGoldPerDay
}
