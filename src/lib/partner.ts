import { CONFIG } from '../config/gameConfig'
import { attackOf } from './stats'
import { customized, isFavorite } from './custom'
import type { MonsterDef, OwnedMonster } from '../types'

/** そのモンスターを、その種目の枠の相棒にしたときのEXP倍率 */
export function partnerRate(mon: OwnedMonster, def: MonsterDef, slotId: string): number {
  const { perAttack, favorite } = CONFIG.partner
  const base = 1 + perAttack * attackOf(mon, def)
  const rate = isFavorite(customized(def, mon), slotId) ? base * favorite : base
  return Math.round(rate * 100) / 100
}

/** その枠の相棒と倍率（相棒がいなければ null） */
export function partnerOf(
  slotId: string,
  partners: Record<string, string>,
  owned: OwnedMonster[],
  defs: MonsterDef[],
): { mon: OwnedMonster; def: MonsterDef; rate: number } | null {
  const mon = owned.find((o) => o.id === partners[slotId])
  const def = mon && defs.find((d) => d.id === mon.defId)
  if (!mon || !def) return null
  return { mon, def, rate: partnerRate(mon, def, slotId) }
}

/** 倍率の表示（例：×1.35） */
export function rateText(rate: number): string {
  return `×${rate.toFixed(2).replace(/0$/, '').replace(/\.$/, '')}`
}

/**
 * 相棒のおまかせ：全部の種目の枠に、倍率がいちばん高くなるように1体ずつ割り当てる。
 * （枠×モンスターの組を倍率の高い順に見て、空いている枠と、まだ使っていないモンスターを組ませていく）
 */
export function autoPartners(slotIds: string[], owned: OwnedMonster[], defs: MonsterDef[]): Record<string, string> {
  const pairs = slotIds.flatMap((slotId) =>
    owned.flatMap((mon) => {
      const def = defs.find((d) => d.id === mon.defId)
      return def ? [{ slotId, mon, rate: partnerRate(mon, def, slotId) }] : []
    }),
  )
  pairs.sort((a, b) => b.rate - a.rate)
  const result: Record<string, string> = {}
  const used = new Set<string>()
  for (const p of pairs) {
    if (result[p.slotId] || used.has(p.mon.id)) continue
    result[p.slotId] = p.mon.id
    used.add(p.mon.id)
  }
  return result
}
