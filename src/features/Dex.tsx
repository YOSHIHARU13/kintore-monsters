import { useStore } from '../store'
import { FORM_ATTR_LABEL } from '../data/exercises'
import { getTemplate, pathTo } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName, nodeAttr } from '../types'

/** 全体図鑑。一度でもその姿になった形態が埋まっていく */
export function Dex({ go }: { go: Go }) {
  const { defs, owned } = useStore()

  const entries = defs.map((def) => {
    const template = getTemplate(def.templateId)
    const mon = owned.find((o) => o.id === def.id)
    // 進化は一方通行なので、今の姿までの道のりがそのまま「なったことのある姿」
    const found = new Set(mon ? pathTo(template, mon.nodeId) : [])
    return { def, template, found }
  })
  const foundCount = entries.reduce((sum, e) => sum + e.found.size, 0)
  const formCount = entries.reduce((sum, e) => sum + e.template.nodes.length, 0)

  return (
    <div className="page">
      <h1 className="title">図鑑</h1>
      <p className="muted">
        発見 {foundCount}／全 {formCount} 形態
      </p>
      <button className="btn wide" onClick={() => go({ name: 'registry' })}>
        モンスターを登録・編集する
      </button>
      {defs.length === 0 && <p className="muted">まだモンスターが登録されていません。</p>}

      {entries.map(({ def, template, found }, index) => (
        <section className="card" key={def.id}>
          <h2>
            <span className="muted small">No.{String(index + 1).padStart(3, '0')}</span>{' '}
            {found.size > 0 ? def.name : '？？？'}
            <span className="muted small">
              {' '}
              {found.size}/{template.nodes.length}
            </span>
          </h2>
          <div className="dex-forms">
            {template.nodes.map((node) => {
              const isFound = found.has(node.id)
              const attr = nodeAttr(def, node.id)
              return (
                <div key={node.id} className={`dex-form${isFound ? '' : ' unknown'}`}>
                  <MonsterImage imageId={def.images[node.id]} silhouette={!isFound} size={72} />
                  <strong className="small">{isFound ? monsterName(def, node.id) : '？？？'}</strong>
                  <span className="small" style={{ color: isFound ? ATTR_COLOR[attr] : undefined }}>
                    {isFound ? `${FORM_ATTR_LABEL[attr]}・` : ''}
                    {node.stage}段階
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
