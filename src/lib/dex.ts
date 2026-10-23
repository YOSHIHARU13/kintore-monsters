import { ELEMENTS, elementInfo } from './element'
import { bossGradeOf, rarityOf } from './gacha'
import { seriesOf } from './series'
import { isHidden, type MonsterDef } from '../types'

/**
 * 図鑑の並び：同じグループの子がかたまるように。
 * ガチャの子（ノーマル → レア → 激レア → ジョグレス）→ 降臨（上級 → … → 爆絶 → 城主）→ コラボごと（ガチャの子 → 降臨）。
 * グループの中は属性の順（炎・水・木・光・闇・零）、同じなら登録順
 */
export function dexGroupOf(def: MonsterDef): { key: string; label: string; rank: number } {
  const series = seriesOf(def)
  const grade = bossGradeOf(def)
  const sub = isHidden(def)
    ? { key: 'jogress', label: 'ジョグレス', rank: 3 }
    : def.questOnly
      ? def.castleLord
        ? { key: 'lord', label: '降臨・城主', rank: 20 }
        : { key: `boss-${grade}`, label: `降臨・${GRADE_LABEL[grade ?? 'kyukyoku']}`, rank: 10 + GRADES.indexOf(grade ?? 'kyukyoku') }
      : { key: rarityOf(def), label: TIER_LABEL[rarityOf(def)], rank: ['normal', 'rare', 'superRare'].indexOf(rarityOf(def)) }
  if (!series) return sub
  return { key: `${series}/${sub.key}`, label: `${series}・${sub.label}`, rank: 100 + sub.rank }
}

/** 降臨の格の順（quest.ts の GRADES と同じ。読み込みの輪にならないよう、ここにも持つ） */
const GRADES = ['jokyu', 'kiwami', 'kyukyoku', 'chozetsu', 'bakuzetsu', 'chokyukyoku'] as const

const TIER_LABEL = { normal: 'ノーマル', rare: 'レア', superRare: '激レア' } as const
const GRADE_LABEL = { jokyu: '上級', kiwami: '極', kyukyoku: '究極', chozetsu: '超絶', chokyukyoku: '超究極', bakuzetsu: '爆絶' } as const

export function dexOrder(defs: MonsterDef[]): MonsterDef[] {
  const seriesList = [...new Set(defs.map(seriesOf).filter((s) => s !== ''))]
  const elementRank = (d: MonsterDef) => {
    const e = elementInfo(d).elements[0]
    return e ? ELEMENTS.indexOf(e) : ELEMENTS.length
  }
  const key = (d: MonsterDef) => {
    const g = dexGroupOf(d)
    const s = seriesOf(d)
    return [s ? seriesList.indexOf(s) : -1, g.rank, elementRank(d), d.createdAt]
  }
  return [...defs].sort((a, b) => {
    const x = key(a)
    const y = key(b)
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]
    return 0
  })
}
