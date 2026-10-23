import { CONFIG } from '../config/gameConfig'
import { DAYS, SLOTS } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { ELEMENTS, advantageElements, elementInfo } from './element'
import { KINDS_TAG, abilityTag, comboTag, elementTag, requirementsOf, tagAbilities } from './formation'
import { abilitySlots } from './gimmick'
import { bossGradeOf, rarityOf } from './gacha'
import { collabMates, seriesOf } from './series'
import { nodeAttr, type Element, type MonsterDef, type Quest, type QuestDifficulty, type QuestGrade, type RarityKey, type Requirement } from '../types'

/** 文字列から決まる数（同じボスなら毎回同じ結果に） */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** そのボスのふつうのクエストで求めているアビリティ */
export function ownAbilities(quests: Pick<Quest, 'kind' | 'bossDefId' | 'requirements' | 'gimmicks'>[], bossId: string): string[] {
  return quests.filter((q) => q.kind !== 'material' && q.bossDefId === bossId).flatMap((q) => requirementsOf(q).flatMap((r) => tagAbilities(r.tag)))
}

/** そのクエストの条件で、その子が刺さるか（有利な属性を持ち、求められるアビリティを1つ以上持つ） */
function covers(d: MonsterDef, reqs: Requirement[]): boolean {
  const els = elementInfo(d).elements
  const elReqs = reqs.filter((r) => r.tag.startsWith('el:')).map((r) => r.tag.slice(3))
  const elOk = reqs.some((r) => r.tag === KINDS_TAG) ? els.length > 0 : elReqs.length === 0 || els.some((e) => elReqs.includes(e))
  const wanted = new Set(reqs.flatMap((r) => tagAbilities(r.tag)))
  return elOk && wanted.size > 0 && slotted(d).some((g) => wanted.has(g))
}

/** ほかのクエストで、その子がいくつ刺さっているか */
export function coverageOf(d: MonsterDef, quests: Pick<Quest, 'requirements' | 'gimmicks' | 'id'>[], selfId?: string): number {
  return quests.filter((q) => q.id !== selfId && covers(d, requirementsOf(q))).length
}

/**
 * 主役（スポットライト）：まだ刺さるクエストが少ないガチャの子から、このボスに有利な属性を持つ子を1体選ぶ。
 * その子のアビリティを条件に入れるので、どの子にも「ここなら活躍する」クエストができる（激レアが先）
 */
export function spotlightOf(
  boss: MonsterDef,
  quests: Pick<Quest, 'requirements' | 'gimmicks' | 'id'>[],
  defs: MonsterDef[],
  selfId?: string,
): MonsterDef | undefined {
  const bossEl = elementInfo(boss).elements[0]
  const adv = advantageElements(bossEl)[0]
  const rank: Record<RarityKey, number> = { superRare: 0, rare: 1, normal: 2 }
  const seed = hash(boss.id)
  return defs
    .filter((d) => !d.questOnly && !d.recipe?.length && d.id !== boss.id && slotted(d).length > 0)
    .filter((d) => (bossEl ? !!adv && elementInfo(d).elements.includes(adv) : elementInfo(d).elements.length > 0))
    .map((d) => ({ d, n: coverageOf(d, quests, selfId), r: rank[rarityOf(d)], tie: hash(d.id + seed) }))
    .sort((x, y) => x.n - y.n || x.r - y.r || x.tie - y.tie)[0]?.d
}

/**
 * おまかせのクエスト：基本は「弱点属性＋アビリティの持ち物検査」（モンストと同じ）。格が上がるほど、どちらも増える。
 * - 有利な属性 element 体（零属性のボスは、属性の種類 kinds 種類。2属性のジョグレスは1体で2種類）
 * - アビリティ abilities 種類 × abilityCount 体（1体1つずつでよい）。爆絶は「1体で2つ同時に持つ子」combo 体も
 * - アビリティは、まず主役（まだ刺さるクエストが少ないガチャの子）が持っているものから。残りは、ほかのクエストであまり求められていない順
 * コラボのボスは、同じコラボの子が活躍する条件にする（刺さるクエストが少ない子から）。
 * こうして、どの子にも1つは「ここなら活躍する」クエストができ、特定の子が独占しないようにする
 */
