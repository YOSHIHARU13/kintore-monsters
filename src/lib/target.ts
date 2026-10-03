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
 * 1回分（同じ日）のセット記録から、次の一手を提案する。
 * 基本セットがすべて回数上限に達していれば +1kg、重量が上限なら（自重なら常に）上位種目へ。
 */
export function suggestProgression(session: HistoryItem[], exercise: Exercise, maxReps: number): Progression {
  const base = session.filter((s) => s.setNo <= CONFIG.sets.perExercise)
  if (base.length < CONFIG.sets.perExercise) return null
  if (!base.every((s) => s.reps >= maxReps)) return null
  if (exercise.weighted) {
    const kg = Math.min(...base.map((s) => s.weightKg))
    if (kg < CONFIG.weight.maxKg) {
      return { kind: 'addWeight', fromKg: kg, toKg: Math.min(CONFIG.weight.maxKg, kg + CONFIG.weight.stepKg) }
    }
  }
  return exercise.next ? { kind: 'upgrade', toExerciseId: exercise.next } : null
}

/** 履歴の中で一番新しい日付のセットだけを返す */
export function latestSession<T extends HistoryItem>(history: T[]): T[] {
  if (history.length === 0) return []
  const latest = history.reduce((a, b) => (a.ts > b.ts ? a : b)).date
  return history.filter((h) => h.date === latest)
}
