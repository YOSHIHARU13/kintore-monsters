import { CONFIG } from '../config/gameConfig'
import type { Exercise } from '../data/exercises'
import type { Judge, SetRecord } from '../types'

type HistoryItem = Pick<SetRecord, 'setNo' | 'weightKg' | 'reps' | 'ts' | 'date'>

/** 目標回数 ＝ 同じセット番号・同じ重量の直近N回の平均（四捨五入）＋1。記録がなければ null */
export function calcTarget(history: HistoryItem[], setNo: number, weightKg: number): number | null {
  const recent = history
    .filter((h) => h.setNo === setNo && h.weightKg === weightKg)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, CONFIG.target.recentCount)
  if (recent.length === 0) return null
  const avg = recent.reduce((sum, h) => sum + h.reps, 0) / recent.length
  return Math.round(avg) + CONFIG.target.plus
}

export function judgeSet(reps: number, target: number | null): Judge {
  if (target === null) return 'normal'
  if (reps >= target) return 'beat'
  if (reps >= target - CONFIG.target.keepMargin) return 'keep'
  return 'normal'
}

export type Progression =
  | { kind: 'addWeight'; fromKg: number; toKg: number }
  | { kind: 'upgrade'; toExerciseId: string }
  | null

/**
 * 直近の実施回（新しい順。1回＝同じ日のセット）から、次の一手を提案する。
 * 決められた回数だけ連続で、基本セットがすべて回数上限に達していれば +1kg、
 * 重量が上限なら（自重なら常に）上位種目へ。
 */
export function suggestProgression(sessions: HistoryItem[][], exercise: Exercise, maxReps: number): Progression {
  if (sessions.length < CONFIG.progression.streak) return null
  const recent = sessions.slice(0, CONFIG.progression.streak)
  const bases = recent.map((session) =>
    [...session].sort((a, b) => a.ts - b.ts).slice(0, CONFIG.sets.perExercise),
  )
  if (!bases.every((base) => base.length >= CONFIG.sets.perExercise && base.every((s) => s.reps >= maxReps))) {
    return null
  }
  if (exercise.weighted) {
    // 連続達成のあいだに重量を変えていたら、今の重量ではまだ連続達成していない
    const kg = Math.min(...bases[0].map((s) => s.weightKg))
    if (!bases.every((base) => base.every((s) => s.weightKg >= kg))) return null
    if (kg < CONFIG.weight.maxKg) {
      return { kind: 'addWeight', fromKg: kg, toKg: Math.min(CONFIG.weight.maxKg, kg + CONFIG.weight.stepKg) }
    }
  }
  return exercise.next ? { kind: 'upgrade', toExerciseId: exercise.next } : null
}

/** 履歴を日付ごとにまとめ、新しい順に最大 count 回分を返す */
export function recentSessions<T extends HistoryItem>(history: T[], count: number): T[][] {
  const byDate = new Map<string, T[]>()
  for (const h of history) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h])
  return [...byDate.values()]
    .sort((a, b) => Math.max(...b.map((h) => h.ts)) - Math.max(...a.map((h) => h.ts)))
    .slice(0, count)
}
