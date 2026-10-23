import { CONFIG } from '../config/gameConfig'
import { elementInfo } from './element'
import { gradeOf, standardSessionDamage } from './quest'
import { autoQuestSetup, ownAbilities } from './questAuto'
import { PATTERN_PARTS, patternBoss, patternOf, patternPick, weakSlotsFor, patternTag } from './pattern'
import { partTag } from './formation'
import { bossGradeOf, rarityOf } from './gacha'
import {
  isHidden,
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
  tower?: number // 何番目の塔か（0から。超絶10体ごとに1つ）
  quest: Quest
  reward: TowerReward
}

export interface TowerReward {
  gold: number
  eggs: number
  cores: number // ボスの部位の核
  sticks?: number // ワクワクステッキ
  balls?: number // 筋肉玉（禁筋の獄）
  booster: BoosterKey | null // ブースター
  boosters?: BoosterKey[] // ブースター詰め合わせ（孤城）
  custom?: string // カスタマイズアイテム（孤城）
  monsterDefId: string | null // 塔限定モンスター（孤城では城主）
}

export const TOWER_PREFIX = 'tower-'
export const isTowerQuest = (id: string) => id.startsWith(TOWER_PREFIX)
export const towerMonth = (date: string) => date.slice(0, 7)

/** 開催中か（月の何日から何日まで） */
export function isOpenOn(today: string, days: [number, number]): boolean {
  const d = Number(today.slice(8, 10))
  return d >= days[0] && d <= days[1]
}

/** 試練の塔は毎月1〜15日 */
export const towerOpen = (today: string) => isOpenOn(today, CONFIG.tower.openDays)

/** 今月クリアした階の数（index は何番目の塔か） */
export function towerCleared(state: Pick<GameState, 'tower' | 'towerMore'>, month: string, index = 0): number {
  if (index === 0) return state.tower?.month === month ? state.tower.cleared : 0
  return state.towerMore?.month === month ? (state.towerMore.cleared[String(index)] ?? 0) : 0
}

/** 塔のボスになる超絶の降臨（コラボ・塔限定・城主は入れない）。登録した順に、10体ごとに1つの塔になる */
export function towerBosses(defs: MonsterDef[], quests: Pick<Quest, 'kind' | 'grade' | 'rank' | 'bossDefId' | 'builtin'>[]): MonsterDef[] {
  const ids = new Set(
    quests.filter((q) => q.kind !== 'material' && !q.builtin && gradeOf(q) === 'chozetsu').map((q) => q.bossDefId),
  )
  // 登録した順（新しく10体そろうと、その10体の塔ができる）
  return defs
    .filter(
      (d) =>
        (ids.has(d.id) || bossGradeOf(d) === 'chozetsu') &&
        d.questOnly &&
        !d.tower &&
        !d.castleOnly &&
        !d.castleLord &&
        !d.kinkinLord &&
        !d.series?.trim(),
    )
    .sort((a, b) => a.createdAt - b.createdAt)
}

/** 塔の数：超絶10体ごとに1つ（足りなくても1つはある） */
export function towerCount(defs: MonsterDef[], quests: Pick<Quest, 'kind' | 'grade' | 'rank' | 'bossDefId' | 'builtin'>[]): number {
  return Math.max(1, Math.floor(towerBosses(defs, quests).length / 10))
}


/** 塔限定モンスター（降臨のうち「試練の塔の報酬」にしたもの） */
export function towerMonsters(defs: MonsterDef[]): MonsterDef[] {
  return defs.filter((d) => d.questOnly && d.tower).sort((a, b) => a.id.localeCompare(b.id))
}

/** その月の塔。ボスの見た目は登録済みのモンスターから、属性に合うものを選ぶ */
/**
 * 1〜10階のボス：通常の超絶クエストのボス（降臨。コラボと超究極は入れない）を、炎・水・木・光・闇の順に2周。同じ属性の中は図鑑の番号順。
 * 足りない属性は、残りの超絶ボス → ほかの降臨 → ハズレ・ノーマルの順で埋める。毎月同じ並び（登録が変われば変わる）
 */