export function autoQuestSetup(
  boss: MonsterDef,
  grade: QuestGrade,
  kind: Quest['kind'],
  quests: Pick<Quest, 'requirements' | 'gimmicks' | 'id'>[],
  gimmicks: string[],
  selfId?: string,
  defs: MonsterDef[] = [],
  useCollab = true, // false なら、コラボの子も見ない（試練の塔）
  difficulty: QuestDifficulty = 'normal', // 素材クエストの難易度
  avoid: string[] = [], // 使わないアビリティ（塔などで、そのボスのふつうのクエストと同じにしないため）
  highEnd?: HighEndSet[], // 高難度：これまでの階で求めたアビリティの組（選んだ組をここに足す）。あれば、モンスターを見ずに組み合わせだけで決める
): { requirements: Requirement[]; weakSlots: string[]; heroId?: string } {
  const a = kind === 'material' ? CONFIG.questAuto.material[difficulty] : CONFIG.questAuto[grade]
  const seed = hash(boss.id + grade + (kind ?? 'boss'))
  const bossEl = elementInfo(boss).elements[0]
  const adv = advantageElements(bossEl)[0]
  // ほかのクエストで求められている回数が少ないアビリティから
  const used: Record<string, number> = {}
  for (const q of quests) {
    if (q.id === selfId) continue
    for (const r of requirementsOf(q)) for (const g of tagAbilities(r.tag)) used[g] = (used[g] ?? 0) + 1
  }
  // 登録されているモンスターが実際に持っているアビリティだけから選ぶ（誰も持っていない条件にしない）
  const holders = defs.filter((d) => d.id !== boss.id)
  const have = (g: string) => holders.filter((d) => slotted(d).includes(g)).length
  const real = gimmicks.filter((g) => have(g) > 0)
  const base = holders.length > 0 ? real : gimmicks
  const fresh = base.filter((g) => !avoid.includes(g))
  const ranked = (fresh.length > 0 ? fresh : base)
    .map((g, i) => ({ g, n: used[g] ?? 0, tie: (i + seed) % Math.max(1, gimmicks.length) }))
    .sort((x, y) => x.n - y.n || have(y.g) - have(x.g) || x.tie - y.tie)
    .map((x) => x.g)

  let requirements: Requirement[] = []
  let heroId: string | undefined
  // コラボのボスは、同じコラボの子が活躍する条件にする（刺さるクエストが少ない子から。同じ子が独占しないように）
  const mates =
    kind === 'material' || !useCollab
      ? []
      : collabMates(boss, defs)
          .map((d) => ({ d, n: coverageOf(d, quests, selfId), r: rarityOf(d) === 'superRare' ? 0 : 1, tie: hash(d.id + seed) }))
          .sort((x, y) => x.n - y.n || x.r - y.r || x.tie - y.tie)
          .map((x) => x.d)
          .slice(0, 3)
  if (mates.length > 0) {
    heroId = mates[0].id
    requirements = basisRequirements({ kind: 'hero', heroes: mates }, grade, boss)
  } else {
    // 弱点属性（零属性のボスは、属性の種類）
    if (bossEl ? adv && a.element > 0 : a.kinds > 0)
      requirements.push(...(bossEl ? [{ tag: elementTag(adv), count: a.element }] : zeroElementRequirements(a, seed)))
    if (highEnd) {
      // 高難度：今いるモンスターに合わせず、これまでの階となるべく重ならないアビリティの組（個性優先）
      if (a.abilities > 0) {
        const k = Math.max(a.abilities, CONFIG.questAuto.highEndAbilities)
        const pool = gimmicks.filter((g) => !avoid.includes(g))
        const element = bossEl ?? 'none'
        const set = pickSet(pool.length >= k ? pool : gimmicks, k, highEnd, seed, element)
        if (a.combo > 0 && set.length >= 2) {
          const pair = leastUsedPair(set, highEnd, element)
          requirements.push({ tag: comboTag(pair[0], pair[1]), count: a.combo })
        }
        for (const g of set) requirements.push({ tag: abilityTag(g), count: a.abilityCount })
        highEnd.push({ set, element, combo: requirements.find((r) => r.tag.startsWith('ab2:'))?.tag })
      }
      return finish(requirements, boss, seed, a.weak)
    }
    // 主役のアビリティを先に（ほかのクエストであまり使われていない順）
    const star = kind === 'material' || a.abilities === 0 ? undefined : spotlightOf(boss, quests, defs, selfId)
    const starAbilities = star ? ranked.filter((g) => slotted(star).includes(g)) : []
    // 2つ同時に持つ子：主役が2つ持っていればその2つ。なければ、実際にその2つを持っている子がいる組み合わせから
    let picked: string[] = []
    if (a.combo > 0) {
      const pair =
        starAbilities.length >= 2
          ? { a: starAbilities[0], b: starAbilities[1] }
          : commonPairs(holders)
              .filter((p) => ranked.includes(p.a) && ranked.includes(p.b))
              .sort((x, y) => (used[x.a] ?? 0) + (used[x.b] ?? 0) - ((used[y.a] ?? 0) + (used[y.b] ?? 0)) || y.n - x.n)[0]
      if (pair) {
        picked = [pair.a, pair.b]
        requirements.push({ tag: comboTag(pair.a, pair.b), count: a.combo })
      }
    }
    picked = [...picked, ...starAbilities.filter((g) => !picked.includes(g)), ...ranked.filter((g) => !picked.includes(g) && !starAbilities.includes(g))].slice(
      0,
      a.abilities,
    )
    for (const g of picked) requirements.push({ tag: abilityTag(g), count: a.abilityCount })
  }
  return { ...finish(requirements, boss, seed, a.weak), heroId }
}

