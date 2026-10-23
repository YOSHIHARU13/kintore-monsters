import { elementInfo } from './element'
import { KINDS_TAG, requirementsOf, tagAbilities } from './formation'
import { fitsQuest, gradeOf, GRADES, matchedAbilities } from './quest'
import type { MonsterDef, Quest } from '../types'

/** 適正：◎（属性が合って、条件のアビリティを2つ以上。条件が1つなら全部）・○（属性が合って、アビリティ1つ） */
export type Fit = 'best' | 'good'

export function fitOf(def: MonsterDef, quest: Quest): Fit | null {
  const reqs = requirementsOf(quest)
  // 属性：ボスに有利か、条件の属性を持つ（零属性の子・零属性のボスなら、どの子もOK）
  const zeroBoss = reqs.some((r) => r.tag === KINDS_TAG) || !quest.element
  const elementOk = zeroBoss || elementInfo(def).elements.length === 0 || fitsQuest(def, quest)
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

/** そのクエストの適正キャラ（◎が先。持っていない子も入る） */
export function fitMembers(quest: Quest, defs: MonsterDef[]): { def: MonsterDef; fit: Fit }[] {
  return defs
    .flatMap((def) => {
      const fit = fitOf(def, quest)
      return fit ? [{ def, fit }] : []
    })
    .sort((a, b) => Number(b.fit === 'best') - Number(a.fit === 'best') || matchedAbilities(b.def, quest) - matchedAbilities(a.def, quest))
}

export const FIT_MARK: Record<Fit, string> = { best: '◎', good: '○' }
