import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { ELEMENTS, elementInfo } from './element'
import { gradeOf, standardSessionDamage } from './quest'
import { autoQuestSetup } from './questAuto'
import { rarityOf } from './gacha'
import {
  isHidden,
  nodeAttr,
  type GameState,
  type MonsterDef,
  type Quest,
  type QuestGrade,
  type Requirement,
  type BoosterKey,
} from '../types'

/** 試練の塔：毎月11階。下から1階ずつ、各階の報酬は月に1回だけ */
export interface TowerFloor {
  floor: number // 1〜
  quest: Quest
  reward: TowerReward
}

export interface TowerReward {
  gold: number
  eggs: number
  cores: number // ボスの部位の核
  sticks?: number // ワクワクステッキ
  booster: BoosterKey | null // ブースター
  monsterDefId: string | null // 塔限定モンスター
}

export const TOWER_PREFIX = 'tower-'
export const isTowerQuest = (id: string) => id.startsWith(TOWER_PREFIX)
export const towerMonth = (date: string) => date.slice(0, 7)

/** 今月クリアした階の数 */
export function towerCleared(state: Pick<GameState, 'tower'>, month: string): number {
  return state.tower?.month === month ? state.tower.cleared : 0
}

/** 文字列から決まる乱数（同じ月なら誰が見ても同じ塔になる） */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const pick = <T>(list: T[], r: () => number): T => list[Math.floor(r() * list.length)]

/** 塔限定モンスター（降臨のうち「試練の塔の報酬」にしたもの） */
export function towerMonsters(defs: MonsterDef[]): MonsterDef[] {
  return defs.filter((d) => d.questOnly && d.tower).sort((a, b) => a.id.localeCompare(b.id))
}

/** その月の塔。ボスの見た目は登録済みのモンスターから、属性に合うものを選ぶ */
/**
 * 1〜10階のボス：通常の超絶クエストのボス（降臨。コラボと超究極は入れない）を、炎・水・木・光・闇の順に2周。同じ属性の中は図鑑の番号順。
 * 足りない属性は、残りの超絶ボス → ほかの降臨 → ハズレ・ノーマルの順で埋める。毎月同じ並び（登録が変われば変わる）
 */
export function towerLineup(defs: MonsterDef[], quests: Pick<Quest, 'kind' | 'grade' | 'rank' | 'bossDefId' | 'builtin'>[]): (MonsterDef | undefined)[] {
  const t = CONFIG.tower
  const dex = (d: MonsterDef) => defs.indexOf(d)
  const ids = new Set(
    quests
      .filter((q) => q.kind !== 'material' && !q.builtin && gradeOf(q) === 'chozetsu')
      .map((q) => q.bossDefId),
  )
  // 超究極のボス（因縁の強敵など）も、埋め合わせに使わない
  const strongIds = new Set(quests.filter((q) => q.kind !== 'material' && gradeOf(q) === 'chokyukyoku').map((q) => q.bossDefId))
  // コラボの子は入れない（通常の超絶だけ）
  const top = defs.filter((d) => ids.has(d.id) && !d.tower && !d.series?.trim()).sort((a, b) => dex(a) - dex(b))
  const slots = t.elementOrder.length * 2
  const lineup: (MonsterDef | undefined)[] = Array.from({ length: slots }, (_, i) => {
    const e = t.elementOrder[i % t.elementOrder.length]
    const round = Math.floor(i / t.elementOrder.length)
    return top.filter((d) => elementInfo(d).elements[0] === e)[round]
  })
  const used = new Set(lineup.filter((d) => d).map((d) => d!.id))
  const spare = [
    ...top,
    ...defs.filter((d) => d.questOnly && !d.tower && !isHidden(d) && !d.series?.trim() && !strongIds.has(d.id)),
    ...defs.filter((d) => !d.questOnly && !isHidden(d) && rarityOf(d) !== 'superRare'),
  ].filter((d) => !used.has(d.id))
  return lineup.map((d) => {
    if (d) return d
    const next = spare.find((x) => !used.has(x.id))
    if (next) used.add(next.id)
    return next
  })
}

