import { CONFIG } from '../config/gameConfig'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { isHidden, type MonsterDef, type RarityKey } from '../types'

export const RARITY_KEYS = Object.keys(CONFIG.gacha.rarities) as RarityKey[]

/** そのモンスターのレア度。未設定ならノーマル（ハズレ枠にしていた分はハズレ） */
export function rarityOf(def: MonsterDef): RarityKey {
  return def.rarity ?? (def.common ? 'hazure' : 'normal')
}

/** そのモンスターが入っているガチャ。どこにも入れていなければ「いつものガチャ」 */
export function gachasOf(def: MonsterDef): string[] {
  return def.gachas?.length ? def.gachas : [CONFIG.gacha.defaultId]
}

/** そのガチャから出るか。ハズレとノーマルはどのガチャからも出る */
export function inGacha(def: MonsterDef, gachaId: string): boolean {
  if (isHidden(def)) return false
  return CONFIG.gacha.rarities[rarityOf(def)].everyGacha || gachasOf(def).includes(gachaId)
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
  const members = defs.filter((d) => inGacha(d, gachaId))
  const count = (r: RarityKey) => members.filter((d) => rarityOf(d) === r).length
  const present = RARITY_KEYS.filter((r) => count(r) > 0)
  const total = present.reduce((sum, r) => sum + CONFIG.gacha.rarities[r].rate, 0)
  return RARITY_KEYS.flatMap((r) =>
    members
      .filter((d) => rarityOf(d) === r)
      .map((def) => ({ def, rarity: r, rate: CONFIG.gacha.rarities[r].rate / total / count(r) })),
  )
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

/** 天井：この回で確定するか（pulls はこれまでに激レアが出ずに引いた回数） */
export function isPity(pulls: number, table: Rate[]): boolean {
  return pulls + 1 >= CONFIG.gacha.pity.pulls && table.some((t) => t.rarity === CONFIG.gacha.pity.rarity)
}

/** 1回引く。天井なら確定のレア度の中から（同じ確率で）選ぶ */
export function draw(table: Rate[], pulls: number, random: number): MonsterDef | null {
  if (!isPity(pulls, table)) return pickFrom(table, random)
  const pool = table.filter((t) => t.rarity === CONFIG.gacha.pity.rarity)
  return pickFrom(
    pool.map((t) => ({ ...t, rate: 1 / pool.length })),
    random,
  )
}

/** 確率の表示（例：12.5%） */
export function percent(rate: number): string {
  const p = rate * 100
  return `${p >= 10 ? p.toFixed(1).replace(/\.0$/, '') : p.toFixed(2).replace(/\.?0+$/, '')}%`
}

/** その形態の星の数。生まれたときはレア度で決まり、進化するたびに1つ増える */
export function starsOf(def: MonsterDef, nodeId: string): number {
  const template = getTemplate(def.templateId)
  const stage = getNode(template, nodeId).stage
  if (isHidden(def)) {
    // 隠しモンスターは最終形態で★7になるように数える
    const finalStage = Math.max(...template.nodes.map((n) => n.stage))
    return CONFIG.gacha.jogressStars - (finalStage - stage)
  }
  return CONFIG.gacha.rarities[rarityOf(def)].startStars + stage - 1
}
