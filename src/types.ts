import type { Attr, DayKey, FormAttr } from './data/exercises'

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

export interface Song {
  id: string // Sunoの曲ID
  title: string
}

export interface MonsterDef {
  id: string
  name: string
  attr: FormAttr // 第1段階の属性
  templateId: string
  attrs?: Record<string, FormAttr> // nodeId → その形態の属性（なければ attr を使う）
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
  investedBy?: Record<string, AttrExp> // 進化先のnodeId → その進化に向けて注いだEXP
  investedFrom?: Record<string, Partial<Record<Attr, AttrExp>>> // 進化先 → どの属性の財布から注いだか（返却用）
  invested?: AttrExp // 旧形式（通常ルートに注いだEXP）
  obtainedAt: number
}

/** その形態の属性。形態ごとの属性が未設定ならモンスター全体の属性 */
export function nodeAttr(def: MonsterDef, nodeId: string): FormAttr {
  return def.attrs?.[nodeId] ?? def.attr
}

/** 進化先 targetId に向けて注いだEXP。旧形式の分は通常ルート（firstNextId）に数える */
export function investedFor(mon: OwnedMonster, targetId: string, firstNextId: string | undefined): AttrExp {
  const now = mon.investedBy?.[targetId]
  const legacy = targetId === firstNextId ? mon.invested : undefined
  return {
    trained: (now?.trained ?? 0) + (legacy?.trained ?? 0),
    bought: (now?.bought ?? 0) + (legacy?.bought ?? 0),
  }
}
