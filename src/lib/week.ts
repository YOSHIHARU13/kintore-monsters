import { CONFIG } from '../config/gameConfig'
import { DAY_KEYS, TASK_SLOTS, slotsOfDay, type DayKey } from '../data/exercises'
import type { SetRecord } from '../types'

type WeekItem = Pick<SetRecord, 'slotId'>

/** その枠で今週こなしたセット数（差し替え前の種目のぶんも数える）。基本セット数を超えたぶんも含む */
export function weekCount(weekSets: WeekItem[], slotId: string): number {
  return weekSets.filter((s) => s.slotId === slotId).length
}

/** その枠で消したタスク数（基本セット数まで） */
export function slotDone(weekSets: WeekItem[], slotId: string): number {
  return Math.min(CONFIG.sets.perExercise, weekCount(weekSets, slotId))
}

export interface Progress {
  done: number // 消したセット数
  total: number
  slotsDone: number // 基本セット数をやりきった種目の数
  slots: number
}

/** 部位ごとの今週の進み具合 */
export function partProgress(weekSets: WeekItem[]): Record<DayKey, Progress> {
  const of = (day: DayKey): Progress => {
    const slots = slotsOfDay(day)
    return {
      done: slots.reduce((sum, slot) => sum + slotDone(weekSets, slot.id), 0),
      total: slots.length * CONFIG.sets.perExercise,
      slotsDone: slots.filter((slot) => slotDone(weekSets, slot.id) >= CONFIG.sets.perExercise).length,
      slots: slots.length,
    }
  }
  return Object.fromEntries(DAY_KEYS.map((day) => [day, of(day)])) as Record<DayKey, Progress>
}

/** 今週のタスクを全部消したか */
export function isWeekCleared(weekSets: WeekItem[]): boolean {
  return TASK_SLOTS.every((slot) => slotDone(weekSets, slot.id) >= CONFIG.sets.perExercise)
}
