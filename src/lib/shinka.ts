import { getNode, getTemplate } from '../data/evolutionTemplates'
import { elementInfo } from './element'
import { rarityOf } from './gacha'
import { seriesOf } from './series'
import { isHidden, type MonsterDef, type OwnedMonster } from '../types'

/** 神化できる：ガチャの激レアの最終形態で、まだ神化していない */
export function canShinka(mon: OwnedMonster, def: MonsterDef): boolean {
  if (mon.shinka || isHidden(def) || def.questOnly || rarityOf(def) !== 'superRare') return false
  return getNode(getTemplate(def.templateId), mon.nodeId).next.length === 0
}

/**
 * 神化の素材になれる降臨モンスター。
 * コラボの激レアは、同じコラボの降臨（属性は問わない）。それ以外は同じ属性を持つ降臨（無属性の激レアなら、どの降臨でも）
 */
export function shinkaFoods(
  def: MonsterDef,
  owned: OwnedMonster[],
  defs: MonsterDef[],
  keep: Set<string>,
): { mon: OwnedMonster; def: MonsterDef }[] {
  const els = elementInfo(def).elements
  const series = seriesOf(def)
  return owned.flatMap((mon) => {
    const d = defs.find((x) => x.id === mon.defId)
    if (!d || !d.questOnly || keep.has(mon.id)) return []
    if (series) return seriesOf(d) === series ? [{ mon, def: d }] : []
    const fe = elementInfo(d).elements
    return els.length === 0 || fe.some((e) => els.includes(e)) ? [{ mon, def: d }] : []
  })
}
