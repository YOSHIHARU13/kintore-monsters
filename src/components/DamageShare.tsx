import { useStore } from '../store'
import { monArt } from '../lib/art'
import { MonsterImage } from './MonsterImage'
import { plusName } from '../types'

/** 出撃した子ごとのダメージの割合（多い順）。いちばんの子に👑MVP */
export function DamageShare({ byMember, mvpId }: { byMember: Record<string, number>; mvpId?: string | null }) {
  const { owned, defs } = useStore()
  const total = Object.values(byMember).reduce((sum, d) => sum + d, 0)
  if (total <= 0) return null
  const rows = Object.entries(byMember)
    .sort((a, b) => b[1] - a[1])
    .flatMap(([id, d]) => {
      const mon = owned.find((o) => o.id === id)
      const def = mon && defs.find((x) => x.id === mon.defId)
      return mon && def ? [{ id, d, mon, def }] : []
    })
  return (
    <ul className="damage-share">
      {rows.map(({ id, d, mon, def }) => {
        const pct = Math.round((d / total) * 100)
        return (
          <li key={id} className={id === mvpId ? 'mvp' : undefined}>
            <MonsterImage {...monArt(def, mon)} size={id === mvpId ? 44 : 32} />
            <span className="share-body">
              <span className="small">
                {id === mvpId && <strong className="mvp-mark">👑MVP </strong>}
                {plusName(def, mon)} {Math.round(d).toLocaleString()}（{pct}%）
              </span>
              <span className="share-bar">
                <i style={{ width: `${pct}%` }} />
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
