import { advantageElements, elementInfo, hasAdvantage } from './element'
import { KINDS_TAG, formationOf, requirementsOf, tagAbilities, tagsOf } from './formation'
import { CONFIG } from '../config/gameConfig'
import { fitsQuest, gradeOf, GRADES, isCollabHero, matchedAbilities, setHit } from './quest'
import { grown } from './lifespan'
import { getTemplate } from '../data/evolutionTemplates'
import { ATTR_LABEL, DAYS, SLOTS, type Attr } from '../data/exercises'
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

/**
 * 1撃の重さ：育ちきった（その部位の最終形態・獣神化できれば★4）1体が、そのクエストの部位の種目1セットで与えるダメージの平均。
 * 攻撃力に、属性（半減・3分の1・零属性）・アビリティ・コラボ・部位一致・ボスの部位・弱点・得意種目の倍率を全部かけたもの（編成倍率はかけない）
 */
export function hitWeight(def: MonsterDef, quest: Quest): number {
  const member = grown(def, quest.attr)
  const day = (Object.keys(DAYS) as (keyof typeof DAYS)[]).find((d) => DAYS[d].attr === quest.attr)
  const slots = SLOTS.filter((s) => s.day === day)
  if (slots.length === 0) return 0
  const total = slots.reduce((sum, s) => sum + setHit({ slotId: s.id, day: s.day, eligible: true }, quest, [member], '').damage, 0)
  return Math.round(total / slots.length)
}

/**
 * そのクエストの適正キャラ：入れたら編成全体のダメージがどれだけ増えるか（貢献）の順。持っていないモンスターも入る。
 * 貢献 ＝ 1撃の重さ ＋ 編成の条件を埋めるぶん（理想の激レア6体の編成のダメージ × そのモンスター1体で上がる編成倍率）。
 * 属性の種類（2属性なら2種類）・アビリティ・部位の条件を埋める役も、ここで評価される。
 * 並ぶのは、属性が合うモンスター（零属性のボスならどれでも）。降臨とガチャに分けて使う
 */
export function fitMembers(
  quest: Quest,
  defs: MonsterDef[],
): { def: MonsterDef; fit: Fit | null; hit: number; support: number; score: number; percent: number }[] {
  const reqs = requirementsOf(quest)
  const zeroBoss = reqs.some((r) => r.tag === KINDS_TAG) || !quest.element
  const base = CONFIG.formation.base
  const measure = (def: MonsterDef) => ({
    hit: hitWeight(def, quest),
    lift: Math.max(0, Math.min(1, formationOf([grown(def, quest.attr).def], reqs).rate) - base),
  })
  const rows = defs.filter((def) => zeroBoss || fitsQuest(def, quest)).map((def) => ({ def, fit: fitOf(def, quest), ...measure(def) }))
  const ideal = measure(idealFor(quest))
  // 編成のダメージの目安：理想の激レア6体ぶん（登録しているモンスターの顔ぶれで%が変わらないように）
  const party = ideal.hit * CONFIG.quest.partySize
  const idealScore = ideal.hit + party * ideal.lift
  return rows
    .map((r) => {
      const support = Math.round(party * r.lift)
      const score = r.hit + support
      return { def: r.def, fit: r.fit, hit: r.hit, support, score, percent: Math.round((score / Math.max(1, idealScore)) * 100) }
    })
    .sort((a, b) => b.score - a.score || b.hit - a.hit)
}

/**
 * 適正度100%の目安：このクエストのためにいるような激レア（有利な属性・求められるアビリティを2つ・ボスの部位）を、育ちきった状態で。
 * 2つ同時に持つ条件があれば、その2つを持つ
 */
function idealFor(quest: Quest): MonsterDef {
  const reqs = requirementsOf(quest)
  const combo = reqs.find((r) => r.tag.startsWith('ab2:'))
  const wanted = combo ? combo.tag.slice(4).split('|') : [...new Set(reqs.flatMap((r) => tagAbilities(r.tag)))]
  return {
    id: 'ideal',
    name: '理想の激レア',
    attr: quest.attr,
    templateId: 'linear3',
    images: {},
    tier: 'superRare',
    element: advantageElements(quest.element)[0] ?? 'fire',
    abilities: wanted.slice(0, 2),
    createdAt: 0,
  }
}

export const FIT_MARK: Record<Fit, string> = { best: '◎', good: '○' }
