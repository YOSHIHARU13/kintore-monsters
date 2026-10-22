import { CONFIG } from '../config/gameConfig'
import { isHidden, type Element, type MonsterDef } from '../types'

export const ELEMENTS: Element[] = ['fire', 'water', 'wood', 'light', 'dark']

export const ELEMENT_LABEL: Record<Element, string> = { fire: '炎', water: '水', wood: '木', light: '光', dark: '闇' }

export const ELEMENT_COLOR: Record<Element, string> = {
  fire: '#ff6b4a',
  water: '#4cc9f0',
  wood: '#7bd36a',
  light: '#ffd166',
  dark: '#b388ff',
}

/** 属性の相性：炎→木→水→炎（矢印の先に強い）、光と闇はお互いに強い */
const BEATS: Record<Element, Element[]> = {
  fire: ['wood'],
  wood: ['water'],
  water: ['fire'],
  light: ['dark'],
  dark: ['light'],
}

/** そのモンスターの属性。ジョグレスは素材から決まる（同じ属性なら超属性、違えば複合属性） */
export interface ElementInfo {
  elements: Element[] // 0個（無属性）・1個・2個（複合）
  super: boolean // 超属性（有利な相手にさらに強い）
}

export function elementInfo(def: MonsterDef): ElementInfo {
  if (isHidden(def)) return { elements: def.jogressElements ?? [], super: def.jogressSuper === true }
  return { elements: def.element ? [def.element] : [], super: false }
}

/** ジョグレスの属性：素材の属性が同じなら超属性、違えば複合属性 */
export function jogressElementOf(recipe: string[], defs: MonsterDef[]): ElementInfo {
  const parents = recipe.map((id) => defs.find((d) => d.id === id))
  const els = parents.flatMap((p) => (p ? elementInfo(p).elements : []))
  const unique = [...new Set(els)]
  if (unique.length === 1 && els.length >= 2) return { elements: unique, super: true }
  return { elements: unique.slice(0, 2), super: false }
}

/** 属性の表示（例：炎、超炎、炎×水、無属性） */
export function elementName(info: ElementInfo): string {
  if (info.elements.length === 0) return '無属性'
  const names = info.elements.map((e) => ELEMENT_LABEL[e]).join('×')
  return info.super ? `超${names}` : names
}

/**
 * 属性の倍率。有利なら ×advantage（超属性なら ×superAdvantage）、不利なら ×disadvantage。
 * 複合属性は、どちらかで有利なら有利。どちらも不利のときだけ不利（片方の不利は打ち消される）。
 */
export function elementRate(attacker: ElementInfo, boss: Element | undefined): number {
  const q = CONFIG.quest
  if (!boss || attacker.elements.length === 0) return 1
  const rates = attacker.elements.map((e) =>
    BEATS[e].includes(boss) ? (attacker.super ? q.superAdvantage : q.advantage) : BEATS[boss].includes(e) ? q.disadvantage : 1,
  )
  const best = Math.max(...rates)
  if (best > 1) return best
  return rates.every((r) => r < 1) ? q.disadvantage : 1
}

/** ボスに有利な属性（適正） */
export function advantageElements(boss: Element | undefined): Element[] {
  if (!boss) return []
  return ELEMENTS.filter((e) => BEATS[e].includes(boss))
}
