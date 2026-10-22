import { CONFIG } from '../config/gameConfig'
import { ELEMENT_LABEL, elementInfo } from './element'
import { abilityName, abilitySlots } from './gimmick'
import type { Element, MonsterDef, Quest, Requirement } from '../types'

/**
 * 編成：クエストは「求められる人材の条件」（炎が3、バリアブレイカーが3…）を持ち、
 * 出撃する6体の合計でそれを満たしにいく。誰が何を持っていてもよい。
 * タグは「el:炎などの属性」か「ab:アビリティ（ギミック名で持つ）」。
 */
export type Tag = string

export const elementTag = (e: Element): Tag => `el:${e}`
export const abilityTag = (gimmick: string): Tag => `ab:${gimmick}`

/** そのモンスターが条件にいくつ貢献できるか（超属性は2、複合属性は両方に1、アビリティは持てる数まで） */
export function tagsOf(def: MonsterDef): Record<Tag, number> {
  const tags: Record<Tag, number> = {}
  const el = elementInfo(def)
  for (const e of el.elements) tags[elementTag(e)] = (tags[elementTag(e)] ?? 0) + (el.super ? 2 : 1)
  for (const g of (def.abilities ?? []).slice(0, abilitySlots(def))) tags[abilityTag(g)] = (tags[abilityTag(g)] ?? 0) + 1
  return tags
}

/** クエストの条件（条件を作る前のクエストは、ギミックを「対応アビリティ2体」に読み替える） */
export function requirementsOf(quest: Pick<Quest, 'requirements' | 'gimmicks'>): Requirement[] {
  if (quest.requirements) return quest.requirements
  return (quest.gimmicks ?? []).map((g) => ({ tag: abilityTag(g), count: 2 }))
}

/** タグの表示名（🔥炎、バリアブレイカー など） */
export function tagLabel(tag: Tag, names: Record<string, string>): string {
  if (tag.startsWith('el:')) {
    const e = tag.slice(3) as Element
    return `${CONFIG.formation.elementIcon[e]}${ELEMENT_LABEL[e]}`
  }
  return abilityName(tag.slice(3), names)
}

export interface FormationRow {
  tag: Tag
  need: number
  have: number
}

export interface Formation {
  rows: FormationRow[]
  rate: number // 編成倍率
}

/**
 * 編成倍率：何もそろっていないと base、ちょうどそろうと1.0、条件を超えた分は1つにつき perExtra（上限 max）。
 * 条件のないクエストは1.0。
 */
export function formationOf(party: MonsterDef[], requirements: Requirement[]): Formation {
  const f = CONFIG.formation
  const total: Record<Tag, number> = {}
  for (const def of party) for (const [tag, n] of Object.entries(tagsOf(def))) total[tag] = (total[tag] ?? 0) + n
  const rows = requirements.map((r) => ({ tag: r.tag, need: r.count, have: total[r.tag] ?? 0 }))
  if (rows.length === 0) return { rows, rate: 1 }
  const fill = rows.reduce((sum, r) => sum + Math.min(1, r.have / Math.max(1, r.need)), 0) / rows.length
  const extra = rows.reduce((sum, r) => sum + Math.max(0, r.have - r.need), 0)
  const rate = Math.min(f.max, f.base + (1 - f.base) * fill + f.perExtra * extra)
  return { rows, rate: Math.round(rate * 100) / 100 }
}

/** そのモンスターが、まだ足りていない条件にいくつ貢献できるか（候補を並べる順番に使う） */
export function shortfallHelp(def: MonsterDef, rows: FormationRow[]): number {
  const tags = tagsOf(def)
  return rows.reduce((sum, r) => sum + Math.min(tags[r.tag] ?? 0, Math.max(0, r.need - r.have)), 0)
}
