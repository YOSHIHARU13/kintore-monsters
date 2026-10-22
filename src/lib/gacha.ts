import { CONFIG } from '../config/gameConfig'
import { isHidden, type Gacha, type MonsterDef, type RarityKey } from '../types'

/** そのモンスターが入っているガチャ。どこにも入れていなければ「いつものガチャ」（ハズレ枠は全部のガチャ） */
export function gachasOf(def: MonsterDef): string[] {
  return def.gachas?.length ? def.gachas : [CONFIG.gacha.defaultId]
}

/** そのガチャから出るか */
export function inGacha(def: MonsterDef, gachaId: string): boolean {
  return !isHidden(def) && (def.common === true || gachasOf(def).includes(gachaId))
}

export function rarityOf(gacha: Gacha, defId: string): RarityKey {
  return gacha.rarity[defId] ?? 'normal'
}

export interface Rate {
  def: MonsterDef
  rarity: RarityKey
  rate: number // 0〜1
}

/** ガチャの中身と、1体ずつの出る確率（レア度の重みで割り振る） */
export function rateTable(gacha: Gacha, defs: MonsterDef[]): Rate[] {
  const members = defs.filter((d) => inGacha(d, gacha.id))
  const weight = (d: MonsterDef) => CONFIG.gacha.rarities[rarityOf(gacha, d.id)].weight
  const total = members.reduce((sum, d) => sum + weight(d), 0)
  return members.map((def) => ({ def, rarity: rarityOf(gacha, def.id), rate: total > 0 ? weight(def) / total : 0 }))
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

/** 確率の表示（例：12.5%） */
export function percent(rate: number): string {
  const p = rate * 100
  return `${p >= 10 ? p.toFixed(1).replace(/\.0$/, '') : p.toFixed(2).replace(/\.?0+$/, '')}%`
}
