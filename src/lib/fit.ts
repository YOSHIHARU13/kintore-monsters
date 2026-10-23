import { elementInfo, hasAdvantage } from './element'
import { KINDS_TAG, requirementsOf, tagAbilities, tagsOf } from './formation'
import { fitsQuest, gradeOf, GRADES, isCollabHero, matchedAbilities } from './quest'
import { getTemplate } from '../data/evolutionTemplates'
import { ATTR_LABEL, type Attr } from '../data/exercises'
import { monsterName, nodeAttr, type MonsterDef, type Quest } from '../types'

/** 適正：◎（属性が合って、条件のアビリティを2つ以上。条件が1つなら全部）・○（属性が合って、アビリティ1つ） */
export type Fit = 'best' | 'good'

export function fitOf(def: MonsterDef, quest: Quest): Fit | null {
  const reqs = requirementsOf(quest)
  // 属性：ボスに有利か、条件の属性を持つ（零属性のボスなら、どの子もOK）。
  // 零属性の子はどこでも半減されないが、属性の条件は満たさないので、それだけでは適正にしない（どこでも上位を独占しないように）
  const zeroBoss = reqs.some((r) => r.tag === KINDS_TAG) || !quest.element
  const elementOk = zeroBoss || fitsQuest(def, quest)
  if (!elementOk) return null
  const wanted = new Set(reqs.flatMap((r) => tagAbilities(r.tag))).size
  if (wanted === 0) return 'good'
  const have = matchedAbilities(def, quest)
  if (have >= Math.min(2, wanted)) return 'best'
  return have >= 1 ? 'good' : null
}

const gradeRank = (q: Quest) => GRADES.indexOf(gradeOf(q))

/** その子が適正のクエスト（◎が先、格の高い順） */
export function fitQuests(def: MonsterDef, quests: Quest[]): { quest: Quest; fit: Fit }[] {
  return quests
    .filter((q) => q.kind !== 'material')
    .flatMap((quest) => {
      const fit = fitOf(def, quest)
      return fit ? [{ quest, fit }] : []
    })
    .sort((a, b) => Number(b.fit === 'best') - Number(a.fit === 'best') || gradeRank(b.quest) - gradeRank(a.quest))
}

/** 最終形態（分岐があれば全部）の名前と部位 */
export function finalForms(def: MonsterDef): { nodeId: string; name: string; attr: ReturnType<typeof nodeAttr> }[] {
  return getTemplate(def.templateId)
    .nodes.filter((n) => n.next.length === 0)
    .map((n) => ({ nodeId: n.id, name: monsterName(def, n.id), attr: nodeAttr(def, n.id) }))
}

/**
 * 刺さる率：その子1体が、クエストの条件をどれだけ満たすか（条件ごとの求める数で重みづけ。0〜1）。
 * 部位の条件（「脚の子」）は、最終形態のどれかがその部位なら満たす。コラボの子は同じコラボのボスに少し上乗せ
 */
export function fitRate(def: MonsterDef, quest: Quest): number {
  const reqs = requirementsOf(quest)
  if (reqs.length === 0) return hasAdvantage(def, quest.element) ? 1 : 0
  const tags = tagsOf(def)
  const parts = finalForms(def).map((f) => f.attr)
  const meets = (tag: string) => {
    if (tag === KINDS_TAG) return elementInfo(def).elements.length > 0
    if (tag.startsWith('pt:')) return parts.includes(tag.slice(3) as Attr) || parts.includes('none')
    return (tags[tag] ?? 0) > 0
  }
  const total = reqs.reduce((sum, r) => sum + r.count, 0)
  const got = reqs.reduce((sum, r) => sum + (meets(r.tag) ? r.count : 0), 0)
  const rate = total > 0 ? got / total : 0
  return isCollabHero(def, quest) ? Math.min(1, rate + 0.15) : rate
}

/** どの最終形態が適正か：部位の条件があれば、その部位の形態だけ。なければ全部 */
export function fitForms(def: MonsterDef, quest: Quest): { name: string; attr: string; ok: boolean }[] {
  const part = requirementsOf(quest).find((r) => r.tag.startsWith('pt:'))?.tag.slice(3)
  return finalForms(def).map((f) => ({
    name: f.name,
    attr: f.attr === 'none' ? '無' : ATTR_LABEL[f.attr],
    ok: !part || f.attr === part || f.attr === 'none',
  }))
}

/** そのクエストの適正キャラ（刺さる率の高い順。持っていない子も入る）。降臨とガチャの子に分けて使う */
export function fitMembers(quest: Quest, defs: MonsterDef[]): { def: MonsterDef; fit: Fit; rate: number }[] {
  return defs
    .flatMap((def) => {
      const fit = fitOf(def, quest)
      return fit ? [{ def, fit, rate: fitRate(def, quest) }] : []
    })
    .sort(
      (a, b) =>
        b.rate - a.rate ||
        Number(b.fit === 'best') - Number(a.fit === 'best') ||
        matchedAbilities(b.def, quest) - matchedAbilities(a.def, quest),
    )
}

export const FIT_MARK: Record<Fit, string> = { best: '◎', good: '○' }
