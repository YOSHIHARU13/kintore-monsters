import { isHidden, type Element, type MonsterDef } from '../types'

export const ELEMENTS: Element[] = ['fire', 'water', 'wood', 'light', 'dark']

export const ELEMENT_LABEL: Record<Element, string> = { fire: '炎', water: '水', wood: '木', light: '光', dark: '闇' }

/** 属性がない子・ボスの呼び名（光や闇に寄らない「何もない」質感で「零」） */
export const ZERO_LABEL = '零属性'

export const ELEMENT_COLOR: Record<Element, string> = {
  fire: '#ff6b4a',
  water: '#4cc9f0',
  wood: '#7bd36a',
  light: '#ffd166',
  dark: '#b388ff',
}

/** そのモンスターの属性。ジョグレスは素材から決まる（同じ属性なら超属性、違えば複合属性） */
export interface ElementInfo {
  elements: Element[] // 0個（零属性）・1個・2個（複合）
  super: boolean // 超属性（有利な相手にさらに強い）
}

export function elementInfo(def: MonsterDef): ElementInfo {
  if (isHidden(def)) return { elements: def.jogressElements ?? [], super: def.jogressSuper === true }
  if (def.goldElements) return { elements: def.goldElements, super: def.goldSuper === true }
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

/** 属性の表示（例：炎、超炎、炎×水、零属性） */
export function elementName(info: ElementInfo): string {
  if (info.elements.length === 0) return ZERO_LABEL
  const names = info.elements.map((e) => ELEMENT_LABEL[e]).join('×')
  return info.super ? `超${names}` : names
}

/** 属性の相性：炎→木→水→炎（矢印の先に強い）、光と闇はお互いに強い（モンストと同じ） */
const BEATS: Record<Element, Element[]> = {
  fire: ['wood'],
  wood: ['water'],
  water: ['fire'],
  light: ['dark'],
  dark: ['light'],
}

/** ボスの属性に有利な属性（適正） */
export function advantageElements(boss: Element | undefined): Element[] {
  if (!boss) return []
  return ELEMENTS.filter((e) => BEATS[e].includes(boss))
}

/** そのモンスターが、ボスの属性に有利な属性を持っているか（複合属性はどちらかで有利ならOK） */
export function hasAdvantage(def: MonsterDef, boss: Element | undefined): boolean {
  const adv = advantageElements(boss)
  return elementInfo(def).elements.some((e) => adv.includes(e))
}