/** 条件を上限までに切り、弱点種目（ボスの部位の種目から。部位がなければどれでも）を付ける */
function finish(requirements: Requirement[], boss: MonsterDef, seed: number, weak: number): { requirements: Requirement[]; weakSlots: string[] } {
  const attr = nodeAttr(boss, FIRST_NODE_ID)
  const day = (Object.keys(DAYS) as (keyof typeof DAYS)[]).find((d) => DAYS[d].attr === attr)
  const pool = SLOTS.filter((s) => s.day !== 'bonus' && (!day || s.day === day)).map((s) => s.id)
  const weakSlots = Array.from({ length: Math.min(weak, pool.length) }, (_, i) => pool[(seed + i * 2) % pool.length])
  return { requirements: requirements.slice(0, CONFIG.formation.maxRequirements), weakSlots: [...new Set(weakSlots)] }
}

/** 高難度の1階ぶんのアビリティの組と、その階のボスの属性（零属性は none）・「2つ同時」の組 */
export interface HighEndSet {
  set: string[]
  element: string
  combo?: string // 「2つ同時に持つ」の組（comboTag）
}

/** 高難度のほかの階で求めたアビリティの組（塔 → 禁筋 → 孤城と、前の高難度と重ならないように） */
export function abilitySets(quests: Pick<Quest, 'requirements' | 'gimmicks' | 'element'>[]): HighEndSet[] {
  return quests
    .map((q) => ({
      set: requirementsOf(q).filter((r) => r.tag.startsWith('ab:')).map((r) => r.tag.slice(3)),
      element: q.element ?? 'none',
      combo: requirementsOf(q).find((r) => r.tag.startsWith('ab2:'))?.tag,
    }))
    .filter((s) => s.set.length > 0)
}

