import { CONFIG } from '../config/gameConfig'
import { getNode, type EvoNode, type EvoTemplate } from '../data/evolutionTemplates'
import type { AttrExp } from '../types'

export interface EvoCost {
  exp: number
  gold: number
  cores?: number // 進化先の属性の核
}

/** stage（1始まり）から次の段階へ進化するコスト。最終段階なら null */
export function evolutionCost(stage: number): EvoCost | null {
  return CONFIG.evolutionCosts[stage - 1] ?? null
}

/**
 * その形態から次の形態へ進化するコスト。ワープ進化（★1→★3）のように段階を飛ばすときは、
 * 飛ばした段階の分も足す（1→2 と 2→3 の合計）。最終形態なら null
 */
export function nextCost(template: EvoTemplate, node: EvoNode): EvoCost | null {
  if (node.next.length === 0) return null
  const toStage = getNode(template, node.next[0]).stage
  const total: EvoCost = { exp: 0, gold: 0, cores: 0 }
  for (let stage = node.stage; stage < toStage; stage++) {
    const c = evolutionCost(stage)
    if (!c) return null
    total.exp += c.exp
    total.gold += c.gold
    total.cores = (total.cores ?? 0) + (c.cores ?? 0)
  }
  return total
}

/** ＋plus から＋1するのに必要なEXPとゴールド。最大なら null */
export function fusionCost(plus: number): EvoCost | null {
  return plus < CONFIG.fusion.maxPlus ? (CONFIG.fusion.costs[plus] ?? null) : null
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
