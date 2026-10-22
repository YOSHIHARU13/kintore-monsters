import { CONFIG } from '../config/gameConfig'
import type { FormAttr } from '../data/exercises'
import type { QuestDifficulty } from '../types'

/** 進化素材「核」の種類。属性ごとに1種類（無属性は無垢の核） */
export type CoreKey = FormAttr

export const CORE_KEYS: CoreKey[] = ['chestArms', 'legs', 'backShoulders', 'none']

export const CORE_LABEL: Record<CoreKey, string> = {
  chestArms: '剛腕の核',
  legs: '健脚の核',
  backShoulders: '背筋の核',
  none: '無垢の核',
}

export interface Drop {
  count: number // 落ちた核の数（0なら落ちなかった）
  pity: boolean // 天井で確定したか
}

/**
 * 素材クエストの核のドロップ。misses は、そのクエストで続けて落ちなかった回数。
 * 天井の回数ぶん続けて落ちなかったら、次は必ず落ちる。上級はたまに2個。
 */
export function rollCoreDrop(difficulty: QuestDifficulty, misses: number, random: () => number): Drop {
  const d = CONFIG.cores.drop[difficulty]
  const pity = misses >= CONFIG.cores.pityMisses
  if (!pity && random() >= d.rate) return { count: 0, pity: false }
  return { count: random() < d.double ? 2 : 1, pity }
}

/** ボスクエストのおまけの核 */
export function rollBonusCore(random: () => number): number {
  return random() < CONFIG.cores.bossBonusRate ? 1 : 0
}
