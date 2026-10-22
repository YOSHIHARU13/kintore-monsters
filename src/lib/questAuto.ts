import { CONFIG } from '../config/gameConfig'
import { DAYS, SLOTS } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { advantageElements, elementInfo } from './element'
import { abilityTag, comboTag, elementTag, requirementsOf, tagAbilities } from './formation'
import { abilitySlots } from './gimmick'
import { rarityOf } from './gacha'
import { seriesOf } from './series'
import { tagMates } from './tags'
import { nodeAttr, type Element, type MonsterDef, type Quest, type QuestGrade, type RarityKey, type Requirement } from '../types'

/** 文字列から決まる数（同じボスなら毎回同じ結果に） */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * おまかせのクエスト：格に合わせて、編成の条件と弱点種目を自動で決める。
 * - ボスとタグが一致する子（因縁のある仲間・同じコラボ）がいれば、どの格でも、その子たちが刺さる条件にする（不利な属性でも）
 * - いなければ、ボスに有利な属性＋実際に誰かが持っているギミック（超絶以上は2つを両方もつ）
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
  useTags = true, // false なら、タグの仲間は見ない（試練の塔：超絶クエストとは別のギミックにするため）
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
  // 登録されているモンスター（降臨以外）が実際に持っているアビリティだけから選ぶ（誰も持っていない条件にしない）
  const holders = defs.filter((d) => !d.questOnly)
  const have = (g: string) => holders.filter((d) => slotted(d).includes(g)).length
  const real = gimmicks.filter((g) => have(g) > 0)
  const ranked = (holders.length > 0 ? real : gimmicks)
    .map((g, i) => ({ g, n: used[g] ?? 0, tie: (i + seed) % gimmicks.length }))
    .sort((x, y) => x.n - y.n || have(y.g) - have(x.g) || x.tie - y.tie)
    .map((x) => x.g)
  // 2つを両方持つ組み合わせ：実際にその2つを持っている子がいるものから
  const pairs = commonPairs(holders)

  let requirements: Requirement[] = []
  let heroId: string | undefined
  // ボスとタグが一致する子（因縁のある仲間・同じコラボ）がいれば、その子たちが刺さる条件にする
  const mates = kind === 'material' || !useTags ? [] : tagMates(boss, defs).slice(0, 3)
  if (mates.length > 0) {
    heroId = mates[0].id
    requirements = basisRequirements({ kind: 'hero', heroes: mates }, grade, boss)
  } else if (kind !== 'material') {
    // タグの仲間がいなければ、ふつうに「ボスに有利な属性＋実際に誰かが持っているギミック」（無茶な条件にしない）
    const gi = GRADE_INDEX[grade]
    if (adv) requirements.push({ tag: elementTag(adv), count: ADV_ELEMENT[gi] })
    const pair = [...pairs].sort((x, y) => (used[x.a] ?? 0) + (used[x.b] ?? 0) - ((used[y.a] ?? 0) + (used[y.b] ?? 0)) || y.n - x.n)[0]
    if (gi >= 3 && pair) requirements.push({ tag: comboTag(pair.a, pair.b), count: ABILITY[gi] })
    else if (gi >= 1 && ranked[0]) requirements.push({ tag: abilityTag(ranked[0]), count: ABILITY[gi] })
    // 超究極は、もう1つギミックを足す
    const extra = ranked.find((g) => !requirements.some((r) => tagAbilities(r.tag).includes(g)))
    if (gi >= 4 && extra) requirements.push({ tag: abilityTag(extra), count: 2 })
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


/** まとめて作るときの格：レア度から（激レア→超絶、ノーマル→究極、ハズレ→上級） */
const GRADE_BY_RARITY: Record<RarityKey, QuestGrade> = { hazure: 'jokyu', normal: 'kyukyoku', superRare: 'chozetsu' }

export function autoGradeOf(def: MonsterDef): QuestGrade {
  // コラボの激レアは超究極
  if (rarityOf(def) === 'superRare' && seriesOf(def) !== '') return 'chokyukyoku'
  return GRADE_BY_RARITY[rarityOf(def)]
}

/** 条件の作り方：刺さるキャラ・接待するギミック・属性のどれかから */
export type Basis =
  | { kind: 'hero'; heroes: MonsterDef[] } // 1〜3体。その子たちに共通する属性とアビリティから
  | { kind: 'gimmicks'; gimmicks: string[] } // 1つか2つ（2つなら「両方もつ」）
  | { kind: 'elements'; elements: Element[] } // 1つか2つ

const GRADE_INDEX: Record<QuestGrade, number> = { jokyu: 0, kiwami: 1, kyukyoku: 2, chozetsu: 3, chokyukyoku: 4 }
// 格ごとの数：属性1つ・属性2つ（それぞれ）・アビリティ（両方もつも同じ）
const ONE_ELEMENT = [1, 2, 3, 3, 4]
const TWO_ELEMENTS = [1, 1, 2, 3, 3]
const ABILITY = [1, 1, 2, 2, 3]
// タグの仲間がいないときの、ボスに有利な属性の数
const ADV_ELEMENT = [1, 2, 3, 4, 4]
// 刺さるキャラから作るとき、理想の6体が満たす数のどれくらいを求めるか（上級は軽く、超究極は理想どおり）
const GRADE_SCALE = [0.34, 0.5, 0.67, 0.84, 1]

/** 理想の6体：条件を多く持つ子ほど多く入れる（1体なら6体、2体なら4＋2、3体なら4＋1＋1） */
export function idealParty(heroes: MonsterDef[]): MonsterDef[] {
  const richness = (d: MonsterDef) => elementInfo(d).elements.length + slotted(d).length
  const sorted = [...heroes].sort((a, b) => richness(b) - richness(a)).slice(0, 3)
  const weights = sorted.length === 1 ? [6] : sorted.length === 2 ? [4, 2] : [4, 1, 1]
  return sorted.flatMap((d, i) => Array.from({ length: weights[i] }, () => d))
}

/**
 * 選んだもとから、格に合った編成の条件を作る。
 * キャラなら「その子の属性＋アビリティ（2つ持っていれば両方もつ）」、ギミックなら「そのアビリティ＋ボスに有利な属性」、
 * 属性なら「その属性＋あまり使われていないアビリティ（extraAbility）」。
 */
export function basisRequirements(basis: Basis, grade: QuestGrade, boss: MonsterDef | undefined, extraAbility?: string): Requirement[] {
  const g = GRADE_INDEX[grade]
  const adv = advantageElements(boss ? elementInfo(boss).elements[0] : undefined)[0]
  const els = (list: Element[], superEl = false): Requirement[] =>
    list.length >= 2
      ? list.slice(0, 2).map((e) => ({ tag: elementTag(e), count: TWO_ELEMENTS[g] }))
      : list.map((e) => ({ tag: elementTag(e), count: ONE_ELEMENT[g] + (superEl ? 1 : 0) }))
  const abil = (list: string[]): Requirement[] =>
    list.length >= 2 ? [{ tag: comboTag(list[0], list[1]), count: ABILITY[g] }] : list.map((x) => ({ tag: abilityTag(x), count: ABILITY[g] }))
  let reqs: Requirement[] = []
  if (basis.kind === 'hero') {
    // 理想の6体：いちばん属性・アビリティを多く持つ子を中心に（4体）、ほかの子で残りを埋める。
    // 条件の数は、その6体が満たす数から逆算する（だから、選んだ子たちで組むと最適になる）
    const party = idealParty(basis.heroes)
    const scale = GRADE_SCALE[g]
    const need = (has: (d: MonsterDef) => number) =>
      Math.max(1, Math.round(party.reduce((sum, d) => sum + has(d), 0) * scale))
    const elCount: Partial<Record<Element, number>> = {}
    for (const d of party) for (const e of elementInfo(d).elements) elCount[e] = (elCount[e] ?? 0) + 1
    const topEls = (Object.keys(elCount) as Element[]).sort((a, b) => elCount[b]! - elCount[a]!).slice(0, 2)
    const pair = commonPairs(basis.heroes)[0]
    const abCount: Record<string, number> = {}
    for (const d of party) for (const x of slotted(d)) abCount[x] = (abCount[x] ?? 0) + 1
    const topAb = Object.keys(abCount).sort((a, b) => abCount[b] - abCount[a])[0]
    reqs = [
      ...topEls.map((e) => ({ tag: elementTag(e), count: need((d) => (elementInfo(d).elements.includes(e) ? (elementInfo(d).super ? 2 : 1) : 0)) })),
      ...(pair
        ? [{ tag: comboTag(pair.a, pair.b), count: need((d) => (slotted(d).includes(pair.a) && slotted(d).includes(pair.b) ? 1 : 0)) }]
        : topAb
          ? [{ tag: abilityTag(topAb), count: need((d) => (slotted(d).includes(topAb) ? 1 : 0)) }]
          : []),
    ]
  } else if (basis.kind === 'gimmicks') {
    reqs = [...(adv ? els([adv]) : []), ...abil(basis.gimmicks)]
  } else {
    reqs = [...els(basis.elements), ...(g >= 1 && extraAbility ? abil([extraAbility]) : [])]
  }
  return reqs.slice(0, CONFIG.formation.maxRequirements)
}

/** その子が実際に使えるアビリティ（持てる数まで） */
const slotted = (d: MonsterDef) => (d.abilities ?? []).slice(0, abilitySlots(d))

/** 「両方もつ」の組み合わせと、それを持っている子の数（多い順） */
export function commonPairs(defs: MonsterDef[]): { a: string; b: string; n: number }[] {
  const count: Record<string, { a: string; b: string; n: number }> = {}
  for (const d of defs) {
    const list = slotted(d)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]].sort()
        const key = `${a}|${b}`
        count[key] = { a, b, n: (count[key]?.n ?? 0) + 1 }
      }
  }
  return Object.values(count).sort((x, y) => y.n - x.n)
}

