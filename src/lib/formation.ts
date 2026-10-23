import { CONFIG } from '../config/gameConfig'
import { ELEMENT_LABEL, elementInfo } from './element'
import { abilityName, abilitySlots } from './gimmick'
import { nodeAttr, type Element, type MonsterDef, type Quest, type Requirement } from '../types'
import { ATTR_LABEL, type Attr } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'

/**
 * 編成：クエストは「求められる人材の条件」（炎が3、アークが3…）を持ち、
 * 出撃する6体の合計でそれを満たしにいく。誰が何を持っていてもよい。
 * タグは「el:炎などの属性」か「ab:アビリティ（ギミック名で持つ）」。
 */
export type Tag = string

export const elementTag = (e: Element): Tag => `el:${e}`
/** 零属性のボスで求める「属性の種類」：パーティにいる属性の種類の数（2属性のジョグレスは1体で2種類、零属性の子は「零」で1種類） */
export const KINDS_TAG: Tag = 'kinds'
/** 部位の条件：その部位（胸腕・脚・背肩）の子◯体。部位限定ガチャの子が活躍する */
export const partTag = (part: Attr): Tag => `pt:${part}`

/** そのモンスターの属性の種類（零属性は 'none'） */
const kindsOfDef = (def: MonsterDef): string[] => {
  const els = elementInfo(def).elements
  return els.length > 0 ? els : ['none']
}

/** パーティにいる属性の種類の数 */
export function kindsOf(party: MonsterDef[]): number {
  return new Set(party.flatMap(kindsOfDef)).size
}
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
  // 部位：持っている個体なら今の形態の部位、そうでなければ第1段階の部位
  const part = def.partNow ?? nodeAttr(def, FIRST_NODE_ID)
  if (part !== 'none') tags[partTag(part)] = 1
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
  if (tag === KINDS_TAG) return '🎨属性の種類'
  if (tag.startsWith('pt:')) return `💪${ATTR_LABEL[tag.slice(3) as Attr]}のモンスター`
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
  total[KINDS_TAG] = kindsOf(party) // 種類は足し算ではなく、重ならない数
  const rows = requirements.map((r) => ({ tag: r.tag, need: r.count, have: total[r.tag] ?? 0 }))
  if (rows.length === 0) return { rows, rate: 1 }
  const fill = rows.reduce((sum, r) => sum + Math.min(1, r.have / Math.max(1, r.need)), 0) / rows.length
  const extra = rows.reduce((sum, r) => sum + Math.max(0, r.have - r.need), 0)
  const rate = Math.min(f.max, f.base + (1 - f.base) * fill + f.perExtra * extra)
  return { rows, rate: Math.round(rate * 100) / 100 }
}

/** そのモンスターが、まだ足りていない条件にいくつ貢献できるか（候補を並べる順番に使う） */
export function shortfallHelp(def: MonsterDef, rows: FormationRow[]): number {
  const tags = { ...tagsOf(def), [KINDS_TAG]: kindsOfDef(def).length }
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
  if (tag === KINDS_TAG) return kindsOf(owned.flatMap((o) => defs.filter((d) => d.id === o.defId)))
  return owned.reduce((sum, o) => {
    const def = defs.find((d) => d.id === o.defId)
    return sum + (def ? (tagsOf(def)[tag] ?? 0) : 0)
  }, 0)
}
