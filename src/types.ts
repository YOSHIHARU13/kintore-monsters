import type { Attr, FormAttr, Slot } from './data/exercises'

export type Judge = 'beat' | 'keep' | 'normal'

/** EXPの財布：属性ごとの財布か、万能EXP */
export type ExpSource = Attr | 'any'

export interface AttrExp {
  trained: number // 筋トレで稼いだEXP
  bought: number // ゴールドで買ったEXP
}

export interface GameState {
  gold: number
  eggs: number
  exp: Record<Attr, AttrExp>
  lifetimeExp: Record<Attr, number>
  anyExp: number // 万能EXP（腹筋ローラーで稼ぐ。どの属性の進化にも注げる）
  attendance: number
  lastAttendanceDate: string | null
  totalSets: number
  beatCount: number
  weeklyClears: number // 今週のタスクを全部消した週の累計
  lastClearWeek: string | null // 最後に全消しした週（その週の月曜の日付）
  abstinenceStreak: number // 禁欲の連続日数（朝の記録で「してない」と答えた日の連続）
  bestAbstinenceStreak: number
  lastCheckinDate: string | null // 最後に朝の記録をつけた「前日」の日付
  activeMonsterId: string | null
}

export interface SetRecord {
  id: string
  exerciseId: string
  slotId: string
  day: Slot['day'] // 枠の部位
  date: string // YYYY-MM-DD
  ts: number
  setNo: number // その日のうちで、その種目の何セット目か
  weightKg: number // 自重種目は0
  reps: number
  target: number | null
  judge: Judge
  eligible: boolean // EXP・ゴールド・前回超えカウントの対象か
  exp: number
  gold: number
}

/** 朝の記録。ドキュメントIDは記録した「前日」の日付 */
export interface Checkin {
  date: string // 記録の対象日（前日）
  steps: number
  abstained: boolean // 前日、自慰行為をしなかったか
  streak: number // この日を含めた禁欲の連続日数（しなかった日は0）
  stepsGold: number
  abstinenceGold: number
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
  id: string // この1体のID（同じモンスターを何体でも持てる）
  defId: string // どのモンスター（MonsterDef）か
  nodeId: string
  investedBy?: Record<string, AttrExp> // 進化先のnodeId → その進化に向けて注いだEXP
  investedFrom?: Record<string, Partial<Record<ExpSource, AttrExp>>> // 進化先 → どの財布から注いだか（返却用）
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
