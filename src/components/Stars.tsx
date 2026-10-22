import { starsOf } from '../lib/gacha'
import type { MonsterDef } from '../types'

/** 星の数（★★★）。進化形態を表す */
export function Stars({ def, nodeId }: { def: MonsterDef; nodeId: string }) {
  const count = starsOf(def, nodeId)
  return (
    <span className="stars" aria-label={`星${count}`}>
      {'★'.repeat(count)}
    </span>
  )
}
