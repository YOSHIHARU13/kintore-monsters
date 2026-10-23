import { CONFIG } from '../config/gameConfig'
import { getNode, type EvoNode, type EvoTemplate } from '../data/evolutionTemplates'
import { CORE_KEYS, ballsOf, coresOf, stonesOf, type CoreKey } from './cores'
import { ELEMENTS, elementInfo } from './element'
import { nodeAttr, type AttrExp, type Element, type GameState, type MonsterDef } from '../types'

export interface EvoCost {
  exp: number
  coins: number // 進化コイン
  stones?: number // そのモンスターの属性の結晶
  muscle?: number // 進化先の部位の核
  balls?: number // 筋肉玉
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
  const total: Required<EvoCost> = { exp: 0, coins: 0, stones: 0, muscle: 0, balls: 0 }
  for (let stage = node.stage; stage < toStage; stage++) {
    const c = evolutionCost(stage)
    if (!c) return null
    total.exp += c.exp
    total.coins += c.coins
    total.stones += c.stones ?? 0
    total.muscle += c.muscle ?? 0
    total.balls += c.balls ?? 0
  }
  return total
}

/**
 * 進化に使う素材の種類：結晶はそのモンスターの属性、核は進化先の部位。
 * 無属性や2属性（ジョグレス）・無部位のときは、候補の中でいちばん多く持っているものを使う
 */
export function materialKeys(
  def: MonsterDef,
  toNodeId: string,
  state: Pick<GameState, 'stones' | 'cores'>,
): { stone: Element; muscle: CoreKey } {
  const els = elementInfo(def).elements
  const stoneCands = els.length > 0 ? els : ELEMENTS
  const stone = [...stoneCands].sort((a, b) => stonesOf(state, b) - stonesOf(state, a))[0]
  const attr = nodeAttr(def, toNodeId)
  const muscle = attr !== 'none' ? attr : [...CORE_KEYS].sort((a, b) => coresOf(state, b) - coresOf(state, a))[0]
  return { stone, muscle }
}

/** 進化の素材が足りているか（足りないものの一覧。空ならOK） */
export function missingMaterials(
  cost: EvoCost,
  def: MonsterDef,
  toNodeId: string,
  state: Pick<GameState, 'stones' | 'cores' | 'coins'>,
): string[] {
  const keys = materialKeys(def, toNodeId, state)
  const out: string[] = []
  if ((state.coins ?? 0) < cost.coins) out.push('coins')
  if (stonesOf(state, keys.stone) < (cost.stones ?? 0)) out.push('stones')
  if (coresOf(state, keys.muscle) < (cost.muscle ?? 0)) out.push('muscle')
  if (ballsOf(state) < (cost.balls ?? 0)) out.push('balls')
  return out
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

/** ジョグレスに使う結晶：素材2体それぞれの属性（同じ属性なら、その結晶を2体ぶん。無属性の子のぶんはなし） */
export function jogressStones(a: MonsterDef, b: MonsterDef): Element[] {
  return [a, b].flatMap((d) => elementInfo(d).elements.slice(0, 1))
}
