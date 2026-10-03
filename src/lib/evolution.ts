import { CONFIG } from '../config/gameConfig'
import type { AttrExp } from '../types'

export interface EvoCost {
  exp: number
  gold: number
}

/** stage（1始まり）から次の段階へ進化するコスト。最終段階なら null */
export function evolutionCost(stage: number): EvoCost | null {
  return CONFIG.evolutionCosts[stage - 1] ?? null
}

/** 購入EXPで埋められる上限 */
export function boughtCap(cost: EvoCost): number {
  return Math.floor(cost.exp * CONFIG.shop.boughtExpMaxRatio)
}

/**
 * 財布から今注げるEXPの内訳を決める。
 * 購入EXPは上限まで先に使い、残りを筋トレEXPで埋める。
 */
export function planPour(cost: EvoCost, invested: AttrExp, wallet: AttrExp): AttrExp {
  const need = Math.max(0, cost.exp - invested.trained - invested.bought)
  const bought = Math.max(0, Math.min(wallet.bought, boughtCap(cost) - invested.bought, need))
  const trained = Math.max(0, Math.min(wallet.trained, need - bought))
  return { trained, bought }
}

export function isExpFull(cost: EvoCost, invested: AttrExp): boolean {
  return invested.trained + invested.bought >= cost.exp
}
