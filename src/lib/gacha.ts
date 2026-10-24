import { CONFIG } from '../config/gameConfig'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { isHidden, type GameState, type MonsterDef, type QuestGrade, type RarityKey } from '../types'

export const RARITY_KEYS = Object.keys(CONFIG.gacha.rarities) as RarityKey[]

/** 以前のレア度（4段階）から今のレア度（3段階）へ：ハズレ→ノーマル、ノーマル・中当たり→レア、激レア→激レア */
const LEGACY_TIER: Record<string, RarityKey> = { hazure: 'normal', normal: 'rare', uncommon: 'rare', superRare: 'superRare', rare: 'superRare' }

/** そのモンスターのレア度（ノーマル・レア・激レア）。以前のデータは読み替える */
export function rarityOf(def: Pick<MonsterDef, 'tier' | 'rarity' | 'common'>): RarityKey {
  if (def.tier) return def.tier
  if (def.rarity) return LEGACY_TIER[def.rarity] ?? 'rare'
  return def.common ? 'normal' : 'rare'
}

/** 以前のレア度から決める降臨の格（格を書き込む前のデータ用） */
const LEGACY_GRADE: Record<string, QuestGrade> = { hazure: 'jokyu', normal: 'kyukyoku', uncommon: 'chozetsu', rare: 'chozetsu', superRare: 'bakuzetsu' }

/** 降臨の格（上級〜爆絶）。決めていなければ以前のレア度から。降臨でなければ undefined */
export function bossGradeOf(def: Pick<MonsterDef, 'questOnly' | 'bossGrade' | 'rarity' | 'series'>): QuestGrade | undefined {
  if (!def.questOnly) return undefined
  if (def.bossGrade) return def.bossGrade
  const g = LEGACY_GRADE[def.rarity ?? ''] ?? 'kyukyoku'
  return g === 'chozetsu' && def.series?.trim() ? 'chokyukyoku' : g
}

/** そのモンスターが入っているガチャ。どこにも入れていなければ「いつものガチャ」 */
export function gachasOf(def: MonsterDef): string[] {
  return def.gachas?.length ? def.gachas : [CONFIG.gacha.defaultId]
}

/** そのガチャのコラボ（そのガチャに入れた子のコラボ名）。コラボでなければ空 */
export function collabsOfGacha(gachaId: string, defs: MonsterDef[]): Set<string> {
  return new Set(
    defs
      .filter((d) => !isHidden(d) && !d.questOnly && (d.gachas ?? []).includes(gachaId))
      .map((d) => d.series?.trim() ?? '')
      .filter((s) => s !== ''),
  )
}

/**
 * そのガチャから出るか。ノーマルとレアはどのガチャからも、激レアは入れたガチャだけ。
 * コラボの子だけは、どのレア度でもそのコラボのガチャ（同じコラボの子を入れたガチャ）からだけ出る
 */
export function inGacha(def: MonsterDef, gachaId: string, collabs: Set<string> = new Set()): boolean {
  if (isHidden(def) || def.questOnly) return false
  const series = def.series?.trim() ?? ''
  if (gachasOf(def).includes(gachaId) && def.gachas?.length) return true
  if (!CONFIG.gacha.rarities[rarityOf(def)].everyGacha) return gachasOf(def).includes(gachaId)
  if (series !== '') return collabs.has(series)
  // コラボのガチャのレア（当たり）は、コラボの子だけ。ノーマルはいつもの子も出る
  return !(collabs.size > 0 && rarityOf(def) === 'rare')
}

export interface Rate {
  def: MonsterDef
  rarity: RarityKey
  rate: number // 0〜1
}

/**
 * ガチャの中身と、1体ずつの出る確率。
 * レア度ごとの確率を、同じレア度のモンスターで山分けする。
 * そのガチャにいないレア度の確率は、いるレア度に元の比率のまま割り振る。
 */
export function rateTable(gachaId: string, defs: MonsterDef[]): Rate[] {
  const collabs = collabsOfGacha(gachaId, defs)
  const members = defs.filter((d) => inGacha(d, gachaId, collabs))
  const count = (r: RarityKey) => members.filter((d) => rarityOf(d) === r).length
  const present = RARITY_KEYS.filter((r) => count(r) > 0)
  const total = present.reduce((sum, r) => sum + CONFIG.gacha.rarities[r].rate, 0)
  return RARITY_KEYS.flatMap((r) =>
    members
      .filter((d) => rarityOf(d) === r)
      .map((def) => ({ def, rarity: r, rate: CONFIG.gacha.rarities[r].rate / total / count(r) })),
  )
}

