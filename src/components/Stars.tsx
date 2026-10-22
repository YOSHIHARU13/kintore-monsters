import { starsOf } from '../lib/gacha'
import type { MonsterDef, OwnedMonster } from '../types'

/** 星の数（★★★）。進化形態を表す。持っている1体なら、神化の分も足す */
export function Stars({ def, nodeId, mon }: { def: MonsterDef; nodeId: string; mon?: Pick<OwnedMonster, 'shinka'> }) {
  const count = starsOf(def, nodeId) + (mon?.shinka ? 1 : 0)
  return (
    <span className="stars" aria-label={`星${count}`}>
      {'★'.repeat(count)}
    </span>
  )
}
