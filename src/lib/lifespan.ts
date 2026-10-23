import { CONFIG } from '../config/gameConfig'
import { getTemplate } from '../data/evolutionTemplates'
import { ATTRS } from '../data/exercises'
import { autoParty } from './autoParty'
import { customized } from './custom'
import { ELEMENTS, advantageElements, hasAdvantage } from './element'
import { rarityOf } from './gacha'
import { requirementsOf, tagAbilities } from './formation'
import { sessionEstimate, type Member } from './quest'
import { canShinkaDef } from './shinka'
import { isHidden, nodeAttr, type MonsterDef, type OwnedMonster, type Quest } from '../types'

/**
 * コンテンツの寿命の目安：登録している子を全員持っていて、育ちきっている（最終形態・獣神化できる子は★4）と考えて、
 * 零の孤城の各階を最強の6体で1日ぶんのメニュー（その部位の種目＋全身枠）をこなしたら倒せるか。
 * 全部の階が1日で倒せるようになったら「楽勝」＝新しいギミックや高難度を足しどき
 */

/** 育ちきった1体（分岐は、その部位の最終形態があればそれ） */
function grown(def: MonsterDef, part: string): Member {
  const finals = getTemplate(def.templateId).nodes.filter((n) => n.next.length === 0)
  const node = finals.find((n) => nodeAttr(def, n.id) === part) ?? finals[0]
  const mon: OwnedMonster = { id: `v-${def.id}`, defId: def.id, nodeId: node.id, obtainedAt: 0, luck: 1, shinka: canShinkaDef(def) }
  return { mon, def: customized(def, mon) }
}

/** 候補を絞る（強い子と、条件に合う子だけ。計算を軽くするため） */
function candidates(defs: MonsterDef[], quest: Quest): Member[] {
  const wanted = new Set(requirementsOf(quest).flatMap((r) => tagAbilities(r.tag)))
  const score = (d: MonsterDef) =>
    (hasAdvantage(d, quest.element) || !quest.element ? 2 : 0) + (d.abilities ?? []).filter((g) => wanted.has(g)).length
  return defs
    .filter((d) => !isHidden(d))
    .map((d) => ({ d, s: score(d) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, CONFIG.lifespan.pool)
    .map((x) => grown(x.d, quest.attr))
}

/** その階を、1日ぶんのメニューでどれだけ削れるか（HPに対する割合。1以上なら1日で倒せる） */
export function floorRatio(quest: Quest, defs: MonsterDef[]): number {
  const cands = candidates(defs, quest)
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

/** 足していく仮の激レア */
function newcomer(i: number, element: MonsterDef['element'], abilities: string[], part: (typeof ATTRS)[number]): MonsterDef {
  return {
    id: `sim-${i}`,
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

const allEasy = (floors: Quest[], defs: MonsterDef[]) => floors.every((q) => floorRatio(q, defs) >= CONFIG.lifespan.easyRatio)

/**
 * 決まった順で足していく激レアのうち、先頭から何体足せば全部の階が楽勝になるか（上限まで届かなければ null）。
 * 足すほど強くなるので、倍々で当たりを付けてから二分探索する（1回の判定が重いので）
 */
function countUntilEasy(defs: MonsterDef[], floorsOf: FloorsOf, adds: MonsterDef[]): number | null {
  const easyWith = (n: number) => {
    const working = [...defs, ...adds.slice(0, n)]
    return allEasy(floorsOf(working), working)
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

export function lifespanOf(defs: MonsterDef[], floorsOf: FloorsOf, gimmicks: string[]): Lifespan {
  const max = CONFIG.lifespan.maxAdds
  const floors = floorsOf(defs)
  const ratios = floors.map((q, i) => ({ floor: i + 1, ratio: floorRatio(q, defs) }))
  // 最短：まだ楽勝でない階に（苦しい階から順に、くり返し）、ぴったり刺さる子（有利な属性・求められるアビリティ・その部位）を足していく
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
  const best = hard.length === 0 ? 0 : countUntilEasy(defs, floorsOf, ideal)
  // 目安：属性・アビリティ・部位がばらばらの子を足していく（何通りか試して平均）
  const pool = gimmicks.length > 0 ? gimmicks : [...new Set(defs.flatMap((d) => d.abilities ?? []))]
  const runs =
    hard.length === 0
      ? [0]
      : Array.from({ length: CONFIG.lifespan.runs }, (_, run) => {
          const r = seeded(run * 7919 + 17)
          const adds = Array.from({ length: max }, (_, i) => {
            const a = pool[Math.floor(r() * pool.length)]
            const b = pool[Math.floor(r() * pool.length)]
            return newcomer(i, ELEMENTS[Math.floor(r() * ELEMENTS.length)], [...new Set([a, b].filter(Boolean))], ATTRS[Math.floor(r() * ATTRS.length)])
          })
          return countUntilEasy(defs, floorsOf, adds)
        })
  const done = runs.filter((n): n is number => n !== null)
  const typical = done.length === runs.length ? Math.round(done.reduce((s, n) => s + n, 0) / done.length) : null
  return { floors: ratios, easy: ratios.length - hard.length, best, typical }
}

/** 今いる激レアの数（寿命の目安と並べて出す） */
export const superRareCount = (defs: MonsterDef[]) => defs.filter((d) => !d.questOnly && !isHidden(d) && rarityOf(d) === 'superRare').length
