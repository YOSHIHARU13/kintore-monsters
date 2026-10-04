import { useStore } from '../store'
import { FORM_ATTR_LABEL } from '../data/exercises'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName, nodeAttr, type MonsterDef, type OwnedMonster } from '../types'

export function Box({ go }: { go: Go }) {
  const { owned, defs, state } = useStore()
  // 図鑑の順に並べ、同じモンスターは進化が進んでいる順
  const stageOf = (mon: OwnedMonster, def: MonsterDef) => getNode(getTemplate(def.templateId), mon.nodeId).stage
  const list = owned
    .flatMap((mon) => {
      const index = defs.findIndex((d) => d.id === mon.defId)
      return index < 0 ? [] : [{ mon, def: defs[index], index }]
    })
    .sort((a, b) => a.index - b.index || stageOf(b.mon, b.def) - stageOf(a.mon, a.def) || a.mon.obtainedAt - b.mon.obtainedAt)

  return (
    <div className="page">
      <h1 className="title">BOX</h1>
      <p className="muted small">
        所持 {list.length}体。同じモンスターを何体でも持てるので、別の進化先にも育てられます。
      </p>
      {owned.length === 0 && (
        <p className="muted">
          まだモンスターがいません。図鑑でモンスターを登録して、ショップでタマゴを孵しましょう。
        </p>
      )}
      <div className="grid">
        {list.map(({ mon, def }) => {
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