/** ピックアップ（そのガチャを選んだモンスターだけが出るレア度＝レア以上）か */
export function isPickupRarity(r: RarityKey): boolean {
  return !CONFIG.gacha.rarities[r].everyGacha
}

/** そのガチャのピックアップの数 */
export function pickupCount(table: Rate[]): number {
  return table.filter((t) => isPickupRarity(t.rarity)).length
}

/** ショップで引けるか。作ったガチャはピックアップがそろってから（いつものガチャはいつでも） */
export function isReady(gacha: { builtin: boolean }, table: Rate[]): boolean {
  return table.length > 0 && (gacha.builtin || pickupCount(table) >= CONFIG.gacha.minPickups)
}

/** レア度ごとの合計確率（そのガチャにいるレア度だけ） */
export function tierRates(table: Rate[]): { rarity: RarityKey; rate: number; count: number }[] {
  return RARITY_KEYS.map((rarity) => {
    const rows = table.filter((t) => t.rarity === rarity)
    return { rarity, rate: rows.reduce((sum, t) => sum + t.rate, 0), count: rows.length }
  }).filter((t) => t.count > 0)
}

/** 確率どおりに1体選ぶ。random は 0以上1未満 */
export function pickFrom(table: Rate[], random: number): MonsterDef | null {
  let acc = 0
  for (const row of table) {
    acc += row.rate
    if (random < acc) return row.def
  }
  return table[table.length - 1]?.def ?? null
}

/** 確定で引く（ホシ玉・激レア確定ガチャ）：そのガチャのレア以上から。激レアは superRareRate、残りはレア（片方しかいなければそちら） */
export function drawSure(table: Rate[], random: number, superRareRate: number): MonsterDef | null {
  const pick = (r: RarityKey) => table.filter((t) => t.rarity === r)
  const sr = pick('superRare')
  const rare = pick('rare')
  const pool = sr.length === 0 ? rare : rare.length === 0 ? sr : random < superRareRate ? sr : rare
  if (pool.length === 0) return pickFrom(table, random)
  const r = sr.length > 0 && rare.length > 0 ? (random < superRareRate ? random / superRareRate : (random - superRareRate) / (1 - superRareRate)) : random
  return pool[Math.min(pool.length - 1, Math.floor(r * pool.length))].def
}

/** 確率の表示（例：12.5%） */
export function percent(rate: number): string {
  const p = rate * 100
  return `${p >= 10 ? p.toFixed(1).replace(/\.0$/, '') : p.toFixed(2).replace(/\.?0+$/, '')}%`
}

/**
 * その形態の星の数。進化形態で決まり、レア度の上限まで（ノーマル★2・レア★3・激レア★3。★4は獣神化で）。
 * 降臨は格で決まる。ジョグレスはレシピの「生まれるときの星」から
 */
export function starsOf(def: MonsterDef, nodeId: string): number {
  const template = getTemplate(def.templateId)
  const stage = getNode(template, nodeId).stage
  if (isHidden(def)) {
    // 隠しモンスターは、レシピで決めた「生まれるときの星」から数える
    return Math.min(CONFIG.gacha.maxStars, (def.jogressBirthStars ?? CONFIG.gacha.jogressDefaultBirth) + stage - 1)
  }
  const grade = bossGradeOf(def)
  if (grade) return CONFIG.quest.bossGrades[grade].stars
  // 進化しない（1形態だけの）ガチャのモンスターは、そのレア度のいちばん上の星で生まれる
  if (template.nodes.length === 1) return CONFIG.gacha.rarities[rarityOf(def)].maxStars
  return Math.min(CONFIG.gacha.rarities[rarityOf(def)].maxStars, CONFIG.gacha.formStarBase + stage)
}

/** 形態の呼び名：星の数（分岐があれば A・B・C を添える）。例：★2、★3-B */
export function formLabel(def: MonsterDef, nodeId: string): string {
  const branch = /[a-c]$/.exec(nodeId)?.[0]
  return `★${starsOf(def, nodeId)}${branch ? `-${branch.toUpperCase()}` : ''}`
}

/** ガチャの払い方：トク玉1個か、オーブ（CONFIG.shop.pullPrice 個）か、ホシ玉1個（レア以上確定） */
export type Pay = 'eggs' | 'orbs' | 'hoshi'

/** 今の手持ちで引ける回数 */
export function pullsAffordable(state: Pick<GameState, 'eggs' | 'gold' | 'hoshi'>, pay: Pay): number {
  if (pay === 'hoshi') return state.hoshi ?? 0
  return pay === 'orbs' ? Math.floor(state.gold / CONFIG.shop.pullPrice) : state.eggs
}
