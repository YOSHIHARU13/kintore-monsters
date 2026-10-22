import { useStore } from '../store'
import { FORM_ATTR_LABEL } from '../data/exercises'
import { getTemplate, pathTo } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { isHidden, monsterName, nodeAttr, type MonsterDef } from '../types'
import { CONFIG } from '../config/gameConfig'

/** 全体図鑑。一度でもその姿になった形態が埋まっていく */
export function Dex({ go }: { go: Go }) {
  const { defs, owned, state } = useStore()

  const entries = defs.map((def) => {
    const template = getTemplate(def.templateId)
    const mons = owned.filter((o) => o.defId === def.id)
    // 進化は一方通行なので、持っている1体ずつの「今の姿までの道のり」を合わせたものが発見済み
    // 合体・ジョグレスでいなくなった個体が見つけていた形態も残す
    const found = new Set([...mons.flatMap((mon) => pathTo(template, mon.nodeId)), ...(state.dexFound[def.id] ?? [])])
    const shiny = state.dexShiny[def.id] === true || mons.some((m) => m.shiny)
    return { def, template, found, count: mons.length, shiny }
  })
  // 隠しモンスターのヒント：レシピの片方だけを見せる
  const hintOf = (def: MonsterDef) => {
    const parent = defs.find((d) => d.id === def.recipe?.[0])
    return `${parent?.name ?? '？？？'}＋？？？`
  }
  const foundCount = entries.reduce((sum, e) => sum + e.found.size, 0)
  const formCount = entries.reduce((sum, e) => sum + e.template.nodes.length, 0)

  return (
    <div className="page">
      <h1 className="title">図鑑</h1>
      <p className="muted">
        発見 {foundCount}／全 {formCount} 形態
      </p>
      <p className="muted small">
        分岐する進化先は、同じモンスターをもう1体タマゴから孵して、別の道に育てると埋まります。
      </p>
      <button className="btn wide" onClick={() => go({ name: 'registry' })}>
        モンスターを登録・編集する
      </button>
      {defs.length === 0 && <p className="muted">まだモンスターが登録されていません。</p>}

      {entries.map(({ def, template, found, count, shiny }, index) => (
        <section className="card" key={def.id}>
          <h2>
            <span className="muted small">No.{String(index + 1).padStart(3, '0')}</span>{' '}
            {found.size > 0 ? def.name : '？？？'}
            {shiny && ' ✨'}
            <span className="muted small">
              {' '}
              {found.size}/{template.nodes.length}形態・所持{count}体
            </span>
          </h2>
          {isHidden(def) && found.size === 0 && (
            <p className="muted small">
              🔒 隠しモンスター。ヒント：{hintOf(def)}の＋{CONFIG.fusion.maxPlus}どうしをジョグレス
            </p>
          )}
          <div className="dex-forms">
            {template.nodes.map((node) => {
              const isFound = found.has(node.id)
              const attr = nodeAttr(def, node.id)
              return (
                <div key={node.id} className={`dex-form${isFound ? '' : ' unknown'}`}>
                  <MonsterImage
                    imageId={def.images[node.id]}
                    silhouette={!isFound}
                    shiny={isFound && shiny}
                    size={72}
                  />
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
