import { CONFIG } from '../config/gameConfig'
import { BONUS_SLOT, DAYS, SLOTS, type FormAttr } from '../data/exercises'
import { attackOf } from './stats'
import { rarityOf } from './gacha'
import { customized, isFavorite } from './custom'
import { abilityTag, formationOf, requirementsOf, tagAbilities, tagsOf } from './formation'
import { elementInfo, hasAdvantage } from './element'
import { nodeAttr, type Challenge, type MonsterDef, type OwnedMonster, type Quest, type QuestDifficulty, type QuestGrade, type SetRecord } from '../types'

export const DIFFICULTIES: QuestDifficulty[] = ['easy', 'normal', 'hard']

/** 神殿（カスタマイズアイテムが落ちる）か */
export const isTemple = (quest: Pick<Quest, 'drop'>) => quest.drop === 'custom'

/** そのクエストで選べる難易度（神殿は「時の間」「修羅場」の2つ） */
export function levelsOf(quest: Pick<Quest, 'drop'>): QuestDifficulty[] {
  return isTemple(quest) ? ['normal', 'hard'] : DIFFICULTIES
}

/** 難易度の名前（神殿は時の間・修羅場） */
export function difficultyLabel(quest: Pick<Quest, 'drop'>, d: QuestDifficulty): string {
  return isTemple(quest) && d !== 'easy' ? CONFIG.temple.labels[d] : CONFIG.quest.difficulties[d].label
}

export interface Member {
  mon: OwnedMonster
  def: MonsterDef
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
  byMember: Record<string, number> // 出撃した子ごとのダメージ（monsterId → ダメージ）
  skills?: Record<string, string[]> // 出撃した子ごとに、効いた補正（戦闘画面の演出用。例：['部位一致', 'アビリティ×2']）
}

/** その子が持っている、クエストの条件に出てくるアビリティの数 */
export function matchedAbilities(def: MonsterDef, quest: Pick<Quest, 'requirements' | 'gimmicks'>): number {
  const wanted = new Set(requirementsOf(quest).flatMap((r) => tagAbilities(r.tag)))
  const own = tagsOf(def)
  return [...wanted].filter((g) => own[abilityTag(g)]).length
}

type SetInfo = Pick<SetRecord, 'slotId' | 'day' | 'eligible'>

