import { CONFIG } from '../config/gameConfig'
import { DAYS, SLOTS } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { advantageElements, elementInfo } from './element'
import { abilityTag, elementTag, requirementsOf } from './formation'
import { rarityOf } from './gacha'
import { nodeAttr, type MonsterDef, type Quest, type QuestGrade, type RarityKey, type Requirement } from '../types'

/** 文字列から決まる数（同じボスなら毎回同じ結果に） */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * おまかせのクエスト：ボスの属性に有利な属性（適正）と、アビリティの条件・弱点種目を自動で決める。
 * アビリティは、ほかのクエストであまり求められていないものから選ぶ（偏らないように）。
 */
export function autoQuestSetup(
  boss: MonsterDef,
  grade: QuestGrade,
  kind: Quest['kind'],
  quests: Pick<Quest, 'requirements' | 'gimmicks' | 'id'>[],
  gimmicks: string[],
  selfId?: string,
): { requirements: Requirement[]; weakSlots: string[] } {
  const a = CONFIG.questAuto[kind === 'material' ? 'material' : grade]
  const seed = hash(boss.id + grade + (kind ?? 'boss'))
  const requirements: Requirement[] = []
  const adv = advantageElements(elementInfo(boss).elements[0])[0]
  if (adv) requirements.push({ tag: elementTag(adv), count: a.element })
  // ほかのクエストで求められている回数が少ないアビリティから
  const used: Record<string, number> = {}
  for (const q of quests) {
    if (q.id === selfId) continue
    for (const r of requirementsOf(q)) used[r.tag] = (used[r.tag] ?? 0) + 1
  }
  const ranked = gimmicks
    .map((g, i) => ({ g, n: used[abilityTag(g)] ?? 0, tie: (i + seed) % gimmicks.length }))
    .sort((x, y) => x.n - y.n || x.tie - y.tie)
  for (const { g } of ranked.slice(0, a.abilities)) requirements.push({ tag: abilityTag(g), count: a.abilityCount })
  // 弱点種目：ボスの部位の日の種目から（部位がなければどれでも）
  const attr = nodeAttr(boss, FIRST_NODE_ID)
  const day = (Object.keys(DAYS) as (keyof typeof DAYS)[]).find((d) => DAYS[d].attr === attr)
  const pool = SLOTS.filter((s) => s.day !== 'bonus' && (!day || s.day === day)).map((s) => s.id)
  const weakSlots = Array.from({ length: Math.min(a.weak, pool.length) }, (_, i) => pool[(seed + i * 2) % pool.length])
  return { requirements, weakSlots: [...new Set(weakSlots)] }
}

/** まとめて作るときの格：レア度から（激レア→超絶、ノーマル→究極、ハズレ→極） */
const GRADE_BY_RARITY: Record<RarityKey, QuestGrade> = { hazure: 'kiwami', normal: 'kyukyoku', superRare: 'chozetsu' }

export function autoGradeOf(def: MonsterDef): QuestGrade {
  return GRADE_BY_RARITY[rarityOf(def)]
}
