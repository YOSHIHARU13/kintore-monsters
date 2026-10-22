import { CONFIG } from '../config/gameConfig'
import { DAYS, type Attr, type FormAttr } from '../data/exercises'
import { attackOf } from './stats'
import { gimmickRate, unmatchedGimmicks } from './gimmick'
import { nodeAttr, type Challenge, type MonsterDef, type OwnedMonster, type Quest, type QuestDifficulty, type SetRecord } from '../types'

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

/** ダメージの計算に使う強さ：攻撃力 ÷ attackUnit（★1の攻撃力で1） */
export function powerOf(member: Member): number {
  return attackOf(member.mon, member.def) / CONFIG.quest.attackUnit
}

export function attrOf(member: Member): FormAttr {
  return nodeAttr(member.def, member.mon.nodeId)
}

export interface Hit {
  label: string // 何の攻撃か（例：アームカール 3セット目）
  damage: number
  notes: string[] // 効いた補正（弱点・得意種目・相性・ギミック）
}

type SetInfo = Pick<SetRecord, 'slotId' | 'day' | 'eligible'>

/** 1セットぶんのダメージ。その部位の属性のモンスターと無属性のモンスターが攻撃する（ローラーは全員） */
export function setHit(set: SetInfo, quest: Quest, party: Member[], label: string): Hit {
  const q = CONFIG.quest
  const roller = set.day === 'bonus'
  const partAttr = roller ? null : DAYS[set.day as keyof typeof DAYS].attr
  const attackers = party.filter((m) => roller || attrOf(m) === 'none' || attrOf(m) === partAttr)
  const weak = quest.weakSlots.includes(set.slotId)
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
    // ボスのギミックに対応できていなければ、そのぶん攻撃が減る
    const missing = unmatchedGimmicks(m.def, quest)
    d *= gimmickRate(m.def, quest)
    if (missing.length > 0) notes.add(`${m.def.name}は${missing.join('・')}で弱体`)
    const a = affinity(attrOf(m), quest.attr)
    if (a > 1) notes.add(`${m.def.name}の相性◎`)
    if (a < 1) notes.add(`${m.def.name}の相性×`)
    damage += d
  }
  return { label, damage: Math.round(damage), notes: [...notes] }
}

/** 挑戦を始めてからの攻撃（報酬が出るセットだけ数える） */
export function questHits(quest: Quest, party: Member[], sets: SetRecord[], exerciseName: (slotId: string) => string): Hit[] {
  const perSlot: Record<string, number> = {}
  return sets
    .filter((s) => s.eligible)
    .map((s) => {
      perSlot[s.slotId] = (perSlot[s.slotId] ?? 0) + 1
      return setHit(s, quest, party, `${exerciseName(s.slotId)} ${perSlot[s.slotId]}セット目`)
    })
}

/**
 * HPの目安：1回のトレーニングで与えるダメージ。
 * 攻撃力9,000（ノーマルの★3くらい）が6体（各属性2体）、相性・弱点なしで、1部位ぶん（5種目×3セット）＋ローラー3セット。
 */
export function standardSessionDamage(): number {
  const q = CONFIG.quest
  const power = 9000 / q.attackUnit
  const sets = 5 * CONFIG.sets.perExercise * q.setDamage * power * 2 // その部位の属性の2体が攻撃
  const roller = CONFIG.sets.perExercise * q.rollerDamage * power * 6
  return Math.round(sets + roller)
}

export interface Battle {
  challenge: Challenge
  quest: Quest
  boss: MonsterDef | undefined
  party: Member[]
  hits: Hit[]
  damage: number
  hp: number
  defeated: boolean
}

/** 今日の戦いの状況。挑戦していない・日付が変わった・クエストが消えたときは null */
export function battleOf(
  challenge: Challenge | null,
  today: string,
  quests: Quest[],
  defs: MonsterDef[],
  owned: OwnedMonster[],
  weekSets: SetRecord[],
  exerciseName: (slotId: string) => string,
): Battle | null {
  if (!challenge || challenge.date !== today) return null
  const quest = quests.find((q) => q.id === challenge.questId)
  if (!quest) return null
  const party = challenge.party.flatMap((id) => {
    const mon = owned.find((o) => o.id === id)
    const def = mon && defs.find((d) => d.id === mon.defId)
    return mon && def ? [{ mon, def }] : []
  })
  const sets = weekSets.filter((s) => s.ts >= challenge.startTs && s.date === today)
  const hits = questHits(quest, party, sets, exerciseName)
  const damage = hits.reduce((sum, h) => sum + h.damage, 0)
  const hp = quest.hp[challenge.difficulty]
  return { challenge, quest, boss: defs.find((d) => d.id === quest.bossDefId), party, hits, damage, hp, defeated: damage >= hp }
}

/** ボスの格 */
export function rankOf(quest: Pick<Quest, 'rank'>) {
  const ranks = CONFIG.quest.ranks
  return ranks[Math.min(ranks.length - 1, Math.max(0, quest.rank ?? 1))]
}

/** 倒したときのゴールド：難易度のゴールド × ボスの格（素材クエストは少なめ） */
export function questGold(quest: Pick<Quest, 'rank' | 'kind'>, difficulty: QuestDifficulty): number {
  const ratio = quest.kind === 'material' ? CONFIG.cores.materialGoldRatio : 1
  return Math.round(CONFIG.quest.difficulties[difficulty].gold * rankOf(quest).gold * ratio)
}

/** HPの初期値：1回のトレーニングで与えるダメージの目安 × ボスの格 × 難易度（100の位で丸める） */
export function defaultHp(rank: number, kind: Quest['kind'] = 'boss'): Record<QuestDifficulty, number> {
  const hp = standardSessionDamage() * rankOf({ rank }).hp * (kind === 'material' ? CONFIG.cores.materialHpRatio : 1)
  return Object.fromEntries(
    DIFFICULTIES.map((d) => [d, Math.max(100, Math.round((hp * CONFIG.quest.difficulties[d].hpRatio) / 100) * 100)]),
  ) as Record<QuestDifficulty, number>
}
