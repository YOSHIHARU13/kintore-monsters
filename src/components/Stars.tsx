import { starsOf } from '../lib/gacha'
import { shinkaTierOf } from '../lib/shinka'
import type { MonsterDef, OwnedMonster } from '../types'

const TIER_MARK = { gold: '🥇', silver: '🥈', bronze: '🥉' } as const

/** 星の数（★★★）。進化形態を表す。持っている1体なら、獣神化の分も足して、金・銀・銅のバッジを付ける */
export function Stars({ def, nodeId, mon }: { def: MonsterDef; nodeId: string; mon?: Pick<OwnedMonster, 'shinka' | 'shinkaGold'> }) {
  const count = starsOf(def, nodeId) + (mon?.shinka ? 1 : 0)
  const tier = mon ? shinkaTierOf(mon, def) : null
  return (
    <span className={`stars${tier ? ` shinka-${tier}` : ''}`} aria-label={`星${count}`}>
      {'★'.repeat(count)}
      {tier && <span className="shinka-mark">{TIER_MARK[tier]}</span>}
    </span>
  )
}
