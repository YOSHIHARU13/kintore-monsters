import { CONFIG } from '../config/gameConfig'
import { DAYS, type Attr, type FormAttr } from '../data/exercises'
import { prevDateKey } from './date'
import { starsOf } from './gacha'
import { nodeAttr, type Checkin, type MonsterDef, type OwnedMonster, type Quest, type QuestDifficulty, type SetRecord } from '../types'

export const DIFFICULTIES: QuestDifficulty[] = ['easy', 'normal', 'hard']

export interface Member {
  mon: OwnedMonster
  def: MonsterDef
}

/** 属性の相性：胸腕 → 脚 → 背肩 → 胸腕（矢印の先に強い）。無はいつも等倍 */
export function affinity(attacker: FormAttr, boss: FormAttr): number {
  if (attacker === 'none' || boss === 'none') return 1
  const beats: Record<Attr, Attr> = { chestArms: 'legs', legs: 'backShoulders', backShoulders: 'chestArms' }
  if (beats[attacker] === boss) return CONFIG.quest.advantage
  if (beats[boss] === attacker) return CONFIG.quest.disadvantage
  return 1
}

/** ボスに有利な属性（適正） */
export function advantageAttr(boss: FormAttr): Attr | null {
  if (boss === 'none') return null
  const beatenBy: Record<Attr, Attr> = { legs: 'chestArms', backShoulders: 'legs', chestArms: 'backShoulders' }
  return beatenBy[boss]
}

/** モンスターの攻撃力：星の数 ×（1 + ＋の数 × perPlus） */
export function powerOf(member: Member): number {
  return starsOf(member.def, member.mon.nodeId) * (1 + CONFIG.quest.powerPerPlus * (member.mon.plus ?? 0))
}

export function attrOf(member: Member): FormAttr {
  return nodeAttr(member.def, member.mon.nodeId)
}

export interface Hit {
  label: string // 何の攻撃か（例：アームカール 3セット目）
  damage: number
  notes: string[] // 効いた補正（弱点・得意種目・特攻・相性）
}

type SetInfo = Pick<SetRecord, 'slotId' | 'day' | 'date' | 'judge' | 'eligible'> & {
  weightUp?: boolean
  extra?: boolean
}

/** 1セットぶんのダメージ。その部位の属性のモンスターと無属性のモンスターが攻撃する（ローラーは全員） */
export function setHit(set: SetInfo, quest: Quest, party: Member[], trainedDates: Set<string>, label: string): Hit {
  const q = CONFIG.quest
  const roller = set.day === 'bonus'
  const partAttr = roller ? null : DAYS[set.day as keyof typeof DAYS].attr
  const attackers = party.filter((m) => roller || attrOf(m) === 'none' || attrOf(m) === partAttr)
  const weak = quest.weakSlots.includes(set.slotId)
  const streak = trainedDates.has(prevDateKey(set.date))
  // 特攻スキルの条件：このセットが、そのやり方だったか
  const skillMet: Record<string, boolean> = {
    beat: set.judge === 'beat',
    weightUp: set.weightUp === true,
    extra: set.extra === true,
    streak,
    roller,
  }
  const base = roller ? q.rollerDamage : q.setDamage
  const notes = new Set<string>()
  if (weak) notes.add('弱点種目')
  if (attackers.length === 0) {
    // 攻撃できるモンスターがいなければ、自分で殴る
    return { label, damage: Math.round(base * (weak ? q.weakSlot : 1)), notes: [...notes, '素手'] }
  }
  let damage = 0
  for (const m of attackers) {
    let d = base * powerOf(m) * affinity(attrOf(m), quest.attr)
    if (weak) d *= q.weakSlot
    if (m.def.favoriteSlot === set.slotId) {
      d *= q.favorite
      notes.add(`${m.def.name}の得意種目`)
    }
    if (m.def.skill && m.def.skill === quest.weakSkill && skillMet[m.def.skill]) {
      d *= q.skill
      notes.add(`${m.def.name}の${CONFIG.skills[m.def.skill]}`)
    }
    const a = affinity(attrOf(m), quest.attr)
    if (a > 1) notes.add(`${m.def.name}の相性◎`)
    if (a < 1) notes.add(`${m.def.name}の相性×`)
    damage += d
  }
  return { label, damage: Math.round(damage), notes: [...notes] }
}

/** 朝の記録（歩数・習慣）ぶんのダメージ。全員で攻撃する */
export function checkinHits(checkin: Checkin, quest: Quest, party: Member[]): Hit[] {
  const q = CONFIG.quest
  const all = party.length > 0 ? party : []
  const hit = (label: string, base: number, skillKey: string): Hit => {
    if (base <= 0) return { label, damage: 0, notes: [] }
    const notes: string[] = []
    if (all.length === 0) return { label, damage: Math.round(base), notes: ['素手'] }
    let damage = 0
    for (const m of all) {
      let d = base * powerOf(m) * affinity(attrOf(m), quest.attr)
      if (m.def.skill === skillKey && quest.weakSkill === skillKey) {
        d *= q.skill
        notes.push(`${m.def.name}の${CONFIG.skills[skillKey]}`)
      }
      damage += d
    }
    return { label, damage: Math.round(damage), notes }
  }
  const habitPoints = checkin.habitMinutes ?? (checkin.habit ? q.habitCheckPoints : 0)
  return [
    hit(`${checkin.steps.toLocaleString()}歩`, Math.floor(checkin.steps / 1000) * q.stepsDamagePer1000, 'steps'),
    hit(`習慣 ${checkin.habitMinutes !== undefined ? `${checkin.habitMinutes}分` : checkin.habit ? '○' : '×'}`, habitPoints * q.habitDamagePerPoint, 'habit'),
  ].filter((h) => h.damage > 0)
}

/** 挑戦を始めてからの全部の攻撃 */
export function questHits(
  quest: Quest,
  party: Member[],
  sets: (SetRecord & { weightUp?: boolean; extra?: boolean })[],
  checkins: Checkin[],
  exerciseName: (slotId: string) => string,
): Hit[] {
  const dates = new Set(sets.map((s) => s.date))
  const counted = sets.filter((s) => s.eligible)
  const perSlot: Record<string, number> = {}
  const setHits = counted.map((s) => {
    perSlot[s.slotId] = (perSlot[s.slotId] ?? 0) + 1
    return setHit(s, quest, party, dates, `${exerciseName(s.slotId)} ${perSlot[s.slotId]}セット目`)
  })
  return [...setHits, ...checkins.flatMap((c) => checkinHits(c, quest, party))]
}

/** HPの目安：★4を3体（胸腕・脚・背肩が1体ずつ）、相性・弱点なしで、1週間ぜんぶやったときのダメージ */
export function standardWeekDamage(): number {
  const q = CONFIG.quest
  const power = 4
  const sets = 14 * CONFIG.sets.perExercise * q.setDamage * power // 各セットは、その部位の1体が攻撃
  const roller = 7 * CONFIG.sets.perExercise * q.rollerDamage * power * 3
  const steps = 7 * 7 * q.stepsDamagePer1000 * power * 3 // 毎日7000歩
  const habit = 7 * 10 * q.habitDamagePerPoint * power * 3 // 毎日10分
  return Math.round(sets + roller + steps + habit)
}
