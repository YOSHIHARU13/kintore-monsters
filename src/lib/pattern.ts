import { DAYS, SLOTS, type Attr } from '../data/exercises'
import type { MonsterDef } from '../types'

/**
 * 高難度（試練の塔・禁筋の獄・零の孤城）の月ごとのパターン：胸腕の月 → 脚の月 → 背肩の月 → …
 * どのボスも、その月の部位のボスとして戦う（ボスの部位・弱点種目・「◯◯の子」の条件が変わる）。
 * 最後の階のボスも、パターンごとに入れ替わる
 */
export const PATTERN_PARTS: Attr[] = ['chestArms', 'legs', 'backShoulders']

export function patternOf(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return (y * 12 + m) % PATTERN_PARTS.length
}

export const patternPart = (month: string): Attr => PATTERN_PARTS[patternOf(month)]

/** 高難度の名前に付ける、その月のパターン（例：【脚】） */
export const patternTag = (month: string) => `【${DAYS[(Object.keys(DAYS) as (keyof typeof DAYS)[]).find((d) => DAYS[d].attr === patternPart(month))!].title}】`

export const patternLabel = (month: string) => `${DAYS[(Object.keys(DAYS) as (keyof typeof DAYS)[]).find((d) => DAYS[d].attr === patternPart(month))!].title}の月`

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** その部位の種目から、弱点種目を n 個（seed で決まる） */
export function weakSlotsFor(part: Attr, seed: string, n: number): string[] {
  const pool = SLOTS.filter((s) => s.day !== 'bonus' && DAYS[s.day as keyof typeof DAYS].attr === part).map((s) => s.id)
  const start = hash(seed)
  return [...new Set(Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(start + i * 2) % pool.length]))]
}

/** パターンごとにギミックを変えるため、条件を作るときだけボスを少し別の子として扱う（見た目・属性は同じ） */
export const patternBoss = (boss: MonsterDef, pattern: number): MonsterDef => (pattern === 0 ? boss : { ...boss, id: `${boss.id}:p${pattern}` })

/** 最後の階のボス：登録した子をパターンごとに入れ替える（3体いれば毎月ちがう子、1体なら毎月その子） */
export function patternPick<T>(list: T[], pattern: number): T | undefined {
  return list.length > 0 ? list[pattern % list.length] : undefined
}

/** 高難度の、手で並べたボスの順（各階のボスのID。最後の階の入れ替わるボスは入れない） */
export type BossOrderKind = 'tower' | 'kinkin' | 'castle'
export type BossOrder = Partial<Record<BossOrderKind, string[]>>

/**
 * 手で並べた順を当てる：並べたボスのうち今も並びに入れるものは、その階に。
 * あいた階には、残りのボスを自動の並びのまま入れる（新しく登録したボスもここに入る）
 */
export function applyOrder(auto: (MonsterDef | undefined)[], order: string[] | undefined): (MonsterDef | undefined)[] {
  if (!order?.length) return auto
  const byId = new Map(auto.filter((d): d is MonsterDef => !!d).map((d) => [d.id, d]))
  const used = new Set<string>()
  const placed = auto.map((_, i) => {
    const d = byId.get(order[i])
    if (!d || used.has(d.id)) return undefined
    used.add(d.id)
    return d
  })
  const rest = auto.filter((d) => d && !used.has(d.id))
  return placed.map((d) => d ?? rest.shift())
}
