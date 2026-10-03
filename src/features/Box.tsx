import { useStore } from '../store'
import { FORM_ATTR_LABEL } from '../data/exercises'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName, nodeAttr } from '../types'

export function Box({ go }: { go: Go }) {
  const { owned, defs, state } = useStore()

  return (
    <div className="page">
      <h1 className="title">BOX</h1>
      {owned.length === 0 && (
        <p className="muted">
          まだモンスターがいません。図鑑でモンスターを登録して、ショップでタマゴを孵しましょう。
        </p>
      )}
      <div className="grid">
        {owned.map((mon) => {
          const def = defs.find((d) => d.id === mon.id)
          if (!def) return null
          const node = getNode(getTemplate(def.templateId), mon.nodeId)
          return (
            <button key={mon.id} className="tile" onClick={() => go({ name: 'monster', id: mon.id })}>
              <MonsterImage imageId={def.images[mon.nodeId]} size={96} />
              <strong>{monsterName(def, mon.nodeId)}</strong>
              <span className="small" style={{ color: ATTR_COLOR[nodeAttr(def, mon.nodeId)] }}>
                {FORM_ATTR_LABEL[nodeAttr(def, mon.nodeId)]}・{node.stage}段階
              </span>
              {state.activeMonsterId === mon.id && <span className="badge">育成中</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
