import { rarityOf, starsOf } from '../lib/gacha'
import { isHidden, type MonsterDef } from '../types'

/** 星の数（★★★）。色はレア度（ジョグレスは虹色） */
export function Stars({ def, nodeId }: { def: MonsterDef; nodeId: string }) {
  const count = starsOf(def, nodeId)
  return (
    <span className={`stars rarity-${isHidden(def) ? 'jogress' : rarityOf(def)}`} aria-label={`星${count}`}>
      {'★'.repeat(count)}
    </span>
  )
}
