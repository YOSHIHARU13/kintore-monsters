import { CONFIG } from '../config/gameConfig'
import { ATTRS, type Attr, type FormAttr } from '../data/exercises'
import { ELEMENT_LABEL } from './element'
import type { Element, GameState, MaterialDrop, Quest, QuestDifficulty } from '../types'

/** 部位の核（筋肉素材）。胸腕・脚・背肩の3種類 */
export type CoreKey = Attr

export const CORE_KEYS: CoreKey[] = [...ATTRS]

export const CORE_LABEL: Record<CoreKey, string> = {
  chestArms: '剛腕の核',
  legs: '健脚の核',
  backShoulders: '背筋の核',
}

/** 筋肉玉は、以前の「無垢の核」の入れ物（cores.none）にそのまま入れる（変えないこと） */
export const BALL_KEY: FormAttr = 'none'
export const BALL_LABEL = '筋肉玉'

export const STONE_LABEL = (e: Element) => `${ELEMENT_LABEL[e]}の結晶`

export const stonesOf = (state: Pick<GameState, 'stones'>, e: Element) => state.stones?.[e] ?? 0
export const coresOf = (state: Pick<GameState, 'cores'>, k: CoreKey) => state.cores[k] ?? 0
export const ballsOf = (state: Pick<GameState, 'cores'>) => state.cores[BALL_KEY] ?? 0

/** 素材クエストで落ちるもの（drop がない自作の素材クエストは、ボスの部位の核。部位がなければ筋肉玉） */
export function dropOf(quest: Pick<Quest, 'drop' | 'attr'>): MaterialDrop {
  return quest.drop ?? (quest.attr === 'none' ? 'ball' : 'muscle')
}

/** 素材の名前（例：炎の結晶・剛腕の核・筋肉玉・進化コイン） */
export function dropLabel(quest: Pick<Quest, 'drop' | 'attr' | 'element'>): string {
  const kind = dropOf(quest)
  if (kind === 'coins') return '進化コイン'
  if (kind === 'ball') return BALL_LABEL
  if (kind === 'stone') return quest.element ? STONE_LABEL(quest.element) : '結晶'
  return quest.attr === 'none' ? BALL_LABEL : CORE_LABEL[quest.attr]
}

export const DROP_ICON: Record<MaterialDrop, string> = { stone: '💠', muscle: '💎', ball: '🟣', coins: '🪙' }

export interface Drop {
  count: number // 落ちた数（0なら落ちなかった）
  pity: boolean // 天井で確定したか
}

/** くじを rolls 回引き、当たり1回で amount 個 */
export function rollLots(
  lots: { rolls: number; rate: number; amount: number },
  extraRolls: number,
  random: () => number,
): number {
  let hits = 0
  for (let i = 0; i < lots.rolls + extraRolls; i++) if (random() < lots.rate) hits++
  return hits * lots.amount
}

/**
 * 素材クエストのドロップ。運極が1体いるごとに、くじが増える。
 * 筋肉玉だけは、続けて落ちないと（misses が天井の回数に届くと）次は必ず1個。
 */
export function rollMaterialDrop(
  kind: MaterialDrop,
  difficulty: QuestDifficulty,
  luckCount: number,
  misses: number,
  random: () => number,
): Drop {
  const m = CONFIG.materials
  const count = rollLots(m.drops[kind][difficulty], luckCount * m.luckRolls, random)
  if (kind === 'ball' && count === 0 && misses + 1 >= m.ballPityMisses) return { count: 1, pity: true }
  return { count, pity: false }
}

/** くじの期待値（画面の目安） */
export function expectedDrop(kind: MaterialDrop, difficulty: QuestDifficulty, luckCount: number): number {
  const d = CONFIG.materials.drops[kind][difficulty]
  return (d.rolls + luckCount * CONFIG.materials.luckRolls) * d.rate * d.amount
}

/** ボスクエストのおまけ：ボスの属性の結晶 */
export function rollBonusStones(random: () => number): number {
  return rollLots(CONFIG.materials.bossBonus, 0, random)
}
