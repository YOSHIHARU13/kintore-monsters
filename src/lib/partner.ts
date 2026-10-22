import { CONFIG } from '../config/gameConfig'
import { attackOf } from './stats'
import type { MonsterDef, OwnedMonster } from '../types'

/** そのモンスターを、その種目の枠の相棒にしたときのEXP倍率 */
export function partnerRate(mon: OwnedMonster, def: MonsterDef, slotId: string): number {
  const { perAttack, favorite } = CONFIG.partner
  const base = 1 + perAttack * attackOf(mon, def)
  const rate = def.favoriteSlot === slotId ? base * favorite : base
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