/** 1セットぶんのダメージ。全員が攻撃し、セットの部位と一致するモンスターは強い（ローラーは全員同じ）。最後に編成倍率がかかる */
export function setHit(set: SetInfo, quest: Quest, party: Member[], label: string, rate = 1): Hit {
  const q = CONFIG.quest
  const roller = set.day === 'bonus'
  const partAttr = roller ? null : DAYS[set.day as keyof typeof DAYS].attr
  const weak = quest.weakSlots.includes(set.slotId)
  // ボスと同じ部位の種目は、どれでも少し効く（弱点種目はさらに）
  const bossPart = !!partAttr && quest.attr === partAttr
  const base = roller ? q.rollerDamage : q.setDamage
  const notes = new Set<string>()
  if (bossPart && !weak) notes.add('ボスの部位')
  if (weak) notes.add('弱点種目')
  if (party.length === 0) {
    // 出撃メンバーがいなければ、自分で殴る
    return { label, damage: Math.round(base * (bossPart ? q.bossPart : 1) * (weak ? q.weakSlot : 1)), notes: [...notes, '素手'], byMember: {} }
  }
  // 超絶では、ボスの属性に有利な属性を持たないモンスターの攻撃が半減
  const strict = isStrict(quest)
  let damage = 0
  const byMember: Record<string, number> = {}
  const skills: Record<string, string[]> = {}
  for (const m of party) {
    let d = base * powerOf(m)
    const own: string[] = []
    // 条件に合うアビリティを持っている子は、その子自身も強い（1つにつき+25%）
    const matched = matchedAbilities(m.def, quest)
    if (matched > 0) {
      d *= 1 + q.abilityBonus * matched
      own.push(`アビリティ×${(1 + q.abilityBonus * matched).toFixed(2).replace(/0$/, '')}`)
    }
    // 零属性：どこでも×1.2で、半減もされない
    const zero = elementInfo(m.def).elements.length === 0
    if (zero) {
      d *= q.zeroBonus
      notes.add(`${m.def.name}は零属性×${q.zeroBonus}`)
      own.push(`零属性×${q.zeroBonus}`)
    } else if (strict && !fitsQuest(m.def, quest)) {
      const bakuzetsu = gradeOf(quest) === 'bakuzetsu'
      d *= bakuzetsu ? q.offElementBakuzetsu : q.offElementChozetsu
      notes.add(`${m.def.name}は属性が合わず${bakuzetsu ? '3分の1' : '半減'}`)
      own.push(bakuzetsu ? '属性×1/3' : '属性×1/2')
    } else if (hasAdvantage(m.def, quest.element)) {
      own.push('有利属性')
    }
    // 零属性のボスには、2属性のモンスターが強い
    if (!quest.element && elementInfo(m.def).elements.length >= 2) {
      d *= q.multiElementBonus
      own.push(`2属性×${q.multiElementBonus}`)
    }
    // コラボの激レア・レアは、同じコラボのボスに×1.5
    if (isCollabHero(m.def, quest)) {
      d *= q.collabBonus
      notes.add(`${m.def.name}はコラボ×${q.collabBonus}`)
      own.push(`コラボ×${q.collabBonus}`)
    }
    if (partAttr && attrOf(m) === partAttr) {
      d *= q.partMatch
      own.push(`部位一致×${q.partMatch}`)
    }
    if (bossPart) d *= q.bossPart
    if (weak) d *= q.weakSlot
    if (isFavorite(m.def, set.slotId)) {
      d *= q.favorite
      notes.add(`${m.def.name}の得意種目`)
      own.push(`得意種目×${q.favorite}`)
    }
    damage += d
    byMember[m.mon.id] = (byMember[m.mon.id] ?? 0) + d * rate
    skills[m.mon.id] = own
  }
  return { label, damage: Math.round(damage * rate), notes: [...notes], byMember, skills }
}

/** その難易度で使う編成の条件と弱点（最初からある素材クエストは難易度ごとに決まっている） */
export function atDifficulty(quest: Quest, difficulty: QuestDifficulty): Quest {
  const requirements = quest.requirementsBy?.[difficulty]
  const weakSlots = quest.weakSlotsBy?.[difficulty]
  return requirements || weakSlots
    ? { ...quest, requirements: requirements ?? quest.requirements, weakSlots: weakSlots ?? quest.weakSlots }
    : quest
}

/** コラボの激レア・レアが、同じコラボのボスと戦っているか */
export function isCollabHero(def: MonsterDef, quest: Pick<Quest, 'bossSeries'>): boolean {
  const series = def.series?.trim() ?? ''
  return series !== '' && series === quest.bossSeries && !def.questOnly && rarityOf(def) !== 'normal'
}

/** 挑戦を始めてからの攻撃（報酬が出るセットだけ数える） */
export function questHits(quest: Quest, party: Member[], sets: SetRecord[], exerciseName: (slotId: string) => string): Hit[] {
  const perSlot: Record<string, number> = {}
  const { rate } = formationOf(
    party.map((m) => m.def),
    requirementsOf(quest),
  )
  return sets
    .filter((s) => s.eligible)
    .map((s) => {
      perSlot[s.slotId] = (perSlot[s.slotId] ?? 0) + 1
      return setHit(s, quest, party, `${exerciseName(s.slotId)} ${perSlot[s.slotId]}セット目`, rate)
    })
}

