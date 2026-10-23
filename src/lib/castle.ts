import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { elementInfo } from './element'
import { gradeOf, standardSessionDamage } from './quest'
import { autoQuestSetup } from './questAuto'
import { bossGradeOf, rarityOf } from './gacha'
import { isOpenOn, type TowerFloor } from './tower'
import { isHidden, nodeAttr, type GameState, type MonsterDef, type Quest } from '../types'

export const CASTLE_PREFIX = 'castle-'
export const isCastleQuest = (id: string) => id.startsWith(CASTLE_PREFIX)

/** その月にクリアした階の数（月が変わると0から） */
export function castleCleared(state: Pick<GameState, 'castle'>, month: string): number {
  return state.castle?.month === month ? state.castle.cleared : 0
}

/** 零の孤城は毎月16日〜月末 */
export const castleOpen = (today: string) => isOpenOn(today, CONFIG.castle.openDays)

/** 城主：激レアの降臨のうち「零の孤城の城主」にした子（図鑑の番号順で最初の子） */
export function lastBossOf(defs: MonsterDef[]): MonsterDef | undefined {
  return defs.find((d) => d.questOnly && d.castleLord)
}

/** 爆絶のボスになる降臨：格が爆絶の降臨（城主は除く） */
export const isBakuzetsuBoss = (d: MonsterDef) => !d.castleLord && !d.castleOnly && bossGradeOf(d) === 'bakuzetsu'

/** 孤城限定の子（1〜10階のボス。毎月の初回クリアで手に入る） */
export const castleMonsters = (defs: MonsterDef[]) => defs.filter((d) => d.questOnly && d.castleOnly && !d.castleLord)

/**
 * 1〜10階のボス：孤城限定の子を、炎・水・木・光・闇の順に2周。
 * 足りない階は、爆絶のボス → 超絶のボス → ほかの降臨 → ガチャの子の順で埋める（コラボ・超究極・塔限定は入れない）
 */
export function castleLineup(defs: MonsterDef[], quests: Pick<Quest, 'kind' | 'grade' | 'rank' | 'bossDefId' | 'builtin'>[]): (MonsterDef | undefined)[] {
  const c = CONFIG.castle
  const bossIds = (grade: string) =>
    new Set(quests.filter((q) => q.kind !== 'material' && !q.builtin && gradeOf(q) === grade).map((q) => q.bossDefId))
  const strongIds = bossIds('chokyukyoku')
  const ok = (d: MonsterDef) => !d.series?.trim() && !strongIds.has(d.id) && bossGradeOf(d) !== 'chokyukyoku' && !d.tower && !d.castleLord
  const top = castleMonsters(defs).filter(ok)
  const slots = c.elementOrder.length * 2
  const lineup: (MonsterDef | undefined)[] = Array.from({ length: slots }, (_, i) => {
    const e = c.elementOrder[i % c.elementOrder.length]
    return top.filter((d) => elementInfo(d).elements[0] === e)[Math.floor(i / c.elementOrder.length)]
  })
  const used = new Set(lineup.filter((d) => d).map((d) => d!.id))
  const spare = [
    ...top,
    ...defs.filter((d) => isBakuzetsuBoss(d) || bossIds('bakuzetsu').has(d.id)),
    ...defs.filter((d) => bossIds('chozetsu').has(d.id) || bossGradeOf(d) === 'chozetsu'),
    ...defs.filter((d) => d.questOnly && !isHidden(d)),
    ...defs.filter((d) => !d.questOnly && !isHidden(d) && rarityOf(d) !== 'normal'),
  ].filter((d) => !used.has(d.id) && ok(d))
  return lineup.map((d) => {
    if (d) return d
    const next = spare.find((x) => !used.has(x.id))
    if (next) used.add(next.id)
    return next
  })
}

/** 零の孤城の11階ぶん。どの階も爆絶。11階は零属性の城主（属性の種類を求める） */
export function castleFloors(defs: MonsterDef[], gimmicks: string[], quests: Quest[] = []): TowerFloor[] {
  const c = CONFIG.castle
  const lineup = castleLineup(defs, quests)
  const lastBoss = lastBossOf(defs)
  return Array.from({ length: c.floors }, (_, i) => {
    const floor = i + 1
    const top = floor === c.floors
    const boss = top ? (lastBoss ?? lineup[lineup.length - 1]) : lineup[i]
    // 城主は零属性として戦う（弱点がない代わりに、属性の種類を求める）
    const asBoss = boss && top ? ({ ...boss, element: undefined, jogressElements: [] } as MonsterDef) : boss
    const element = top ? undefined : boss ? elementInfo(boss).elements[0] : undefined
    const attr = boss ? nodeAttr(boss, FIRST_NODE_ID) : 'none'
    const setup = asBoss
      ? autoQuestSetup(asBoss, 'bakuzetsu', 'boss', quests, gimmicks, `${CASTLE_PREFIX}${floor}`, defs, false)
      : { requirements: [], weakSlots: [] }
    const hp = Math.max(100, Math.round((standardSessionDamage() * c.hpRatio[i]) / 100) * 100)
    const quest: Quest = {
      id: `${CASTLE_PREFIX}${floor}`,
      name: top ? '零の孤城 最上階' : `零の孤城 ${floor}階`,
      kind: 'boss',
      bossDefId: boss?.id ?? '',
      attr: attr === 'none' ? 'chestArms' : attr,
      element,
      weakSlots: setup.weakSlots,
      requirements: setup.requirements,
      hp: { easy: hp, normal: hp, hard: hp },
      grade: 'bakuzetsu',
      catchphrase: top ? '零の王が待つ' : '',
      theme: 'night',
      createdAt: 0,
    }
    return {
      floor,
      quest,
      reward: {
        gold: c.gold[i],
        eggs: (c.eggs[floor] ?? 0) + (top && !lastBoss ? c.eggsInsteadOfBoss : 0),
        cores: 0,
        sticks: c.sticks[floor] ?? 0,
        booster: null,
        boosters: c.boosterPacks[floor] ?? [],
        custom: c.customs[floor],
        // 孤城限定の子と城主は、毎月の初回クリアで手に入る（ほかの埋め合わせのボスは落とさない）
        monsterDefId: top ? (lastBoss?.id ?? null) : boss?.castleOnly ? boss.id : null,
      },
    }
  })
}
