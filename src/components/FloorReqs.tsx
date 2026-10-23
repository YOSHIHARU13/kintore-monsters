import { useStore } from '../store'
import { allGimmicks } from '../lib/gimmick'
import { requirementsOf, tagLabel } from '../lib/formation'
import type { Quest } from '../types'

/** 塔・孤城の階の条件（ギミック）を短く。どの階も最初から公開する */
export function FloorReqs({ quest }: { quest: Quest }) {
  const { quests } = useStore()
  const names = allGimmicks(quests)
  const reqs = requirementsOf(quest)
  if (reqs.length === 0) return <span className="small muted">条件なし</span>
  return <span className="small floor-reqs">求む：{reqs.map((r) => `${tagLabel(r.tag, names)}${r.count}`).join(' ')}</span>
}
