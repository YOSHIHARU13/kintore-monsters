import { CONFIG } from '../config/gameConfig'
import { getTemplate } from '../data/evolutionTemplates'
import { ATTRS } from '../data/exercises'
import { autoParty } from './autoParty'
import { customized } from './custom'
import { ELEMENTS, advantageElements, hasAdvantage } from './element'
import { rarityOf } from './gacha'
import { requirementsOf, tagAbilities } from './formation'
import { powerOf, sessionEstimate, type Member } from './quest'
import { canShinkaDef } from './shinka'
import { isHidden, nodeAttr, type MonsterDef, type OwnedMonster, type Quest } from '../types'

/**
 * コンテンツの寿命の目安：零の孤城の各階を、最強の6体で「1日ぶんのメニュー」をこなしたら倒せるか。
 * 1日ぶんのメニュー＝その月の部位の種目（4〜5種目）と全身枠1種目を、それぞれ基本の3セット。
 * 全部の階が1日で倒せるようになったら「楽勝」＝新しいギミックや高難度を足しどき。
 * 見方は2つ：登録しているモンスターを全員持っていて育ちきっている「理想」と、実際に持っているモンスターの「手持ち」
 */

/** 育ちきった1体（分岐は、その部位の最終形態があればそれ） */
export function grown(def: MonsterDef, part: string): Member {
  const finals = getTemplate(def.templateId).nodes.filter((n) => n.next.length === 0)
  const node = finals.find((n) => nodeAttr(def, n.id) === part) ?? finals[0]
  const mon: OwnedMonster = { id: `v-${def.id}`, defId: def.id, nodeId: node.id, obtainedAt: 0, luck: 1, shinka: canShinkaDef(def) }
  return { mon, def: customized(def, mon) }
}

/** 実際に持っているモンスター（今の育ち具合のまま。強い順） */
export function ownedMembers(owned: OwnedMonster[], defs: MonsterDef[]): Member[] {
  const byId = new Map(defs.map((d) => [d.id, d]))
  return owned
    .flatMap((mon) => {
      const def = byId.get(mon.defId)
      return def ? [{ mon, def: customized(def, mon) }] : []
    })
    .sort((a, b) => powerOf(b) - powerOf(a))
}

/** 候補を絞る（強いモンスターと、条件に合うモンスターだけ。計算を軽くするため。同じ点なら並びの先が優先） */
function shortlist<T>(items: T[], defOf: (t: T) => MonsterDef, quest: Quest): T[] {
  const wanted = new Set(requirementsOf(quest).flatMap((r) => tagAbilities(r.tag)))
  const score = (d: MonsterDef) =>
    (hasAdvantage(d, quest.element) || !quest.element ? 2 : 0) + (d.abilities ?? []).filter((g) => wanted.has(g)).length
  return items
    .map((t, i) => ({ t, s: score(defOf(t)), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, CONFIG.lifespan.pool)
    .map((x) => x.t)
}

/** その階で出撃できる候補：登録（と、足していく仮の激レア）から、その階のぶんを作る */
export type Pool = (defs: MonsterDef[], quest: Quest) => Member[]

/** 理想：登録しているモンスターを全員、育ちきった状態で持っている */
export const idealPool: Pool = (defs, quest) =>
  shortlist(
    defs.filter((d) => !isHidden(d)),
    (d) => d,
    quest,
  ).map((d) => grown(d, quest.attr))

/** 手持ち：持っているモンスター（今の育ち具合）＋足していく仮の激レア（育ちきった状態） */
export function ownedPool(members: Member[]): Pool {
  return (defs, quest) =>
    shortlist(
      [...members, ...defs.filter((d) => d.id.startsWith(SIM_PREFIX)).map((d) => grown(d, quest.attr))],
      (m) => m.def,
      quest,
    )
}

/** その階を、1日ぶんのメニューでどれだけ削れるか（HPに対する割合。1以上なら1日で倒せる） */
export function floorRatio(quest: Quest, cands: Member[]): number {
  const ids = autoParty(cands, quest, 'strongest')
  const party = cands.filter((c) => ids.includes(c.mon.id))
  const damage = Math.max(0, ...sessionEstimate(quest, party).map((s) => s.damage))
  return damage / Math.max(1, quest.hp.normal)
}

export interface Lifespan {
  floors: { floor: number; ratio: number }[]
  easy: number // 1日で倒せる階の数
  best: number | null // ぴったり刺さる激レアなら、あと何体で全部の階が楽勝か（届かなければ null）
  typical: number | null // ふつうに（属性・アビリティがばらばらの）激レアを足していったら、あと何体くらいか
}

type FloorsOf = (defs: MonsterDef[]) => Quest[]

const SIM_PREFIX = 'sim-'

/** 足していく仮の激レア */
function newcomer(i: number, element: MonsterDef['element'], abilities: string[], part: (typeof ATTRS)[number]): MonsterDef {
  return {
    id: `${SIM_PREFIX}${i}`,
    name: `新しい激レア${i + 1}`,
    attr: part,
    templateId: 'linear3',
    images: {},
    tier: 'superRare',
    element,
    abilities,
    createdAt: Number.MAX_SAFE_INTEGER - 1000 + i,
  }
}

/** 文字列で決まる乱数（毎回同じ結果に） */
function seeded(seed: number): () => number {
  let h = seed >>> 0 || 1
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return (h >>> 0) / 4294967296
  }
}

const allEasy = (floors: Quest[], defs: MonsterDef[], pool: Pool) =>
  floors.every((q) => floorRatio(q, pool(defs, q)) >= CONFIG.lifespan.easyRatio)

/**
 * 決まった順で足していく激レアのうち、先頭から何体足せば全部の階が楽勝になるか（上限まで届かなければ null）。
 * 足すほど強くなるので、倍々で当たりを付けてから二分探索する（1回の判定が重いので）
 */
function countUntilEasy(defs: MonsterDef[], floorsOf: FloorsOf, pool: Pool, adds: MonsterDef[]): number | null {
  const easyWith = (n: number) => {
    const working = [...defs, ...adds.slice(0, n)]
    return allEasy(floorsOf(working), working, pool)
  }
  if (easyWith(0)) return 0
  let hi = 1
  while (hi < adds.length && !easyWith(hi)) hi *= 2
  hi = Math.min(hi, adds.length)
  if (!easyWith(hi)) return null
  let lo = Math.floor(hi / 2)
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (easyWith(mid)) hi = mid
    else lo = mid
  }
  return hi
}

