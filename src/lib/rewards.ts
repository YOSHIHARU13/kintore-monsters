import { CONFIG } from '../config/gameConfig'
import type { GameState, Judge } from '../types'

export interface SetReward {
  eligible: boolean
  exp: number
  gold: number
  countsBeat: boolean
}

/**
 * 1セット分の報酬。
 * 前のセットから十分な間隔が空いていれば、何セット目でもEXPは満額（ダメージも入る）。
 * 全身枠（腹筋ローラーなど）は万能EXP。オーブはその日の基本セット数までだけ（週のオーブの目安を守るため）。
 */
export function calcSetReward(p: { isBonus: boolean; setNo: number; judge: Judge; intervalOk: boolean }): SetReward {
  const eligible = p.intervalOk
  if (!eligible) return { eligible, exp: 0, gold: 0, countsBeat: false }
  return {
    eligible,
    exp: p.isBonus ? CONFIG.bonus.anyExpPerSet : CONFIG.exp[p.judge],
    gold: p.isBonus && p.setNo <= CONFIG.sets.perExercise ? CONFIG.bonus.goldPerSet : 0,
    countsBeat: p.judge === 'beat',
  }
}

/** 習慣の名前（未設定なら初期の名前） */
export function habitLabelOf(state: GameState): string {
  return state.habitLabel?.trim() || CONFIG.morning.habitDefaultLabel
}

/** 1回に続けた分数での、1分あたりのゴールド（長く続けるほど高い） */
export function habitRate(minutes: number): number {
  const tiers = CONFIG.morning.habitRates.filter((t) => minutes >= t.from)
  return tiers.length > 0 ? tiers[tiers.length - 1].perMinute : 0
}

/** 習慣を今 minutes 分記録したらもらえるゴールド。分数なら1日の合計が上限まで、○×なら1日1回 */
export function habitGoldNow(state: GameState, today: string, minutes: number): number {
  const sameDay = state.habitDate === today
  const mins = Math.max(0, Math.floor(minutes))
  // ブースター使用中：オーブが2倍で、その日の上限もなし
  if (state.boosts?.habit) {
    if (state.habitMode === 'minutes') return Math.floor(mins * habitRate(mins) * 2)
    return sameDay ? 0 : CONFIG.morning.habitGold * 2
  }
  if (state.habitMode === 'minutes') {
    // 1日の最初の habitFullMinutes 分は単価どおり、そこから habitMaxMinutes 分までは habitLateRate
    const m = CONFIG.morning
    const before = sameDay ? state.habitMinutesToday : 0
    const paid = Math.max(0, Math.min(mins, m.habitMaxMinutes - before))
    const full = Math.max(0, Math.min(paid, m.habitFullMinutes - before))
    return Math.floor(full * habitRate(mins) + (paid - full) * Math.min(habitRate(mins), m.habitLateRate))
  }
  return sameDay ? 0 : CONFIG.morning.habitGold
}

/** 歩数のオーブ：stepsPerGold 歩ごとに1オーブ＋届いた中でいちばん上のボーナス（8000歩・1万歩） */
export function stepsGold(steps: number): number {
  const s = Math.max(0, steps)
  const bonus = CONFIG.morning.stepBonuses.filter((b) => s >= b.steps).reduce((max, b) => Math.max(max, b.gold), 0)
  return Math.floor(s / CONFIG.morning.stepsPerGold) + bonus
}
