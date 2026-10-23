import { CONFIG } from '../config/gameConfig'
import { ATTRS } from '../data/exercises'
import type { Reward } from './missions'
import type { GameState } from '../types'

/** ランク用のEXP：これまで筋トレで稼いだEXPの合計（買ったEXPは入らない） */
export function rankExpOf(state: Pick<GameState, 'lifetimeExp' | 'lifetimeAnyExp'>): number {
  return ATTRS.reduce((sum, a) => sum + (state.lifetimeExp[a] ?? 0), 0) + (state.lifetimeAnyExp ?? 0)
}

/** ランク r から r+1 に必要なEXP */
export function rankNeed(rank: number): number {
  return CONFIG.rank.base + CONFIG.rank.step * (rank - 1)
}

/** 今のランクと、次のランクまでの進み具合 */
export function playerRankOf(exp: number): { rank: number; into: number; need: number } {
  let rank = 1
  let left = exp
  while (left >= rankNeed(rank)) {
    left -= rankNeed(rank)
    rank++
  }
  return { rank, into: left, need: rankNeed(rank) }
}

export const rankClaimKey = (rank: number) => `rank:${rank}`

/** そのランクに上がったときの報酬（10ランクごとに追加） */
export function rankReward(rank: number): Reward {
  const r = CONFIG.rank
  const eggs = (r.reward.eggs ?? 0) + (rank % r.milestoneEvery === 0 ? (r.milestone.eggs ?? 0) : 0)
  return { ...r.reward, eggs }
}

/** まだ受け取っていないランクアップ報酬（ランク2から） */
export function pendingRanks(state: Pick<GameState, 'lifetimeExp' | 'lifetimeAnyExp' | 'claims'>): number[] {
  const { rank } = playerRankOf(rankExpOf(state))
  const out: number[] = []
  for (let r = 2; r <= rank; r++) if (!state.claims?.[rankClaimKey(r)]) out.push(r)
  return out
}
