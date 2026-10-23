import { CONFIG } from '../config/gameConfig'
import { elementInfo } from './element'
import { formationOf, requirementsOf } from './formation'
import { isLuckMax } from './fusion'
import { abilityRate, fitsQuest, gradeOf, isCollabHero, isStrict, powerOf, type Member } from './quest'
import type { Quest } from '../types'

/** おまかせ編成の型：最強（倍率をとにかく高く）か、運極重視（運極を積めるだけ積んで、編成倍率×1.0はキープ） */
export type PartyMode = 'strongest' | 'luck'

/** 1体の強さ（属性の倍率込み）：零属性は×1.2、超絶以上で属性が合わない子は半減（爆絶は3分の1） */
function memberPower(m: Member, quest: Quest): number {
  const q = CONFIG.quest
  const collab = isCollabHero(m.def, quest) ? q.collabBonus : 1
  const ability = abilityRate(m.def, quest).rate
  return elementPower(m, quest) * collab * ability
}

function elementPower(m: Member, quest: Quest): number {
  const q = CONFIG.quest
  // 零属性のボスには、2属性のモンスターが強い
  if (!quest.element && elementInfo(m.def).elements.length >= 2) return powerOf(m) * q.multiElementBonus
  if (elementInfo(m.def).elements.length === 0) return powerOf(m) * q.zeroBonus
  if (isStrict(quest) && !fitsQuest(m.def, quest)) {
    return powerOf(m) * (gradeOf(quest) === 'bakuzetsu' ? q.offElementBakuzetsu : q.offElementChozetsu)
  }
  return powerOf(m)
}

/** 編成の強さの目安：編成倍率 × 強さの合計 */
export function partyScore(party: Member[], quest: Quest): { rate: number; score: number } {
  const { rate } = formationOf(
    party.map((m) => m.def),
    requirementsOf(quest),
  )
  return { rate, score: rate * party.reduce((sum, m) => sum + memberPower(m, quest), 0) }
}

/** 入れ替えで良くなるかぎり、1体ずつ入れ替える */
function improve(party: Member[], cands: Member[], quest: Quest, ok: (p: Member[]) => boolean): Member[] {
  let best = party
  let bestScore = partyScore(best, quest).score
  for (let round = 0; round < 12; round++) {
    let changed = false
    for (let i = 0; i < best.length; i++) {
      for (const c of cands) {
        if (best.includes(c)) continue
        const next = best.map((m, j) => (j === i ? c : m))
        const s = partyScore(next, quest).score
        if (s > bestScore + 1e-9 && ok(next)) {
          best = next
          bestScore = s
          changed = true
        }
      }
    }
    if (!changed) break
  }
  return best
}

/** おまかせで出撃メンバーを選ぶ（monsterId の並び） */
export function autoParty(cands: Member[], quest: Quest, mode: PartyMode, size = CONFIG.quest.partySize): string[] {
  // 最強：1体ずつ、いちばん強くなる子を足していき、最後に入れ替えで仕上げる
  const party: Member[] = []
  while (party.length < size && party.length < cands.length) {
    const next = cands
      .filter((c) => !party.includes(c))
      .map((c) => ({ c, s: partyScore([...party, c], quest).score }))
      .sort((a, b) => b.s - a.s || powerOf(b.c) - powerOf(a.c))[0]
    party.push(next.c)
  }
  let best = improve(party, cands, quest, () => true)
  if (mode === 'luck') {
    // 運極重視：運極でない子を、運極の子に入れ替えていく（編成倍率は×1.0、届かなければ今の倍率を下回らない）
    const floor = Math.min(1, partyScore(best, quest).rate)
    const lucky = cands.filter((c) => isLuckMax(c.mon))
    for (;;) {
      const swaps = best.flatMap((m, i) =>
        isLuckMax(m.mon)
          ? []
          : lucky
              .filter((c) => !best.includes(c))
              .map((c) => best.map((x, j) => (j === i ? c : x)))
              .filter((p) => partyScore(p, quest).rate >= floor - 1e-9),
      )
      if (swaps.length === 0) break
      best = swaps.sort((a, b) => partyScore(b, quest).score - partyScore(a, quest).score)[0]
    }
    // 運極の数は減らさずに、残りの枠だけ入れ替えで仕上げる
    const count = best.filter((m) => isLuckMax(m.mon)).length
    best = improve(best, cands, quest, (p) => p.filter((m) => isLuckMax(m.mon)).length >= count && partyScore(p, quest).rate >= floor - 1e-9)
  }
  return best.map((m) => m.mon.id)
}
