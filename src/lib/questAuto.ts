import { CONFIG } from '../config/gameConfig'
import { DAYS, SLOTS } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { ELEMENTS, advantageElements, elementInfo } from './element'
import { abilityTag, comboTag, elementTag, requirementsOf, tagAbilities } from './formation'
import { abilitySlots } from './gimmick'
import { rarityOf } from './gacha'
import { seriesOf } from './series'
import { isHidden, nodeAttr, type MonsterDef, type Quest, type QuestGrade, type RarityKey, type Requirement } from '../types'

/** 文字列から決まる数（同じボスなら毎回同じ結果に） */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * おまかせのクエスト：格に合わせて、編成の条件と弱点種目を自動で決める。
 * - 上級・極：ボスに有利な属性（適正）＋アビリティ
 * - 究極：2つの属性を半分ずつ（例：炎2・水2）＋アビリティ
 * - 超絶・超究極：「刺さるキャラ」を1体決めて、その子の属性とアビリティ2つを「両方もつ」条件にする
 *   （超究極は同じコラボの子から）。いなければ、2つの属性を3ずつ＋アビリティ2つを両方もつ。
 * アビリティは、ほかのクエストであまり求められていないものから選ぶ（偏らないように）。
 */
export function autoQuestSetup(
  boss: MonsterDef,
  grade: QuestGrade,
  kind: Quest['kind'],
  quests: Pick<Quest, 'requirements' | 'gimmicks' | 'id'>[],
  gimmicks: string[],
  selfId?: string,
  defs: MonsterDef[] = [],
): { requirements: Requirement[]; weakSlots: string[]; heroId?: string } {
  const a = CONFIG.questAuto[kind === 'material' ? 'material' : grade]
  const seed = hash(boss.id + grade + (kind ?? 'boss'))
  const bossEl = elementInfo(boss).elements[0]
  const adv = advantageElements(bossEl)[0]
  // ほかのクエストで求められている回数が少ないアビリティから
  const used: Record<string, number> = {}
  for (const q of quests) {
    if (q.id === selfId) continue
    for (const r of requirementsOf(q)) for (const g of tagAbilities(r.tag)) used[g] = (used[g] ?? 0) + 1
  }
  const ranked = gimmicks
    .map((g, i) => ({ g, n: used[g] ?? 0, tie: (i + seed) % gimmicks.length }))
    .sort((x, y) => x.n - y.n || x.tie - y.tie)
    .map((x) => x.g)
  // 2つ目の属性：有利な属性とボスの属性以外から
  const second = ELEMENTS.filter((e) => e !== adv && e !== bossEl)[seed % 3]

  let requirements: Requirement[] = []
  let heroId: string | undefined
  if (kind !== 'material' && (grade === 'chozetsu' || grade === 'chokyukyoku')) {
    const hero = pickHero(boss, grade, defs, seed)
    if (hero) {
      heroId = hero.id
      const el = elementInfo(hero)
      const [g1, g2] = (hero.abilities ?? []).slice(0, abilitySlots(hero))
      if (el.super) requirements.push({ tag: elementTag(el.elements[0]), count: 4 })
      else if (el.elements.length >= 2) for (const e of el.elements.slice(0, 2)) requirements.push({ tag: elementTag(e), count: 2 })
      else if (el.elements[0]) requirements.push({ tag: elementTag(el.elements[0]), count: 3 })
      requirements.push({ tag: comboTag(g1, g2), count: grade === 'chokyukyoku' ? 3 : 2 })
      // ボスに有利な属性も少し（刺さるキャラの属性と同じなら足さない）
      if (adv && !requirements.some((r) => r.tag === elementTag(adv))) requirements.push({ tag: elementTag(adv), count: 2 })
    } else {
      if (adv) requirements.push({ tag: elementTag(adv), count: 3 })
      if (second) requirements.push({ tag: elementTag(second), count: 3 })
      if (ranked.length >= 2) requirements.push({ tag: comboTag(ranked[0], ranked[1]), count: 2 })
    }
  } else if (kind !== 'material' && grade === 'kyukyoku') {
    if (adv) requirements.push({ tag: elementTag(adv), count: 2 })
    if (second) requirements.push({ tag: elementTag(second), count: 2 })
    for (const g of ranked.slice(0, a.abilities)) requirements.push({ tag: abilityTag(g), count: a.abilityCount })
  } else {
    if (adv) requirements.push({ tag: elementTag(adv), count: a.element })
    for (const g of ranked.slice(0, a.abilities)) requirements.push({ tag: abilityTag(g), count: a.abilityCount })
  }
  requirements = requirements.slice(0, CONFIG.formation.maxRequirements)
  // 弱点種目：ボスの部位の種目から（部位がなければどれでも）
  const attr = nodeAttr(boss, FIRST_NODE_ID)
  const day = (Object.keys(DAYS) as (keyof typeof DAYS)[]).find((d) => DAYS[d].attr === attr)
  const pool = SLOTS.filter((s) => s.day !== 'bonus' && (!day || s.day === day)).map((s) => s.id)
  const weakSlots = Array.from({ length: Math.min(a.weak, pool.length) }, (_, i) => pool[(seed + i * 2) % pool.length])
  return { requirements, weakSlots: [...new Set(weakSlots)], heroId }
}

/** 刺さるキャラ：アビリティを2つ以上持つ、ガチャの激レアかジョグレス。超究極はボスと同じコラボの子を優先 */
function pickHero(boss: MonsterDef, grade: QuestGrade, defs: MonsterDef[], seed: number): MonsterDef | undefined {
  const able = defs.filter(
    (d) => !d.questOnly && (isHidden(d) || rarityOf(d) === 'superRare') && (d.abilities ?? []).slice(0, abilitySlots(d)).length >= 2,
  )
  const series = seriesOf(boss)
  const same = able.filter((d) => series !== '' && seriesOf(d) === series)
  const pool = grade === 'chokyukyoku' && same.length > 0 ? same : able
  return pool.length > 0 ? pool[seed % pool.length] : undefined
}

/** まとめて作るときの格：レア度から（激レア→超絶、ノーマル→究極、ハズレ→上級） */
const GRADE_BY_RARITY: Record<RarityKey, QuestGrade> = { hazure: 'jokyu', normal: 'kyukyoku', superRare: 'chozetsu' }

export function autoGradeOf(def: MonsterDef): QuestGrade {
  // コラボの激レアは超究極
  if (rarityOf(def) === 'superRare' && seriesOf(def) !== '') return 'chokyukyoku'
  return GRADE_BY_RARITY[rarityOf(def)]
}
