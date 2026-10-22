import { useStore } from '../store'
import { FORM_ATTR_LABEL } from '../data/exercises'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { CONFIG } from '../config/gameConfig'
import { Stars } from '../components/Stars'
import { Abilities } from '../components/Abilities'
import { ElementBadge } from '../components/ElementBadge'
import { MonsterTabs } from '../components/MonsterTabs'
import { ATTR_COLOR, type Go } from '../nav'
import { nodeAttr, plusName, type MonsterDef, type OwnedMonster } from '../types'

export function Box({ go }: { go: Go }) {
  const { owned, defs, state } = useStore()
  const partnerSlots = new Set(Object.values(state.partners))
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
      <MonsterTabs on="box" go={go} />
      <p className="muted small">
        所持 {list.length}体。同じモンスターを何体でも持てるので、別の進化先にも育てられます。ダブったら合体させて＋を上げることもできます（最大＋{CONFIG.fusion.maxPlus}）。
      </p>
      {owned.length === 0 && (
        <p className="muted">
          まだモンスターがいません。図鑑でモンスターを登録して、ショップでタマゴを孵しましょう。
        </p>
      )}
      <div className="grid">
        {list.map(({ mon, def }) => {
          return (
            <button key={mon.id} className="tile" onClick={() => go({ name: 'monster', id: mon.id })}>
              <MonsterImage imageId={def.images[mon.nodeId]} size={96} plus={mon.plus} shiny={mon.shiny} />
              <strong>{plusName(def, mon)}</strong>
              <Stars def={def} nodeId={mon.nodeId} />
              <Abilities def={def} />
              <ElementBadge def={def} />
              <span className="small" style={{ color: ATTR_COLOR[nodeAttr(def, mon.nodeId)] }}>
                {FORM_ATTR_LABEL[nodeAttr(def, mon.nodeId)]}属性
              </span>
              {partnerSlots.has(mon.id) && <span className="badge">相棒</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
