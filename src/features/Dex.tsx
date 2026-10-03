import { useStore } from '../store'
import { ATTR_LABEL } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName, nodeAttr } from '../types'

export function Dex({ go }: { go: Go }) {
  const { defs, owned } = useStore()
  const ownedCount = defs.filter((d) => owned.some((o) => o.id === d.id)).length

  return (
    <div className="page">
      <h1 className="title">図鑑</h1>
      <p className="muted">
        入手 {ownedCount}／登録 {defs.length}
      </p>
      <button className="btn primary wide" onClick={() => go({ name: 'monsterForm' })}>
        ＋ モンスターを登録する
      </button>

      <div className="grid">
        {defs.map((def, index) => {
          const mon = owned.find((o) => o.id === def.id)
          const attr = nodeAttr(def, mon?.nodeId ?? FIRST_NODE_ID)
          return (
            <div key={def.id} className="tile">
              <span className="muted small">No.{String(index + 1).padStart(3, '0')}</span>
              <MonsterImage imageId={def.images[mon?.nodeId ?? FIRST_NODE_ID]} silhouette={!mon} size={96} />
              <strong>{monsterName(def, mon?.nodeId ?? FIRST_NODE_ID)}</strong>
              <span className="small" style={{ color: ATTR_COLOR[attr] }}>
                {ATTR_LABEL[attr]}・{mon ? '入手済み' : '未入手'}
              </span>
              <button className="btn small" onClick={() => go({ name: 'monsterForm', id: def.id })}>
                編集
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