export function towerFloors(
  month: string,
  defs: MonsterDef[],
  gimmicks: string[],
  quests: Quest[] = [],
  fixed: FixedFloor[] | null = null, // 保存した塔（1〜10階）。あれば毎月これを使う
): TowerFloor[] {
  const t = CONFIG.tower
  const r = seeded(`tower:${month}`)
  const lineup = fixed && fixed.length > 0 ? fixed.map((f) => defs.find((d) => d.id === f.bossDefId)) : towerLineup(defs, quests)
  const prizes = towerMonsters(defs)
  // 月が変わるごとに、塔限定モンスターを順番に出す
  const [y, m] = month.split('-').map(Number)
  const turn = (y * 12 + m) * t.monsterFloors.length

  return Array.from({ length: t.floors }, (_, i) => {
    const floor = i + 1
    const mi = t.monsterFloors.indexOf(floor)
    const prize = mi >= 0 && prizes.length > 0 ? prizes[(turn + mi) % prizes.length] : undefined
    // 塔限定モンスターの階は、その子がボス。ほかは並び順のボス
    const boss = prize ?? lineup[i % lineup.length]
    const element = (boss && elementInfo(boss).elements[0]) || pick([...ELEMENTS], r)
    const attr = boss ? nodeAttr(boss, FIRST_NODE_ID) : pick(['chestArms', 'legs', 'backShoulders'] as const, r)
    const attrKey = attr === 'none' ? pick(['chestArms', 'legs', 'backShoulders'] as const, r) : attr
    const grade: QuestGrade = floor >= t.chozetsuFrom ? 'chozetsu' : floor >= t.kyukyokuFrom ? 'kyukyoku' : 'kiwami'
    // 条件と弱点：保存した塔があればそれ（毎月同じ）。なければおまかせで作る。
    // ほかのクエストで使っているスキルをなるべく避けるので、そのボスの超絶クエストとは別のギミックになる
    const saved = mi < 0 ? fixed?.[i] : undefined
    const setup = saved
      ? { requirements: saved.requirements, weakSlots: saved.weakSlots }
      : boss
        ? autoQuestSetup(boss, grade, 'boss', quests, gimmicks, `tower-${floor}`, defs, false)
        : { requirements: [], weakSlots: [] }
    const requirements: Requirement[] = saved || floor >= t.elementReqFrom ? setup.requirements : []
    const weak = saved ? setup.weakSlots : setup.weakSlots.slice(0, floor >= t.twoWeakFrom ? 2 : 1)
    const hp = Math.max(100, Math.round((standardSessionDamage() * t.hpRatio[i]) / 100) * 100)
    const quest: Quest = {
      id: `${TOWER_PREFIX}${month}-${floor}`,
      name: `試練の塔 ${floor}階`,
      kind: 'boss',
      bossDefId: boss?.id ?? '',
      attr: attrKey,
      element,
      weakSlots: weak,
      requirements,
      hp: { easy: hp, normal: hp, hard: hp },
      grade,
      catchphrase: floor === t.floors ? '塔の頂上' : '',
      theme: 'royal',
      createdAt: 0,
    }
    const reward: TowerReward = {
      gold: t.gold[i],
      eggs: (t.eggs[floor] ?? 0) + (mi >= 0 && !prize ? t.eggsInsteadOfMonster : 0),
      cores: t.cores[floor] ?? 0,
      booster: t.boosters[floor] ?? null,
      sticks: t.sticks[floor] ?? 0,
      monsterDefId: prize?.id ?? null,
    }
    return { floor, quest, reward }
  })
}

/** 保存した塔の作り方の版。作り方を変えたら上げる（古い保存は使わず、作り直して保存し直す） */
export const TOWER_VERSION = 2

/** 保存する塔の1階ぶん（毎月同じにするため） */
export interface FixedFloor {
  bossDefId: string
  requirements: Requirement[]
  weakSlots: string[]
}

/** 今の塔を保存用に（1〜10階。11階の塔限定モンスターは月替わり） */
export function snapshotTower(floors: TowerFloor[]): FixedFloor[] {
  return floors
    .filter((f) => !CONFIG.tower.monsterFloors.includes(f.floor))
    .map((f) => ({ bossDefId: f.quest.bossDefId, requirements: f.quest.requirements ?? [], weakSlots: f.quest.weakSlots }))
}
