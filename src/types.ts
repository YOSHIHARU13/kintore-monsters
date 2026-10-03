import type { Attr, DayKey } from './data/exercises'

export type Judge = 'beat' | 'keep' | 'normal'

export interface AttrExp {
  trained: number // 筋トレで稼いだEXP
  bought: number // ゴールドで買ったEXP
}

export interface GameState {
  gold: number
  stones: number
  eggs: number
  exp: Record<Attr, AttrExp>
  lifetimeExp: Record<Attr, number>
  attendance: number
  lastAttendanceDate: string | null
  totalSets: number
  beatCount: number
  activeMonsterId: string | null
}

export interface SetRecord {
  id: string
  exerciseId: string
  slotId: string
  day: DayKey
  date: string // YYYY-MM-DD
  ts: number
  setNo: number
  weightKg: number // 自重種目は0
  reps: number
  target: number | null
  judge: Judge
  eligible: boolean // EXP・ゴールド・前回超えカウントの対象か
  exp: number
  gold: number
}

export interface Activity {
  id: string
  kind: string
  label: string
  minutes: number
  gold: number
  date: string
  ts: number
}

export interface MonsterDef {
  id: string
  name: string
  attr: Attr
  templateId: string
  images: Record<string, string> // nodeId → 画像ドキュメントID
  names?: Record<string, string> // nodeId → その段階だけの名前（なければ name を使う）
  createdAt: number
}

/** その段階での名前。段階ごとの名前が未設定なら全体の名前 */
export function monsterName(def: MonsterDef, nodeId: string): string {
  return def.names?.[nodeId]?.trim() || def.name
}

export interface OwnedMonster {
  id: string // MonsterDef の id と同じ（ダブりなし）
  nodeId: string
  invested: AttrExp // 次の進化に向けて注いだEXP
  obtainedAt: number
}
