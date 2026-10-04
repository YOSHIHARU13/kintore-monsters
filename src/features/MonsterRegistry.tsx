import { useStore } from '../store'
import { FORM_ATTR_LABEL } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName, nodeAttr } from '../types'

export function MonsterRegistry({ go }: { go: Go }) {
  const { defs, owned } = useStore()
  const ownedCount = defs.filter((d) => owned.some((o) => o.defId === d.id)).length

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'dex' })}>
        ← 図鑑に戻る
      </button>
      <h1 className="title">モンスターの登録・編集</h1>
      <p className="muted">
        入手 {ownedCount}／登録 {defs.length}
      </p>
      <button className="btn primary wide" onClick={() => go({ name: 'monsterForm' })}>
        ＋ モンスターを登録する
      </button>

      <div className="grid">
        {defs.map((def, index) => {
          const has = owned.some((o) => o.defId === def.id)
          const attr = nodeAttr(def, FIRST_NODE_ID)
          return (
            <div key={def.id} className="tile">
              <span className="muted small">No.{String(index + 1).padStart(3, '0')}</span>
              <MonsterImage imageId={def.images[FIRST_NODE_ID]} silhouette={!has} size={96} />
              <strong>{monsterName(def, FIRST_NODE_ID)}</strong>
              <span className="small" style={{ color: ATTR_COLOR[attr] }}>
                {FORM_ATTR_LABEL[attr]}・{has ? '入手済み' : '未入手'}
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
