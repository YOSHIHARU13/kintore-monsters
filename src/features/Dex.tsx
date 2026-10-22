import { useStore } from '../store'
import { FORM_ATTR_LABEL } from '../data/exercises'
import { getTemplate, pathTo } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { Stars } from '../components/Stars'
import { isJogressReady, jogressNeed } from '../lib/stats'
import { MonsterTabs } from '../components/MonsterTabs'
import { ATTR_COLOR, type Go } from '../nav'
import { isHidden, monsterName, nodeAttr, type MonsterDef } from '../types'
import { starsOf } from '../lib/gacha'

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
  // レシピの1体ぶんの進み具合：持っている中でいちばん育っている個体
  const progressOf = (defId: string, hidden: MonsterDef) => {
    const parent = defs.find((d) => d.id === defId)
    if (!parent) return { name: '？？？', text: '登録が見つかりません', ready: false }
    const mons = owned.filter((o) => o.defId === defId)
    if (mons.some((m) => isJogressReady(m, parent, hidden))) return { name: parent.name, text: '条件クリア ✓', ready: true }
    // いちばん育っている個体（星が多い順、同じなら＋が多い順）
    const best = mons
      .map((m) => ({ stars: starsOf(parent, m.nodeId), plus: m.plus ?? 0 }))
      .sort((a, b) => b.stars - a.stars || b.plus - a.plus)[0]
    const text = best ? `いちばん育っているのは★${best.stars}${best.plus > 0 ? `＋${best.plus}` : ''}` : '未所持'
    return { name: parent.name, text, ready: false }
  }
  const foundCount = entries.reduce((sum, e) => sum + e.found.size, 0)
  const formCount = entries.reduce((sum, e) => sum + e.template.nodes.length, 0)

  return (
    <div className="page">
      <MonsterTabs on="dex" go={go} />
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
          {isHidden(def) && (
            <div className="recipe">
              <strong className="small">
                {found.size === 0 ? '🔒 ' : ''}ジョグレスのレシピ（★{jogressNeed(def).stars + 1}で誕生・どちらも★
                {jogressNeed(def).stars}以上{jogressNeed(def).plus > 0 ? `・＋${jogressNeed(def).plus}以上` : ''}）
              </strong>
              <ul className="mini-list">
                {def.recipe!.map((parentId, i) => {
                  const p = progressOf(parentId, def)
                  return (
                    <li key={i}>
                      <span>{p.name}</span>
                      <span className={`tag${p.ready ? ' keep' : ''}`}>{p.text}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
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
                  <Stars def={def} nodeId={node.id} />
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
