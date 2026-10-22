import { CONFIG } from '../config/gameConfig'
import { habitLabelOf } from './rewards'
import type { BoosterKey, GameState } from '../types'

export const BOOSTER_KEYS: BoosterKey[] = ['habit', 'exp', 'quest']

/** そのブースターが使用中か */
export function boostActive(state: Pick<GameState, 'boosts'>, key: BoosterKey): boolean {
  const b = state.boosts ?? {}
  return key === 'exp' ? (b.expSets ?? 0) > 0 : b[key] === true
}

/** ブースターの名前（習慣ブースターは習慣の名前で。例：瞑想ブースター） */
export function boosterName(state: GameState, key: BoosterKey): string {
  const b = CONFIG.boosters[key]
  return `${b.icon}${key === 'habit' ? habitLabelOf(state) : ''}${b.label}`
}
