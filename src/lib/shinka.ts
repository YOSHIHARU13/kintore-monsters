import { CONFIG } from '../config/gameConfig'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { elementInfo } from './element'
import { bossGradeOf, rarityOf } from './gacha'
import { seriesOf } from './series'
import { isHidden, type MonsterDef, type OwnedMonster } from '../types'

/**
 * 獣神化（★4）。名前は1つで、格はバッジの色で見分ける：
 * 金＝激レア2体の合体（相手の激レアも素材にする）、銀＝専用の絵がある、銅＝絵はそのまま（後光だけ）。
 * 爆絶の降臨も獣神化（銅）できるが、降臨なので少し弱い
 */
export type ShinkaTier = 'gold' | 'silver' | 'bronze'

export const SHINKA_LABEL: Record<ShinkaTier, string> = { gold: '🥇 金の獣神化', silver: '🥈 銀の獣神化', bronze: '🥉 獣神化' }

/** 獣神化の絵（銀は images.shinka、金は images.gold） */
export const SHINKA_IMAGE = 'shinka'
export const GOLD_IMAGE = 'gold'

/** その個体の獣神化の格（していなければ null）。以前のジョグレスで生まれた子は金 */
export function shinkaTierOf(mon: Pick<OwnedMonster, 'shinka' | 'shinkaGold'>, def: MonsterDef): ShinkaTier | null {
  if (isHidden(def)) return 'gold'
  if (!mon.shinka) return null
  if (mon.shinkaGold) return 'gold'
  return def.images[SHINKA_IMAGE] ? 'silver' : 'bronze'
}

/** 獣神化できるモンスターか：ガチャの激レアか、爆絶の降臨 */
export function canShinkaDef(def: MonsterDef): boolean {
  if (isHidden(def)) return false
  if (def.questOnly) return bossGradeOf(def) === 'bakuzetsu'
  return rarityOf(def) === 'superRare'
}

/** 今の個体が獣神化できる状態か：最終形態で、まだ獣神化していない */
export function canShinka(mon: OwnedMonster, def: MonsterDef): boolean {
  if (mon.shinka || !canShinkaDef(def)) return false
  return getNode(getTemplate(def.templateId), mon.nodeId).next.length === 0
}

/** 獣神化した子の攻撃力の上乗せ（★が1つ増えるぶんとは別） */
export function shinkaAttack(mon: Pick<OwnedMonster, 'shinka' | 'shinkaGold'>, def: MonsterDef): number {
  const tier = shinkaTierOf(mon, def)
  if (!tier || isHidden(def)) return 0
  return def.questOnly ? CONFIG.shinka.questBonus : CONFIG.shinka.bonus[tier]
}

/** レシピの1行：このモンスターを count 体、それぞれ運 luck 以上（運は合わせて count × luck ぶん使う） */
export interface RecipeItem {
  defId: string
  count: number
  luck: number
}

/** 文字列から決まる乱数（同じモンスターなら、いつも同じレシピに） */
function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/**
 * 獣神化のレシピ（モンストのアヴァロン型：超絶「イザナミ」×3体・運12以上 など）。モンスターごとに決まっていて変わらない。
 * - 爆絶の降臨：同じ属性の超絶の降臨から
 * - コラボの激レア：同じコラボの降臨から
 * - ふつうの激レア：図鑑の並びが近い、超絶以上の降臨から
 * 種類は2つ（たまに1つか3つ）、体数は1〜5体、運は1〜5（の4倍。ボスは運4で落ちるので）
 */
export function shinkaRecipe(def: MonsterDef, defs: MonsterDef[]): RecipeItem[] {
  const r = seeded(`shinka:${def.id}`)
  const farmable = defs.filter((d) => d.questOnly && d.id !== def.id && !d.tower && !d.castleLord && !isHidden(d))
  const strong = (d: MonsterDef) => ['chozetsu', 'chokyukyoku', 'bakuzetsu'].includes(bossGradeOf(d) ?? '')
  const series = seriesOf(def)
  const els = elementInfo(def).elements
  let pool: MonsterDef[]
  if (def.questOnly) {
    const chozetsu = farmable.filter((d) => bossGradeOf(d) === 'chozetsu' && seriesOf(d) === '')
    const same = chozetsu.filter((d) => elementInfo(d).elements.some((e) => els.includes(e)))
    pool = same.length > 0 ? same : chozetsu
  } else if (series) {
    pool = farmable.filter((d) => seriesOf(d) === series)
  } else {
    const at = defs.indexOf(def)
    pool = farmable
      .filter((d) => strong(d) && seriesOf(d) === '')
      .sort((a, b) => Math.abs(defs.indexOf(a) - at) - Math.abs(defs.indexOf(b) - at))
      .slice(0, 6)
  }
  if (pool.length === 0) pool = farmable.filter(strong)
  if (pool.length === 0) return []
  const roll = r()
  const kinds = Math.min(pool.length, roll < 0.15 ? 1 : roll < 0.85 ? 2 : 3)
  // 決まった順で混ぜて、先頭から選ぶ
  const shuffled = pool.map((d) => ({ d, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.d)
  return shuffled.slice(0, kinds).map((d) => ({
    defId: d.id,
    count: 1 + Math.floor(r() * 5),
    luck: (1 + Math.floor(r() * 5)) * CONFIG.shinka.luckScale,
  }))
}

/** 素材の子の運の使い方：運の低い子から使い切り、最後の子は要るぶんだけ減らして残す（足りなければ null） */
export function planLuckUse(
  need: number,
  mons: Pick<OwnedMonster, 'id' | 'luck'>[],
): { remove: string[]; keep: { id: string; luck: number } | null } | null {
  const total = mons.reduce((sum, m) => sum + (m.luck ?? 1), 0)
  if (total < need) return null
  const sorted = [...mons].sort((a, b) => (a.luck ?? 1) - (b.luck ?? 1))
  const remove: string[] = []
  let left = need
  for (const m of sorted) {
    if (left <= 0) break
    const luck = m.luck ?? 1
    if (luck <= left) {
      remove.push(m.id)
      left -= luck
    } else {
      return { remove, keep: { id: m.id, luck: luck - left } }
    }
  }
  return { remove, keep: null }
}

/** レシピの1行の、持っている運の合計（keep の子は数えない） */
export function recipeHave(item: RecipeItem, owned: OwnedMonster[], keep: Set<string>): number {
  return owned.filter((o) => o.defId === item.defId && !keep.has(o.id)).reduce((sum, o) => sum + (o.luck ?? 1), 0)
}