export function lifespanOf(defs: MonsterDef[], floorsOf: FloorsOf, gimmicks: string[], pool: Pool = idealPool): Lifespan {
  const max = CONFIG.lifespan.maxAdds
  const floors = floorsOf(defs)
  const ratios = floors.map((q, i) => ({ floor: i + 1, ratio: floorRatio(q, pool(defs, q)) }))
  // 最短：まだ楽勝でない階に（苦しい階から順に、くり返し）、ぴったり刺さるモンスター（有利な属性・求められるアビリティ・その部位）を足していく
  const hard = ratios
    .filter((f) => f.ratio < CONFIG.lifespan.easyRatio)
    .sort((a, b) => a.ratio - b.ratio)
    .map((f) => floors[f.floor - 1])
  const ideal = hard.length === 0
    ? []
    : Array.from({ length: max }, (_, i) => {
        const q = hard[i % hard.length]
        const el = advantageElements(q.element)[0] ?? ELEMENTS[i % ELEMENTS.length]
        const abilities = [...new Set(requirementsOf(q).flatMap((r) => tagAbilities(r.tag)))].slice(0, 2)
        return newcomer(i, el, abilities, q.attr as (typeof ATTRS)[number])
      })
  const best = hard.length === 0 ? 0 : countUntilEasy(defs, floorsOf, pool, ideal)
  // 目安：属性・アビリティ・部位がばらばらの激レアを足していく（何通りか試して平均）
  const abilityPool = gimmicks.length > 0 ? gimmicks : [...new Set(defs.flatMap((d) => d.abilities ?? []))]
  const runs =
    hard.length === 0
      ? [0]
      : Array.from({ length: CONFIG.lifespan.runs }, (_, run) => {
          const r = seeded(run * 7919 + 17)
          const adds = Array.from({ length: max }, (_, i) => {
            const a = abilityPool[Math.floor(r() * abilityPool.length)]
            const b = abilityPool[Math.floor(r() * abilityPool.length)]
            return newcomer(i, ELEMENTS[Math.floor(r() * ELEMENTS.length)], [...new Set([a, b].filter(Boolean))], ATTRS[Math.floor(r() * ATTRS.length)])
          })
          return countUntilEasy(defs, floorsOf, pool, adds)
        })
  const done = runs.filter((n): n is number => n !== null)
  const typical = done.length === runs.length ? Math.round(done.reduce((s, n) => s + n, 0) / done.length) : null
  return { floors: ratios, easy: ratios.length - hard.length, best, typical }
}

/** 今いる激レアの数（寿命の目安と並べて出す） */
export const superRareCount = (defs: MonsterDef[]) => defs.filter((d) => !d.questOnly && !isHidden(d) && rarityOf(d) === 'superRare').length

/** 理想と手持ちの寿命。手持ちは「今の手持ちを全員育てきったら」何階を1日で倒せるかも出す */
export interface Lifespans {
  ideal: Lifespan
  mine: Lifespan & { grownEasy: number }
}

export function lifespansOf(defs: MonsterDef[], owned: OwnedMonster[], floorsOf: FloorsOf, gimmicks: string[]): Lifespans {
  const members = ownedMembers(owned, defs)
  const mine = lifespanOf(defs, floorsOf, gimmicks, ownedPool(members))
  // 手持ちの種類だけで、全員育ちきったら
  const ownedIds = new Set(owned.map((o) => o.defId))
  const grownPool: Pool = (list, quest) => idealPool(list.filter((d) => ownedIds.has(d.id)), quest)
  const grownEasy = floorsOf(defs).filter((q) => floorRatio(q, grownPool(defs, q)) >= CONFIG.lifespan.easyRatio).length
  return { ideal: lifespanOf(defs, floorsOf, gimmicks), mine: { ...mine, grownEasy } }
}
