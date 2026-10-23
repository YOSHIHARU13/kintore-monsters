import { CONFIG } from '../config/gameConfig'
import { elementInfo } from './element'
import { bossGradeOf, rarityOf } from './gacha'
import { isHidden, type GameState, type MonsterDef, type OwnedMonster } from '../types'

/**
 * ＋の素材にできるか：同じ属性を持つ、別のモンスター（無属性どうしもOK）。
 * 同じモンスターは運のほうに食べさせる。ハズレも＋の素材になるので、激レアでも＋5を目指せる。
 */
export function canFeed(base: MonsterDef, food: MonsterDef): boolean {
  if (base.id === food.id) return false
  const a = elementInfo(base).elements
  const b = elementInfo(food).elements
  if (a.length === 0 || b.length === 0) return a.length === 0 && b.length === 0
  return a.some((e) => b.includes(e))
}

/** 食べさせたときに上がる＋（食べさせた側の＋も引き継ぐ） */
export function fusionGain(_base: MonsterDef, _food: MonsterDef, foodMon: OwnedMonster): number {
  return CONFIG.fusion.gain.sameElement + (foodMon.plus ?? 0)
}

/** 運（なければ1） */
export function luckOf(mon: Pick<OwnedMonster, 'luck'>): number {
  return mon.luck ?? 1
}

export function isLuckMax(mon: Pick<OwnedMonster, 'luck'>): boolean {
  return luckOf(mon) >= CONFIG.luck.max
}

/** 運に食べさせたあとの運：食べさせた側の運をそのまま足す（最大99） */
export function luckAfter(base: Pick<OwnedMonster, 'luck'>, food: Pick<OwnedMonster, 'luck'>): number {
  return Math.min(CONFIG.luck.max, luckOf(base) + luckOf(food))
}

/** 運極ボーナス：出撃メンバーの運極の数で、報酬オーブの倍率と、宝箱の追加の数 */
export function luckBonus(party: Pick<OwnedMonster, 'luck'>[]): { count: number; goldRate: number; extraBoxes: number } {
  const count = party.filter(isLuckMax).length
  return { count, goldRate: 1 + CONFIG.luck.goldBonus * count, extraBoxes: CONFIG.boxes.perLuckMax * count }
}

/** クエストで落ちたボスの運：基本の運＋出撃した運極の数（上限あり） */
export function dropLuck(party: Pick<OwnedMonster, 'luck'>[]): number {
  const l = CONFIG.luck
  return l.questDrop + Math.min(l.perLuckMaxCap, party.filter(isLuckMax).length * l.perLuckMax)
}

/** 運極ができたときのトク玉：降臨（クエストの子）は多め、ガチャの子は少なめ */
export function luckMaxReward(def: Pick<MonsterDef, 'questOnly'>): number {
  return def.questOnly ? CONFIG.luck.maxReward.quest : CONFIG.luck.maxReward.gacha
}

/** 運極の報酬は、1種類につき1回だけ（同じモンスターの運極は1種類として数える） */
export const luckMaxClaimKey = (defId: string) => `luckMaxDef:${defId}`

export interface FeedPlan {
  keeperId: string // 運を集める1体
  foodIds: string[] // 食べさせる（いなくなる）個体
  luck: number // 食べさせたあとの運
}

/**
 * ダブりをまとめて合成：ノーマル以下のモンスターごとに、いちばん育っている1体に同じモンスターを食べさせる。
 * 相棒・出撃中など keep に入っている個体は食べさせない（あれば、その子に集める）。運が最大になったら止める。
 */
export function bulkFeedTarget(def: MonsterDef): boolean {
  // 激レアと、超絶以上の降臨は残す（獣神化の素材にするため）
  const grade = bossGradeOf(def)
  return !isHidden(def) && rarityOf(def) !== 'superRare' && !(grade === 'chozetsu' || grade === 'chokyukyoku' || grade === 'bakuzetsu')
}

/** 守る個体：相棒と、今日出撃しているメンバーと、ロックした子（まとめて合成・素材に使わない） */
export function protectedIds(
  state: Pick<GameState, 'partners' | 'challenge'>,
  today: string,
  owned: Pick<OwnedMonster, 'id' | 'locked'>[] = [],
): Set<string> {
  return new Set([...Object.values(state.partners), ...(state.challenge?.date === today ? state.challenge.party : []), ...owned.filter((o) => o.locked).map((o) => o.id)])
}

export function planBulkFeed(
  owned: OwnedMonster[],
  defs: MonsterDef[],
  keep: Set<string>,
  starsOf: (def: MonsterDef, nodeId: string) => number,
  isTarget: (def: MonsterDef) => boolean,
): FeedPlan[] {
  const plans: FeedPlan[] = []
  for (const def of defs.filter(isTarget)) {
    const mons = owned.filter((o) => o.defId === def.id)
    if (mons.length < 2) continue
    const ranked = [...mons].sort(
      (a, b) =>
        Number(keep.has(b.id)) - Number(keep.has(a.id)) ||
        starsOf(def, b.nodeId) - starsOf(def, a.nodeId) ||
        luckOf(b) - luckOf(a) ||
        a.obtainedAt - b.obtainedAt,
    )
    const keeper = ranked[0]
    let luck = luckOf(keeper)
    const foodIds: string[] = []
    // 育っていない子から食べさせる
    for (const m of ranked.slice(1).reverse()) {
      if (luck >= CONFIG.luck.max) break
      if (keep.has(m.id)) continue
      luck = luckAfter({ luck }, m)
      foodIds.push(m.id)
    }
    if (foodIds.length > 0) plans.push({ keeperId: keeper.id, foodIds, luck })
  }
  return plans
}
