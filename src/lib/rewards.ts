import { CONFIG } from '../config/gameConfig'
import type { GameState, Judge } from '../types'

export interface SetReward {
  eligible: boolean
  exp: number
  gold: number
  countsBeat: boolean
}

/** 今週その枠で報酬が出る最後のセット番号（基本セット＋2周目） */
export function maxRewardSet(isBonus: boolean): number {
  return CONFIG.sets.perExercise * (isBonus ? 1 : 1 + CONFIG.sets.extraRounds)
}

/** 2周目のセットか */
export function isExtraSet(isBonus: boolean, setNo: number): boolean {
  return !isBonus && setNo > CONFIG.sets.perExercise
}

/**
 * 1セット分の報酬。
 * 報酬対象は「基本セット数以内（筋トレは2周目まで）」かつ「前のセットから十分な間隔が空いている」セットだけ。
 * 2周目のセットはEXPが少なめ。
 * ボーナス枠（腹筋ローラー）はゴールドと万能EXP（どの属性の進化にも使える）がもらえる。
 */
export function calcSetReward(p: { isBonus: boolean; setNo: number; judge: Judge; intervalOk: boolean }): SetReward {
  const eligible = p.intervalOk && p.setNo <= maxRewardSet(p.isBonus)
  if (!eligible) return { eligible, exp: 0, gold: 0, countsBeat: false }
  const ratio = isExtraSet(p.isBonus, p.setNo) ? CONFIG.sets.extraExpRatio : 1
  return {
    eligible,
    exp: p.isBonus ? CONFIG.bonus.anyExpPerSet : Math.round(CONFIG.exp[p.judge] * ratio),
    gold: p.isBonus ? CONFIG.bonus.goldPerSet : 0,
    countsBeat: p.judge === 'beat',
  }
}

/** 歩数のゴールド。500歩ごとに1G＋届いた段の歩数ボーナス */
/** 習慣の名前（未設定なら初期の名前） */
export function habitLabelOf(state: GameState): string {
  return state.habitLabel?.trim() || CONFIG.morning.habitDefaultLabel
}

/** 習慣を今 minutes 分記録したらもらえるゴールド。分数なら1日の合計が上限まで、○×なら1日1回 */
export function habitGoldNow(state: GameState, today: string, minutes: number): number {
  const sameDay = state.habitDate === today
  // ブースター使用中：Gが2倍で、その日の上限もなし
  if (state.boosts?.habit) {
    if (state.habitMode === 'minutes') return Math.max(0, Math.floor(minutes)) * CONFIG.morning.habitGoldPerMinute * 2
    return sameDay ? 0 : CONFIG.morning.habitGold * 2
  }
  if (state.habitMode === 'minutes') {
    const before = sameDay ? state.habitMinutesToday : 0
    const room = Math.max(0, CONFIG.morning.habitMaxMinutes - before)
    return Math.min(Math.max(0, Math.floor(minutes)), room) * CONFIG.morning.habitGoldPerMinute
  }
  return sameDay ? 0 : CONFIG.morning.habitGold
}

/** 歩数のゴールド：150歩ごとに1G（段階なし） */
export function stepsGold(steps: number): number {
  return Math.floor(Math.max(0, steps) / CONFIG.morning.stepsPerGold)
}
