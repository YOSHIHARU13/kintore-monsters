import { CONFIG } from '../config/gameConfig'
import { SLOTS } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { ELEMENTS, advantageElements, elementInfo } from './element'
import { abilityTag, elementTag } from './formation'
import { standardSessionDamage } from './quest'
import {
  isHidden,
  nodeAttr,
  type GameState,
  type MonsterDef,
  type Quest,
  type QuestGrade,
  type Requirement,
} from '../types'

/** 試練の塔：月ごとに10階ぶんを自動で作る。下から1階ずつ、各階の報酬は1回だけ */
export interface TowerFloor {
  floor: number // 1〜
  quest: Quest
  reward: TowerReward
}

export interface TowerReward {
  gold: number
  eggs: number
  cores: number // ボスの部位の核
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
export function towerFloors(month: string, defs: MonsterDef[], gimmicks: string[]): TowerFloor[] {
  const t = CONFIG.tower
  const r = seeded(`tower:${month}`)
  const looks = defs.filter((d) => !isHidden(d) && d.images[FIRST_NODE_ID])
  const prizes = towerMonsters(defs)
  // 月が変わるごとに、塔限定モンスターを順番に出す
  const [y, m] = month.split('-').map(Number)
  const turn = (y * 12 + m) * t.monsterFloors.length
  const weakChoices = SLOTS.filter((s) => s.day !== 'bonus').map((s) => s.id)

  return Array.from({ length: t.floors }, (_, i) => {
    const floor = i + 1
    const element = pick([...ELEMENTS], r)
    const sameElement = looks.filter((d) => elementInfo(d).elements.includes(element))
    const boss =
      (sameElement.length > 0 ? sameElement : looks).length > 0
        ? pick(sameElement.length > 0 ? sameElement : looks, r)
        : undefined
    const attr = boss ? nodeAttr(boss, FIRST_NODE_ID) : pick(['chestArms', 'legs', 'backShoulders'] as const, r)
    const attrKey = attr === 'none' ? pick(['chestArms', 'legs', 'backShoulders'] as const, r) : attr
    const weak = [...weakChoices].sort(() => r() - 0.5).slice(0, floor >= t.twoWeakFrom ? 2 : 1)
    const requirements: Requirement[] = []
    if (floor >= t.elementReqFrom) {
      requirements.push({
        tag: elementTag(advantageElements(element)[0]),
        count: Math.min(4, 2 + Math.floor((floor - t.elementReqFrom) / 3)),
      })
    }
    if (floor >= t.abilityReqFrom && gimmicks.length > 0) {
      requirements.push({
        tag: abilityTag(pick(gimmicks, r)),
        count: floor >= 9 ? 3 : 2,
      })
    }
    const grade: QuestGrade = floor >= t.chozetsuFrom ? 'chozetsu' : floor >= t.kyukyokuFrom ? 'kyukyoku' : 'kiwami'
    const hp = Math.max(100, Math.round((standardSessionDamage() * t.hpRatio[i]) / 100) * 100)
    const mi = t.monsterFloors.indexOf(floor)
    const prize = mi >= 0 && prizes.length > 0 ? prizes[(turn + mi) % prizes.length] : undefined
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
      monsterDefId: prize?.id ?? null,
    }
    return { floor, quest, reward }
  })
}