/**
 * 零属性のボスの属性の条件：ふつうは「属性の種類」。爆絶は「3属性×3体ずつ」（ボスごとに決まる3属性）。
 * 6体で9体ぶん要るので、2属性のモンスター（金の獣神化など）がいないと満たせない
 */
function zeroElementRequirements(a: (typeof CONFIG.questAuto)[QuestGrade], seed: number): Requirement[] {
  const split = 'zeroSplit' in a ? a.zeroSplit : 0
  if (!split) return a.kinds > 0 ? [{ tag: KINDS_TAG, count: a.kinds }] : []
  const start = seed % ELEMENTS.length
  return Array.from({ length: split }, (_, i) => ({ tag: elementTag(ELEMENTS[(start + i * 2) % ELEMENTS.length]), count: CONFIG.quest.partySize / 2 }))
}

/** k 個の組み合わせを全部 */
function subsets(pool: string[], k: number): string[][] {
  if (k === 0) return [[]]
  if (pool.length < k) return []
  const [head, ...rest] = pool
  return [...subsets(rest, k - 1).map((s) => [head, ...s]), ...subsets(rest, k)]
}

const pairsOf = (s: string[]) => subsets(s, 2).map(([a, b]) => comboTag(a, b))

/**
 * 高難度のアビリティの組。いちばん大事なのは「同じ属性の階（同じ属性のモンスターが刺さる階）で、アビリティの2つの組み合わせが均等に出る」こと：
 * 塔・禁筋・孤城を全部合わせて、その属性の階でまだ出ていない組み合わせを含む組を選ぶ（出た回数の2乗で数える）。
 * こうすると、アビリティ2つのモンスターなら、どの組み合わせでも同じくらいの数の階に刺さる（特定のモンスターだけ何か所も、がなくなる）。
 * 次に、全体で同じアビリティばかりにならないように。同じくらいなら seed で決める（月のパターンで変わる）
 */
export function pickSet(pool: string[], k: number, taken: HighEndSet[], seed: number, element = 'none'): string[] {
  const options = subsets([...new Set(pool)], Math.min(k, pool.length))
  const key = (s: string[]) => [...s].sort().join('+')
  const takenKeys = new Set(taken.filter((t) => t.element === element).map((t) => key(t.set)))
  const pairUse: Record<string, number> = {}
  for (const t of taken) if (t.element === element) for (const p of pairsOf(t.set)) pairUse[p] = (pairUse[p] ?? 0) + 1
  const single: Record<string, number> = {}
  for (const t of taken) for (const g of t.set) single[g] = (single[g] ?? 0) + 1
  const score = (s: string[]) =>
    (takenKeys.has(key(s)) ? 1e6 : 0) + 100 * pairsOf(s).reduce((sum, p) => sum + (pairUse[p] ?? 0) ** 2, 0) + s.reduce((sum, g) => sum + (single[g] ?? 0), 0)
  return options
    .map((s, i) => ({ s, v: score(s), tie: hash(`${seed}:${i}`) }))
    .sort((a, b) => a.v - b.v || a.tie - b.tie)[0]?.s ?? []
}

/** 組の中から「2つ同時に持つ」の組：同じ属性の階でまだド適正にしていない組み合わせ（ド適正も均等に） */
function leastUsedPair(set: string[], taken: HighEndSet[], element: string): [string, string] {
  const used = (tag: string) => taken.filter((t) => t.element === element && t.combo === tag).length
  return (subsets(set, 2) as [string, string][]).sort((a, b) => used(comboTag(a[0], a[1])) - used(comboTag(b[0], b[1])))[0]
}

/** おまかせの作り方の版。作り方を変えたら上げる（今あるボスクエストの条件を1回だけ作り直す） */
export const QUEST_RULES = 4