/**
 * HPの目安：1回のトレーニングで与えるダメージ。
 * 攻撃力9,000（ノーマルの★3くらい）が6体（各部位2体）、編成がちょうどそろっていて弱点なしで、1部位ぶん（5種目×3セット）＋ローラー3セット。
 */
export function standardSessionDamage(): number {
  const q = CONFIG.quest
  const power = 9000 / q.attackUnit
  // 部位が一致する2体は ×partMatch、残りの4体はそのまま
  const sets = 5 * CONFIG.sets.perExercise * q.setDamage * power * (2 * q.partMatch + 4)
  const roller = CONFIG.sets.perExercise * q.rollerDamage * power * 6
  return Math.round(sets + roller)
}

/** そのメンバーで、各部位の日のメニューを1回こなしたときのダメージの見込み（基本セット＋ローラー） */
export function sessionEstimate(quest: Quest, party: Member[]): { day: keyof typeof DAYS; damage: number }[] {
  const { rate } = formationOf(
    party.map((m) => m.def),
    requirementsOf(quest),
  )
  return (Object.keys(DAYS) as (keyof typeof DAYS)[]).map((day) => {
    // 全身枠は1枠ぶん（基本セット）で見込む
    const slots = SLOTS.filter((s) => s.day === day || s.id === BONUS_SLOT.id)
    const damage = slots.reduce(
      (sum, s) => sum + CONFIG.sets.perExercise * setHit({ slotId: s.id, day: s.day, eligible: true }, quest, party, '', rate).damage,
      0,
    )
    return { day, damage }
  })
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
  byMember: Record<string, number> // 出撃した子ごとの、これまでのダメージ
  mvpId: string | null // いちばんダメージを与えた子
  stage: number // 今戦っているバトル（1〜3。倒しきったら3）
  reached: number // 突破したバトルの数（0〜3）
}

/** 与えたダメージで、何バトル目まで突破したか（HPを3等分） */
export function battlesReached(damage: number, hp: number): number {
  const n = CONFIG.quest.battles
  return Math.max(0, Math.min(n, Math.floor((damage * n) / Math.max(1, hp) + 1e-9)))
}

/** 今のバトルのHP：そのバトルの最大と残り */
export function stageHp(damage: number, hp: number): { max: number; left: number } {
  const n = CONFIG.quest.battles
  const max = hp / n
  const stage = Math.min(n - 1, battlesReached(damage, hp))
  return { max, left: Math.max(0, Math.min(max, (stage + 1) * max - damage)) }
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
  const found = quests.find((q) => q.id === challenge.questId)
  if (!found) return null
  const quest = atDifficulty(found, challenge.difficulty)
  const party = challenge.party.flatMap((id) => {
    const mon = owned.find((o) => o.id === id)
    const def = mon && defs.find((d) => d.id === mon.defId)
    // カスタマイズ（得意種目・アビリティの追加）もそのまま効く
    return mon && def ? [{ mon, def: customized(def, mon) }] : []
  })
  const sets = weekSets.filter((s) => s.ts >= challenge.startTs && s.date === today)
  const hits = questHits(quest, party, sets, exerciseName)
  const damage = hits.reduce((sum, h) => sum + h.damage, 0)
  const hp = questHp(quest, challenge.difficulty)
  const byMember: Record<string, number> = {}
  for (const h of hits) for (const [id, d] of Object.entries(h.byMember)) byMember[id] = (byMember[id] ?? 0) + d
  const mvpId = Object.entries(byMember).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const boss = defs.find((d) => d.id === quest.bossDefId)
  const reached = battlesReached(damage, hp)
  return {
    challenge,
    quest,
    boss,
    party,
    hits,
    damage,
    hp,
    defeated: damage >= hp,
    byMember,
    mvpId,
    stage: Math.min(CONFIG.quest.battles, reached + 1),
    reached,
  }
}

/** ボスの格 */
export function rankOf(quest: Pick<Quest, 'rank'>) {
  const ranks = CONFIG.quest.ranks
  return ranks[Math.min(ranks.length - 1, Math.max(0, quest.rank ?? 1))]
}

