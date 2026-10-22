import { ATTRS, SLOTS, type Attr, type FormAttr } from '../data/exercises'
import { getTemplate } from '../data/evolutionTemplates'
import { abilitySlots } from './gimmick'
import { ELEMENTS, advantageElements, elementInfo } from './element'
import { abilityTag, elementTag, requirementsOf, tagLabel, tagsOf } from './formation'
import { isHidden, nodeAttr, type Element, type MonsterDef, type Quest } from '../types'

/**
 * 登録画面で「何が足りていて、何が余っているか」を見るための集計。
 * have = 持っている（登録済みの）モンスターの数、need = それを求めているクエストの数
 */
export interface Supply {
  have: number
  need: number
}

/** 不足しているか：求めているクエストがあるのに、持っているモンスターが少ない */
export function isShort(s: Supply): boolean {
  return s.need > 0 && s.have < s.need
}

/** 最終形態の属性（分岐があれば複数）。クエストで戦うのは育ちきった姿なので、ここで数える */
export function finalAttrs(def: Pick<MonsterDef, 'templateId' | 'attr' | 'attrs'>): FormAttr[] {
  const finals = getTemplate(def.templateId).nodes.filter((n) => n.next.length === 0)
  return [...new Set(finals.map((n) => nodeAttr(def as MonsterDef, n.id)))]
}

/** 自分以外の、戦力になるモンスター（隠しモンスターも含む） */
function others(defs: MonsterDef[], selfId: string | undefined): MonsterDef[] {
  return defs.filter((d) => d.id !== selfId)
}

/** 部位（胸腕・脚・背肩）の内訳。部位は「いつ攻撃するか」なので、相性の需要はない */
export function attrSupply(defs: MonsterDef[], _quests: Quest[], selfId?: string): Record<Attr, Supply> {
  const list = others(defs, selfId)
  return Object.fromEntries(
    ATTRS.map((a) => [a, { have: list.filter((d) => finalAttrs(d).includes(a)).length, need: 0 }]),
  ) as Record<Attr, Supply>
}

/** そのクエストがその属性を求めているか：ボスに有利な属性か、編成の条件にある属性 */
export function wantsElement(quest: Quest, e: Element): boolean {
  return advantageElements(quest.element).includes(e) || requirementsOf(quest).some((r) => r.tag === elementTag(e))
}

/** 属性（炎・水・木・光・闇）の内訳：持っている数と、その属性を求めるクエストの数 */
export function elementSupply(defs: MonsterDef[], quests: Quest[], selfId?: string): Record<Element, Supply> {
  const list = others(defs, selfId)
  return Object.fromEntries(
    ELEMENTS.map((e) => [
      e,
      {
        have: list.filter((d) => elementInfo(d).elements.includes(e)).length,
        need: quests.filter((q) => wantsElement(q, e)).length,
      },
    ]),
  ) as Record<Element, Supply>
}

export function abilitySupply(gimmick: string, defs: MonsterDef[], quests: Quest[], selfId?: string): Supply {
  return {
    have: others(defs, selfId).filter((d) => (d.abilities ?? []).slice(0, abilitySlots(d)).includes(gimmick)).length,
    need: quests.filter((q) => requirementsOf(q).some((r) => r.tag === abilityTag(gimmick))).length,
  }
}

export function slotSupply(slotId: string, defs: MonsterDef[], quests: Quest[], selfId?: string): Supply {
  return {
    have: others(defs, selfId).filter((d) => d.favoriteSlot === slotId).length,
    need: quests.filter((q) => q.weakSlots.includes(slotId)).length,
  }
}

export interface Fit {
  quest: Quest
  grade: '◎' | '×'
  reasons: string[]
}

/** 今の設定で、各クエストの編成にどれくらい貢献できるか（貢献できる条件があれば◎） */
export function questFits(draft: MonsterDef, quests: Quest[], names: Record<string, string>): Fit[] {
  const own = tagsOf(draft)
  return quests.map((quest) => {
    const reasons = requirementsOf(quest)
      .filter((r) => own[r.tag])
      .map((r) => `${tagLabel(r.tag, names)}${own[r.tag] > 1 ? `×${own[r.tag]}` : ''}`)
    if (draft.favoriteSlot && quest.weakSlots.includes(draft.favoriteSlot)) reasons.push('得意種目が弱点')
    return { quest, grade: reasons.length > 0 ? '◎' : '×', reasons }
  })
}

/** 部位・属性・得意種目・アビリティが全部同じモンスター */
export function similarDefs(draft: MonsterDef, defs: MonsterDef[]): MonsterDef[] {
  const key = (d: MonsterDef) =>
    [finalAttrs(d).sort().join(), elementInfo(d).elements.join(), d.favoriteSlot ?? '', [...(d.abilities ?? []).slice(0, abilitySlots(d))].sort().join()].join('|')
  const mine = key(draft)
  return others(defs, draft.id).filter((d) => !isHidden(d) || isHidden(draft)).filter((d) => key(d) === mine)
}

/** 足りないものを埋めるおすすめ：不足が大きい順（同じなら、求めるボスが多い順、それも同じなら持っている数が少ない順） */
export function recommend(
  defs: MonsterDef[],
  quests: Quest[],
  gimmicks: string[],
  slots: number,
  selfId?: string,
  slotIds: string[] = SLOTS.map((s) => s.id), // 得意種目にできる種目（モンスターの部位で決まる）
  fixedElement?: Element, // 属性が決まっているモンスターは、その属性のまま考える
): { element: Element; favoriteSlot: string; abilities: string[] } {
  const gap = (s: Supply) => s.need - s.have
  const byGap = <T>(items: T[], supply: (t: T) => Supply) =>
    [...items].sort(
      (a, b) => gap(supply(b)) - gap(supply(a)) || supply(b).need - supply(a).need || supply(a).have - supply(b).have,
    )
  const els = elementSupply(defs, quests, selfId)
  const element = fixedElement ?? byGap(ELEMENTS, (e) => els[e])[0]
  // アビリティと得意種目は「同じ属性の中で」足りないものを選ぶ（闇のクエストに行くのは光のモンスターなので、光の中での層の厚さが大事）
  const sameElement = defs.filter((d) => elementInfo(d).elements.includes(element))
  const relevant = quests.filter((q) => wantsElement(q, element))
  const pool = relevant.length > 0 ? relevant : quests
  return {
    element,
    favoriteSlot: byGap(slotIds, (s) => slotSupply(s, sameElement, pool, selfId))[0] ?? '',
    abilities: byGap(gimmicks, (g) => abilitySupply(g, sameElement, pool, selfId)).slice(0, slots),
  }
}
