import { CONFIG } from '../config/gameConfig'
import { elementInfo } from './element'
import { partTag } from './formation'
import { bossGradeOf } from './gacha'
import { standardSessionDamage } from './quest'
import { autoQuestSetup } from './questAuto'
import { PATTERN_PARTS, patternBoss, patternOf, patternPick, weakSlotsFor } from './pattern'
import { isOpenOn, type TowerFloor } from './tower'
import { isHidden, type GameState, type MonsterDef, type Quest, type QuestGrade } from '../types'

export const KINKIN_PREFIX = 'kinkin-'
export const isKinkinQuest = (id: string) => id.startsWith(KINKIN_PREFIX)

/** 禁筋の獄は毎月11〜20日 */
export const kinkinOpen = (today: string) => isOpenOn(today, CONFIG.kinkin.openDays)

/** その月にクリアした階の数（月が変わると0から） */
export function kinkinCleared(state: Pick<GameState, 'kinkin'>, month: string): number {
  return state.kinkin?.month === month ? state.kinkin.cleared : 0
}

/** ボス：爆絶の降臨（コラボ・塔限定・孤城限定・城主は入れない）を、炎・水・木・光・闇の順に4周。足りなければ超絶 → ほかの降臨で埋める */
export function kinkinLineup(defs: MonsterDef[]): (MonsterDef | undefined)[] {
  const order = CONFIG.castle.elementOrder
  const ok = (d: MonsterDef) =>
    d.questOnly && !isHidden(d) && !d.tower && !d.castleOnly && !d.castleLord && !d.kinkinLord && !d.series?.trim()
  const strong = defs.filter((d) => ok(d) && bossGradeOf(d) === 'bakuzetsu')
  const lineup = Array.from({ length: CONFIG.kinkin.floors }, (_, i) => {
    const e = order[i % order.length]
    return strong.filter((d) => elementInfo(d).elements[0] === e)[Math.floor(i / order.length)]
  })
  const used = new Set(lineup.filter((d) => d).map((d) => d!.id))
  const spare = [...strong, ...defs.filter((d) => ok(d) && bossGradeOf(d) === 'chozetsu'), ...defs.filter(ok)]
  return lineup.map((d, i) => {
    if (d) return d
    const next = spare.find((x) => !used.has(x.id)) ?? spare[i % Math.max(1, spare.length)]
    if (next) used.add(next.id)
    return next
  })
}

/** 最上階のボス（登録した子を、月のパターンごとに入れ替える） */
export const kinkinLords = (defs: MonsterDef[]) => defs.filter((d) => d.questOnly && d.kinkinLord)

/**
 * 禁筋の獄の20階ぶん。上の階ほどきびしく、16階から爆絶。持ち物検査は属性・アビリティ・部位。
 * 月ごとのパターン（胸腕・脚・背肩の月）で、部位・弱点・条件と、最上階のボスが変わる
 */
export function kinkinFloors(month: string, defs: MonsterDef[], gimmicks: string[], quests: Quest[] = []): TowerFloor[] {
  const k = CONFIG.kinkin
  const pattern = patternOf(month)
  const part = PATTERN_PARTS[pattern]
  const lineup = kinkinLineup(defs)
  const lord = patternPick(kinkinLords(defs), pattern)
  return Array.from({ length: k.floors }, (_, i) => {
    const floor = i + 1
    const top = floor === k.floors
    const boss = top && lord ? lord : lineup[i]
    const grade: QuestGrade = floor >= k.bakuzetsuFrom ? 'bakuzetsu' : 'chozetsu'
    const setup = boss
      ? autoQuestSetup(patternBoss(boss, pattern), grade, 'boss', quests, gimmicks, `${KINKIN_PREFIX}${floor}`, defs, false)
      : { requirements: [], weakSlots: [] }
    const hp = Math.max(100, Math.round((standardSessionDamage() * k.hpRatio[i]) / 100) * 100)
    const quest: Quest = {
      id: `${KINKIN_PREFIX}${floor}`,
      name: `禁筋の獄 ${floor}階`,
      kind: 'boss',
      bossDefId: boss?.id ?? '',
      attr: part,
      element: boss ? elementInfo(boss).elements[0] : undefined,
      weakSlots: weakSlotsFor(part, `kinkin:${floor}:${pattern}`, floor >= k.bakuzetsuFrom ? 2 : 1),
      requirements: [...setup.requirements, { tag: partTag(part), count: floor >= k.bakuzetsuFrom ? 4 : 3 }],
      hp: { easy: hp, normal: hp, hard: hp },
      grade,
      catchphrase: floor === k.floors ? '獄の底' : '',
      theme: 'night',
      createdAt: 0,
    }
    return {
      floor,
      quest,
      reward: {
        gold: k.gold[i],
        eggs: 0,
        cores: 0,
        balls: k.balls[floor] ?? 0,
        sticks: k.sticks[floor] ?? 0,
        booster: null,
        custom: k.customs[floor],
        // 最上階のボスは、毎月の初回クリアで手に入る（ほかの階のボスは落とさない）
        monsterDefId: top && lord ? lord.id : null,
      },
    }
  })
}