export function towerLineup(
  defs: MonsterDef[],
  quests: Pick<Quest, 'kind' | 'grade' | 'rank' | 'bossDefId' | 'builtin'>[],
  index = 0,
): (MonsterDef | undefined)[] {
  const t = CONFIG.tower
  // 2つ目からの塔は、超絶10体をそのまま属性の順に
  if (index > 0) {
    const chunk = towerBosses(defs, quests).slice(index * 10, index * 10 + 10)
    const rank = (d: MonsterDef) => {
      const e = elementInfo(d).elements[0]
      return e ? t.elementOrder.indexOf(e as (typeof t.elementOrder)[number]) : 5
    }
    return [...chunk].sort((a, b) => rank(a) - rank(b))
  }
  const dex = (d: MonsterDef) => defs.indexOf(d)
  // 超究極のボス（因縁の強敵など）も、埋め合わせに使わない
  const strongIds = new Set(quests.filter((q) => q.kind !== 'material' && gradeOf(q) === 'chokyukyoku').map((q) => q.bossDefId))
  // コラボの子は入れない（通常の超絶だけ）
  // 1つ目の塔は、最初の超絶10体（足りなければ、ほかの子で埋める）
  const top = towerBosses(defs, quests).slice(0, 10).sort((a, b) => dex(a) - dex(b))
  const slots = t.elementOrder.length * 2
  const lineup: (MonsterDef | undefined)[] = Array.from({ length: slots }, (_, i) => {
    const e = t.elementOrder[i % t.elementOrder.length]
    const round = Math.floor(i / t.elementOrder.length)
    return top.filter((d) => elementInfo(d).elements[0] === e)[round]
  })
  const used = new Set(lineup.filter((d) => d).map((d) => d!.id))
  const spare = [
    ...top,
    ...defs.filter((d) => d.questOnly && !d.tower && !d.castleOnly && !d.castleLord && !isHidden(d) && !d.series?.trim() && !strongIds.has(d.id)),
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
  index = 0, // 何番目の塔か
): TowerFloor[] {
  const t = CONFIG.tower
  // 月ごとのパターン（胸腕・脚・背肩の月）：どのボスもその月の部位のボスとして戦い、条件も変わる。11階のボスも入れ替わる
  const pattern = patternOf(month)
  const part = PATTERN_PARTS[pattern]
  const lineup = towerLineup(defs, quests, index)
  const prizes = towerMonsters(defs)

  // 前の階の条件も数えて、階ごとにちがう子が主役になるように
  const sofar: Pick<Quest, 'id' | 'requirements' | 'gimmicks'>[] = [...quests]
  return Array.from({ length: t.floors }, (_, i) => {
    const floor = i + 1
    const mi = t.monsterFloors.indexOf(floor)
    // 11階のボス：塔限定の子をパターンごとに入れ替える（塔ごとにずらす）
    const prize = mi >= 0 ? patternPick(prizes, pattern + index) : undefined
    // 塔限定モンスターの階は、その子がボス。ほかは並び順のボスを、月のパターンごとにずらす（同じ階でもボスごと入れ替わる）
    const boss = prize ?? lineup[(i + t.patternShift * pattern) % lineup.length]
    const grade: QuestGrade = floor >= t.chozetsuFrom ? 'chozetsu' : floor >= t.kyukyokuFrom ? 'kyukyoku' : 'kiwami'
    // 条件：ほかのクエストで使っているスキルをなるべく避ける（そのボスの超絶クエストとは別のギミックに）。パターンごとに変わる
    const setup = boss
      ? autoQuestSetup(patternBoss(boss, pattern), grade, 'boss', sofar, gimmicks, `tower-${index}-${floor}`, defs, false, 'normal', ownAbilities(quests, boss.id))
      : { requirements: [], weakSlots: [] }
    // 持ち物検査：属性・アビリティに加えて、上の階では「その月の部位の子」（部位限定ガチャの子が活躍する）
    const partReq: Requirement[] = floor >= t.partReqFrom ? [{ tag: partTag(part), count: floor >= t.chozetsuFrom ? 3 : 2 }] : []
    const requirements: Requirement[] = floor >= t.elementReqFrom ? [...setup.requirements, ...partReq] : []
    const hp = Math.max(100, Math.round((standardSessionDamage() * t.hpRatio[i]) / 100) * 100)
    const quest: Quest = {
      id: index === 0 ? `${TOWER_PREFIX}${month}-${floor}` : `${TOWER_PREFIX}${month}-t${index + 1}-${floor}`,
      name: index === 0 ? `試練の塔${patternTag(month)} ${floor}階` : `第${index + 1}の塔${patternTag(month)} ${floor}階`,
      kind: 'boss',
      bossDefId: boss?.id ?? '',
      attr: part,
      element: boss ? elementInfo(boss).elements[0] : undefined,
      weakSlots: weakSlotsFor(part, `tower:${index}:${floor}:${pattern}`, floor >= t.twoWeakFrom ? 2 : 1),
      requirements,
      hp: { easy: hp, normal: hp, hard: hp },
      grade,
      catchphrase: floor === t.floors ? '塔の頂上' : '',
      theme: 'royal',
      createdAt: 0,
    }
    sofar.push(quest)
    const reward: TowerReward = {
      gold: t.gold[i],
      eggs: (t.eggs[floor] ?? 0) + (mi >= 0 && !prize ? t.eggsInsteadOfMonster : 0),
      cores: t.cores[floor] ?? 0,
      booster: t.boosters[floor] ?? null,
      sticks: t.sticks[floor] ?? 0,
      monsterDefId: prize?.id ?? null,
    }
    return { floor, tower: index, quest, reward }
  })
}

/** 今月の塔をぜんぶ（超絶10体ごとに1つ） */
export function allTowers(month: string, defs: MonsterDef[], gimmicks: string[], quests: Quest[] = []): TowerFloor[][] {
  return Array.from({ length: towerCount(defs, quests) }, (_, i) => towerFloors(month, defs, gimmicks, quests, i))
}

/** 保存した塔の作り方の版。作り方を変えたら上げる（古い保存は使わず、作り直して保存し直す） */
export const TOWER_VERSION = 4

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
