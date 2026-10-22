import { getNode, getTemplate } from '../data/evolutionTemplates'
import { evolutionCost, fusionCost } from './evolution'
import { investedFor, type MonsterDef, type OwnedMonster } from '../types'

export interface NearGoal {
  mon: OwnedMonster
  def: MonsterDef
  kind: 'evolve' | 'plus'
  have: number
  need: number
}

/** 進化や次の＋に近い順（注いだEXPの割合が高い順） */
export function nearGoals(owned: OwnedMonster[], defs: MonsterDef[], limit: number): NearGoal[] {
  const goals = owned.flatMap((mon): NearGoal[] => {
    const def = defs.find((d) => d.id === mon.defId)
    if (!def) return []
    const node = getNode(getTemplate(def.templateId), mon.nodeId)
    if (node.next.length > 0) {
      const cost = evolutionCost(node.stage)
      if (!cost) return []
      // 分岐があるときは、いちばん注いでいる進化先で数える
      const have = Math.max(
        ...node.next.map((n) => {
          const inv = investedFor(mon, n, node.next[0])
          return inv.trained + inv.bought
        }),
      )
      return [{ mon, def, kind: 'evolve', have, need: cost.exp }]
    }
    const cost = fusionCost(mon.plus ?? 0)
    if (!cost) return []
    return [{ mon, def, kind: 'plus', have: (mon.plusExp?.trained ?? 0) + (mon.plusExp?.bought ?? 0), need: cost.exp }]
  })
  return goals.sort((a, b) => b.have / b.need - a.have / a.need || a.need - b.need).slice(0, limit)
}