export const GRADES: QuestGrade[] = ['jokyu', 'kiwami', 'kyukyoku', 'chozetsu', 'bakuzetsu', 'chokyukyoku']


/** 適正：ボスに有利な属性か、編成の条件で求められている属性を持っている */
export function fitsQuest(def: MonsterDef, quest: Pick<Quest, 'element' | 'requirements' | 'gimmicks'>): boolean {
  if (hasAdvantage(def, quest.element)) return true
  const wanted = requirementsOf(quest).filter((r) => r.tag.startsWith('el:')).map((r) => r.tag.slice(3))
  return elementInfo(def).elements.some((e) => wanted.includes(e))
}

/** 適正の属性以外が半減する格（超絶・超究極） */
export function isStrict(quest: Pick<Quest, 'kind' | 'grade' | 'rank' | 'element'>): boolean {
  const g = gradeOf(quest)
  return quest.kind !== 'material' && (g === 'chozetsu' || g === 'chokyukyoku' || g === 'bakuzetsu') && !!quest.element
}

/** ボスクエストは難易度が1つだけ（内部では normal を使う） */
export const BOSS_DIFFICULTY: QuestDifficulty = 'normal'

/** ボスクエストの格。格を決める前のクエストは、以前の「雑魚〜極」から読み替える */
export function gradeOf(quest: Pick<Quest, 'grade' | 'rank'>): QuestGrade {
  if (quest.grade) return quest.grade
  const rank = quest.rank ?? 1
  return rank <= 1 ? 'kiwami' : rank === 2 ? 'kyukyoku' : 'chozetsu'
}

export function questHp(quest: Pick<Quest, 'kind' | 'hp'>, difficulty: QuestDifficulty): number {
  return quest.kind === 'material' ? quest.hp[difficulty] : quest.hp[BOSS_DIFFICULTY]
}

/** 倒したときのゴールド：ボスクエストは格で、素材クエストは難易度 × 格（少なめ） */
export function questGold(quest: Pick<Quest, 'rank' | 'kind' | 'grade'>, difficulty: QuestDifficulty): number {
  if (quest.kind !== 'material') return CONFIG.quest.grades[gradeOf(quest)].gold
  return Math.round(CONFIG.quest.difficulties[difficulty].gold * rankOf(quest).gold)
}

/** ボスクエストで手に入るボスの＋（＋はなくなったので、いつも0） */
export function dropPlus(_quest: Pick<Quest, 'grade' | 'rank'>): number {
  return 0
}

/** クエストの格や難易度の表示（例：超絶、素材の上級） */
export function questLevelLabel(quest: Pick<Quest, 'kind' | 'grade' | 'rank' | 'drop'>, difficulty: QuestDifficulty): string {
  return quest.kind === 'material' ? difficultyLabel(quest, difficulty) : CONFIG.quest.grades[gradeOf(quest)].label
}

/** ボスクエストのHPの初期値：1回のトレーニングで与えるダメージの目安 × 格 */
export function defaultBossHp(grade: QuestGrade): number {
  return Math.max(100, Math.round((standardSessionDamage() * CONFIG.quest.grades[grade].hpRatio) / 100) * 100)
}

/** HPの初期値：1回のトレーニングで与えるダメージの目安 × ボスの格 × 難易度（100の位で丸める） */
export function defaultHp(rank: number, kind: Quest['kind'] = 'boss'): Record<QuestDifficulty, number> {
  const hp = standardSessionDamage() * rankOf({ rank }).hp * (kind === 'material' ? CONFIG.materials.hpRatio : 1)
  return Object.fromEntries(
    DIFFICULTIES.map((d) => [d, Math.max(100, Math.round((hp * CONFIG.quest.difficulties[d].hpRatio) / 100) * 100)]),
  ) as Record<QuestDifficulty, number>
}
