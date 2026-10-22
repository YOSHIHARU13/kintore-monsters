import { ATTRS, SLOTS, type Attr, type FormAttr } from '../data/exercises'
import { getTemplate } from '../data/evolutionTemplates'
import { abilitySlots, unmatchedGimmicks } from './gimmick'
import { advantageAttr, affinity } from './quest'
import { isHidden, nodeAttr, type MonsterDef, type Quest } from '../types'

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

export function attrSupply(defs: MonsterDef[], quests: Quest[], selfId?: string): Record<Attr, Supply> {
  const list = others(defs, selfId)
  return Object.fromEntries(
    ATTRS.map((a) => [
      a,
      {
        have: list.filter((d) => finalAttrs(d).includes(a)).length,
        need: quests.filter((q) => advantageAttr(q.attr) === a).length,
      },
    ]),
  ) as Record<Attr, Supply>
}

export function abilitySupply(gimmick: string, defs: MonsterDef[], quests: Quest[], selfId?: string): Supply {
  return {
    have: others(defs, selfId).filter((d) => (d.abilities ?? []).slice(0, abilitySlots(d)).includes(gimmick)).length,
    need: quests.filter((q) => q.gimmicks?.includes(gimmick)).length,
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
  grade: '◎' | '○' | '×'
  reasons: string[]
}

/** 今の設定で、各クエストにどれくらい刺さるか */
export function questFits(draft: MonsterDef, quests: Quest[], abilityLabel: (g: string) => string): Fit[] {
  const attrs = finalAttrs(draft)
  return quests.map((quest) => {
    const best = Math.max(...attrs.map((a) => affinity(a, quest.attr)))
    const missing = unmatchedGimmicks(draft, quest)
    const covered = (quest.gimmicks ?? []).filter((g) => !missing.includes(g))
    const fav = !!draft.favoriteSlot && quest.weakSlots.includes(draft.favoriteSlot)
    const reasons: string[] = []
    if (best > 1) reasons.push('相性◎')
    if (best < 1) reasons.push('相性×')
    reasons.push(...covered.map(abilityLabel))
    if (missing.length > 0) reasons.push(`${missing.join('・')}で弱体`)
    if (fav) reasons.push('得意種目が弱点')
    // 相性・ギミック・得意種目をまとめて点数にする
    const score = (best > 1 ? 2 : best < 1 ? -2 : 0) - missing.length + (fav ? 1 : 0)
    const grade = score >= 2 ? '◎' : score >= 0 ? '○' : '×'
    return { quest, grade, reasons }
  })
}

/** 属性・得意種目・アビリティが全部同じモンスター */
export function similarDefs(draft: MonsterDef, defs: MonsterDef[]): MonsterDef[] {
  const key = (d: MonsterDef) =>
    [finalAttrs(d).sort().join(), d.favoriteSlot ?? '', [...(d.abilities ?? []).slice(0, abilitySlots(d))].sort().join()].join('|')
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
): { attr: Attr; favoriteSlot: string; abilities: string[] } {
  const gap = (s: Supply) => s.need - s.have
  const byGap = <T>(items: T[], supply: (t: T) => Supply) =>
    [...items].sort(
      (a, b) => gap(supply(b)) - gap(supply(a)) || supply(b).need - supply(a).need || supply(a).have - supply(b).have,
    )
  const attrs = attrSupply(defs, quests, selfId)
  return {
    attr: byGap(ATTRS, (a) => attrs[a])[0],
    favoriteSlot: byGap(
      SLOTS.map((s) => s.id),
      (s) => slotSupply(s, defs, quests, selfId),
    )[0],
    abilities: byGap(gimmicks, (g) => abilitySupply(g, defs, quests, selfId)).slice(0, slots),
  }
}