/** ガチャの子がボスのときの格：レア度から（激レア→超絶、レア→究極、ノーマル→上級） */
const GRADE_BY_RARITY: Record<RarityKey, QuestGrade> = { normal: 'jokyu', rare: 'kyukyoku', superRare: 'chozetsu' }

/** そのボスのクエストの格：降臨は格のまま。ガチャの子はレア度から */
export function autoGradeOf(def: MonsterDef): QuestGrade {
  const grade = bossGradeOf(def)
  if (grade) return grade
  // コラボの激レアは超究極
  if (rarityOf(def) === 'superRare' && seriesOf(def) !== '') return 'chokyukyoku'
  return GRADE_BY_RARITY[rarityOf(def)]
}

/** 条件の作り方：刺さるキャラ・接待するギミック・属性のどれかから */
export type Basis =
  | { kind: 'hero'; heroes: MonsterDef[] } // 1〜3体。その子たちに共通する属性とアビリティから
  | { kind: 'gimmicks'; gimmicks: string[] } // 1つか2つ（2つなら「両方もつ」）
  | { kind: 'elements'; elements: Element[] } // 1つか2つ

const GRADE_INDEX: Record<QuestGrade, number> = { jokyu: 0, kiwami: 1, kyukyoku: 2, chozetsu: 3, chokyukyoku: 4, bakuzetsu: 5 }
// 格ごとの数：属性1つ・属性2つ（それぞれ）・アビリティ（両方もつも同じ）
const ONE_ELEMENT = [1, 2, 3, 3, 4, 5]
const TWO_ELEMENTS = [1, 1, 2, 3, 3, 3]
const ABILITY = [1, 1, 2, 2, 3, 3]
// 刺さるキャラから作るとき、理想の6体が満たす数のどれくらいを求めるか（上級は軽く、超究極は理想どおり）
const GRADE_SCALE = [0.34, 0.5, 0.67, 0.84, 1, 1]

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


/** 高難度の役割：塔の11階・禁筋の獄の最上階・零の孤城の城主・孤城限定（1〜10階） */
export type BossRole = 'tower' | 'kinkinLord' | 'castleLord' | 'castleOnly'

/** 高難度専用のボス（塔の11階・禁筋の最上階・孤城の城主・孤城限定）。ふつうのクエストは作らない・出さない */
export const isHighEndOnly = (d: Pick<MonsterDef, 'tower' | 'castleLord' | 'castleOnly' | 'kinkinLord'>) =>
  !!(d.tower || d.castleLord || d.castleOnly || d.kinkinLord)

/**
 * 降臨のボスクエストを、降臨の格と部位に合わせるための書き込み（なければ新しく作る）。
 * 合っていれば null。塔限定・城主は塔と孤城で出るので作らない
 */
export function bossQuestSync(
  boss: MonsterDef,
  quests: (Pick<Quest, 'id' | 'kind' | 'bossDefId' | 'grade' | 'attr' | 'requirements' | 'gimmicks'>)[],
  gimmicks: string[],
  defs: MonsterDef[],
  hpOf: (grade: QuestGrade) => number,
): { id: string | null; data: Partial<Quest> } | null {
  const grade = bossGradeOf(boss)
  if (!grade || isHighEndOnly(boss)) return null
  const current = quests.find((q) => q.kind !== 'material' && q.bossDefId === boss.id)
  const attr = nodeAttr(boss, FIRST_NODE_ID)
  if (current && current.grade === grade && current.attr === attr) return null
  const r = autoQuestSetup(boss, grade, 'boss', quests, gimmicks, current?.id, defs)
  const hp = hpOf(grade)
  const changed = { grade, attr, hp: { easy: hp, normal: hp, hard: hp }, requirements: r.requirements, weakSlots: r.weakSlots }
  if (current) return { id: current.id, data: changed }
  return {
    id: null,
    data: { name: '', kind: 'boss', bossDefId: boss.id, customGimmicks: {}, rank: 1, catchphrase: '', theme: 'flame', ...changed },
  }
}
