import { useState } from 'react'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { useStore } from '../store'
import { SeriesChips } from '../components/SeriesChips'
import { inSeries, seriesOf, type SeriesFilter } from '../lib/series'
import { CONFIG } from '../config/gameConfig'
import { FORM_ATTR_LABEL } from '../data/exercises'
import { getTemplate, pathTo, type EvoNode } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { Stars } from '../components/Stars'
import { ElementBadge } from '../components/ElementBadge'
import { Abilities } from '../components/Abilities'
import { isJogressReady, jogressNeed } from '../lib/stats'
import { MonsterTabs } from '../components/MonsterTabs'
import { ATTR_COLOR, type Go } from '../nav'
import { isHidden, monsterName, nodeAttr, type MonsterDef } from '../types'
import { rarityOf, starsOf } from '../lib/gacha'
import { ELEMENT_COLOR, elementInfo } from '../lib/element'

type Filter = 'all' | 'found' | 'missing'

interface Entry {
  no: number // 図鑑番号（形態ごと）
  def: MonsterDef
  node: EvoNode
  found: boolean
  shiny: boolean
  count: number // そのモンスターの所持数
}

/** 全体図鑑。モンストのように、形態ごとに番号つきのアイコンが並ぶ。タップで詳しく */
export function Dex({ go }: { go: Go }) {
  const { defs, owned, state } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<Entry | null>(null)
  const [series, setSeries] = useState<SeriesFilter>('all')

  let no = 0
  const entries: Entry[] = defs.flatMap((def) => {
    const template = getTemplate(def.templateId)
    const mons = owned.filter((o) => o.defId === def.id)
    // 持っている1体ずつの「今の姿までの道のり」と、合体・ジョグレスでいなくなった個体が見つけていた形態
    const found = new Set([...mons.flatMap((mon) => pathTo(template, mon.nodeId)), ...(state.dexFound[def.id] ?? [])])
    const shiny = state.dexShiny[def.id] === true || mons.some((m) => m.shiny)
    return template.nodes.map((node) => ({ no: ++no, def, node, found: found.has(node.id), shiny, count: mons.length }))
  })
  const foundCount = entries.filter((e) => e.found).length
  const list = entries
    .filter((e) => (filter === 'found' ? e.found : filter === 'missing' ? !e.found : true))
    .filter((e) => inSeries(series, seriesOf(e.def)))

  // レシピの1体ぶんの進み具合
  const progressOf = (defId: string, hidden: MonsterDef) => {
    const parent = defs.find((d) => d.id === defId)
    if (!parent) return { name: '？？？', text: '登録が見つかりません', ready: false }
    const mons = owned.filter((o) => o.defId === defId)
    if (mons.some((m) => isJogressReady(m, parent, hidden))) return { name: parent.name, text: '条件クリア ✓', ready: true }
    const best = mons.map((m) => starsOf(parent, m.nodeId)).sort((a, b) => b - a)[0]
    const text = best ? `いちばん育っているのは★${best}` : '未所持'
    return { name: parent.name, text, ready: false }
  }

  return (
    <div className="page">
      <MonsterTabs on="dex" go={go} />
      <div className="dex-head">
        <strong>
          発見 {foundCount}／{entries.length}
        </strong>
        <span className="dex-rate">{entries.length ? Math.floor((foundCount / entries.length) * 100) : 0}%</span>
      </div>
      <div className="chips" role="group" aria-label="図鑑の絞り込み">
        {(
          [
            ['all', '全部'],
            ['found', '発見済み'],
            ['missing', '未発見'],
          ] as const
        ).map(([f, label]) => (
          <button key={f} type="button" className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>
      <SeriesChips value={series} onChange={setSeries} />
      {defs.length === 0 && <p className="muted">まだモンスターが登録されていません。</p>}

      <div className="dex-grid">
        {list.map((e) => {
          const el = elementInfo(e.def).elements[0]
          return (
            <button
              key={`${e.def.id}-${e.node.id}`}
              className={`dex-cell${e.found ? '' : ' unknown'}`}
              style={e.found && el ? { borderColor: ELEMENT_COLOR[el] } : undefined}
              onClick={() => setOpen(e)}
              aria-label={`No.${e.no} ${e.found ? monsterName(e.def, e.node.id) : '未発見'}`}
            >
              <span className="dex-no">{String(e.no).padStart(3, '0')}</span>
              <MonsterImage
                imageId={imageOf(e.def, e.node.id)}
                awaken={awakenOf(e.def, e.node.id)} glow={glowOf(e.def)}
                silhouette={!e.found}
                shiny={e.found && e.shiny}
                size={56}
              />
              {e.found && <Stars def={e.def} nodeId={e.node.id} />}
            </button>
          )
        })}
      </div>

      <button className="btn wide" onClick={() => go({ name: 'registry' })}>
        モンスターを登録・編集する
      </button>

      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(ev) => ev.stopPropagation()}>
            <span className="muted small">No.{String(open.no).padStart(3, '0')}</span>
            <MonsterImage
              imageId={imageOf(open.def, open.node.id)}
              awaken={awakenOf(open.def, open.node.id)} glow={glowOf(open.def)}
              silhouette={!open.found}
              shiny={open.found && open.shiny}
              size={160}
            />
            <h2>{open.found ? monsterName(open.def, open.node.id) : '？？？'}</h2>
            <Stars def={open.def} nodeId={open.node.id} />
            {open.found ? (
              <>
                <span className="row wrap center">
                  <ElementBadge def={open.def} />
                  <span className="small" style={{ color: ATTR_COLOR[nodeAttr(open.def, open.node.id)] }}>
                    {FORM_ATTR_LABEL[nodeAttr(open.def, open.node.id)]}
                  </span>
                  <span className="small">
                    {isHidden(open.def) ? 'ジョグレス' : CONFIG.gacha.rarities[rarityOf(open.def)].label}
                    {open.def.questOnly && '・降臨'}
                  </span>
                </span>
                <Abilities def={open.def} />
                <p className="muted small">
                  所持 {open.count}体
                </p>
              </>
            ) : (
              <p className="muted small">まだ見つけていない姿です。</p>
            )}
            {isHidden(open.def) && (
              <div className="recipe">
                <strong className="small">
                  ジョグレスのレシピ（★{jogressNeed(open.def).stars + 1}で誕生・どちらも最終形態）
                </strong>
                <ul className="mini-list">
                  {open.def.recipe!.map((parentId, i) => {
                    const p = progressOf(parentId, open.def)
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
            <button className="btn wide" onClick={() => setOpen(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
