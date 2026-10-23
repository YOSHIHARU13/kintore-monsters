import { CONFIG } from '../config/gameConfig'
import { ELEMENT_LABEL, elementInfo } from './element'
import { abilityName, abilitySlots } from './gimmick'
import type { Element, MonsterDef, Quest, Requirement } from '../types'

/**
 * 編成：クエストは「求められる人材の条件」（炎が3、アークが3…）を持ち、
 * 出撃する6体の合計でそれを満たしにいく。誰が何を持っていてもよい。
 * タグは「el:炎などの属性」か「ab:アビリティ（ギミック名で持つ）」。
 */
export type Tag = string

export const elementTag = (e: Element): Tag => `el:${e}`
export const abilityTag = (gimmick: string): Tag => `ab:${gimmick}`
/** 2つのアビリティを「両方」持つ（同じ1体で） */
export const comboTag = (a: string, b: string): Tag => `ab2:${[a, b].sort().join('|')}`
export const comboParts = (tag: Tag): string[] => (tag.startsWith('ab2:') ? tag.slice(4).split('|') : [])
/** その条件で求められるアビリティ（両方もつ条件なら2つ） */
export const tagAbilities = (tag: Tag): string[] =>
  tag.startsWith('ab:') ? [tag.slice(3)] : comboParts(tag)

/** そのモンスターが条件にいくつ貢献できるか（超属性は2、複合属性は両方に1、アビリティは持てる数まで） */
export function tagsOf(def: MonsterDef): Record<Tag, number> {
  const tags: Record<Tag, number> = {}
  const el = elementInfo(def)
  for (const e of el.elements) tags[elementTag(e)] = (tags[elementTag(e)] ?? 0) + (el.super ? 2 : 1)
  // カスタマイズで足したアビリティは、持てる数とは別に数える
  const abilities = [...new Set([...(def.abilities ?? []).slice(0, abilitySlots(def)), ...(def.extraAbilities ?? [])])]
  for (const g of abilities) tags[abilityTag(g)] = (tags[abilityTag(g)] ?? 0) + 1
  // 2つのアビリティを両方持っていれば「両方」の条件にも数える
  for (let i = 0; i < abilities.length; i++)
    for (let j = i + 1; j < abilities.length; j++) tags[comboTag(abilities[i], abilities[j])] = 1
  return tags
}

/** クエストの条件（条件を作る前のクエストは、ギミックを「対応アビリティ2体」に読み替える） */
export function requirementsOf(quest: Pick<Quest, 'requirements' | 'gimmicks'>): Requirement[] {
  if (quest.requirements) return quest.requirements
  return (quest.gimmicks ?? []).map((g) => ({ tag: abilityTag(g), count: 2 }))
}

/** タグの表示名（🔥炎、アーク など） */
export function tagLabel(tag: Tag, names: Record<string, string>): string {
  if (tag.startsWith('el:')) {
    const e = tag.slice(3) as Element
    return `${CONFIG.formation.elementIcon[e]}${ELEMENT_LABEL[e]}`
  }
  const pair = comboParts(tag)
  if (pair.length === 2) return `${abilityName(pair[0], names)}と${abilityName(pair[1], names)}を両方`
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

/**
 * 「このモンスターたちが活躍するクエスト」の条件：選んだモンスターの属性とアビリティから作る。
 * 属性は1種類なら3、2種類以上なら2ずつ。アビリティは2ずつ。条件は最大 maxRequirements まで。
 */
export function requirementsFromMonsters(picked: MonsterDef[]): Requirement[] {
  const elements = [...new Set(picked.flatMap((d) => elementInfo(d).elements))]
  const abilities = [...new Set(picked.flatMap((d) => Object.keys(tagsOf(d)).filter((t) => t.startsWith('ab:'))))]
  const perElement = elements.length <= 1 ? 3 : 2
  return [
    ...elements.map((e) => ({ tag: elementTag(e), count: perElement })),
    ...abilities.map((tag) => ({ tag, count: 2 })),
  ].slice(0, CONFIG.formation.maxRequirements)
}

/** 手持ちのモンスター全員で、その条件をいくつ満たせるか（出撃は6体までなので目安） */
export function ownedSupply(tag: Tag, owned: { defId: string }[], defs: MonsterDef[]): number {
  return owned.reduce((sum, o) => {
    const def = defs.find((d) => d.id === o.defId)
    return sum + (def ? (tagsOf(def)[tag] ?? 0) : 0)
  }, 0)
}
