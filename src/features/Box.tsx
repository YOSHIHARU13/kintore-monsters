import { useState } from 'react'
import { monArt } from '../lib/art'
import { useStore } from '../store'
import { bulkFeedTarget, planBulkFeed, protectedIds } from '../lib/fusion'
import { SeriesChips } from '../components/SeriesChips'
import { inSeries, seriesOf, type SeriesFilter } from '../lib/series'
import { FORM_ATTRS, FORM_ATTR_LABEL, type FormAttr } from '../data/exercises'
import { MonsterImage } from '../components/MonsterImage'
import { Stars } from '../components/Stars'
import { MonsterTabs } from '../components/MonsterTabs'
import type { Go } from '../nav'
import { RARITY_KEYS, rarityOf, starsOf } from '../lib/gacha'
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_LABEL, elementInfo, ZERO_LABEL } from '../lib/element'
import { attackOf, monStars } from '../lib/stats'
import { isLuckMax, luckOf } from '../lib/fusion'
import { isHidden, nodeAttr, plusName, type Element, type MonsterDef, type OwnedMonster } from '../types'

type Sort = 'new' | 'stars' | 'attack' | 'rarity' | 'luck' | 'dex'
const SORT_LABEL: Record<Sort, string> = { new: '入手順', stars: '星', attack: '攻撃力', rarity: 'レア度', luck: '運', dex: '図鑑順' }
const SORT_KEY = 'boxSort'

/** レア度の高さ（ジョグレスがいちばん上） */
const rarityRank = (def: MonsterDef) => (isHidden(def) ? RARITY_KEYS.length : RARITY_KEYS.indexOf(rarityOf(def)))

/** BOX：モンストのように小さいアイコンを並べる。並び替えと絞り込みつき */
export function Box({ go }: { go: Go }) {
  const { owned, defs, state, today, bulkFeed } = useStore()
  const [confirmFeed, setConfirmFeed] = useState(false)
  const [fedMsg, setFedMsg] = useState<string | null>(null)
  const feedPlans = planBulkFeed(owned, defs, protectedIds(state, today), starsOf, bulkFeedTarget)
  const feedCount = feedPlans.reduce((n, p) => n + p.foodIds.length, 0)
  const [sort, setSort] = useState<Sort>(() => {
    try {
      return (localStorage.getItem(SORT_KEY) as Sort) || 'new'
    } catch {
      return 'new'
    }
  })
  const [element, setElement] = useState<Element | 'none' | 'all'>('all')
  const [part, setPart] = useState<FormAttr | 'all'>('all')
  const [series, setSeries] = useState<SeriesFilter>('all')
  const partnerIds = new Set(Object.values(state.partners))

  const changeSort = (s: Sort) => {
    setSort(s)
    try {
      localStorage.setItem(SORT_KEY, s)
    } catch {
      // 保存できなくても並び替えはできる
    }
  }

  const rows = owned.flatMap((mon) => {
    const index = defs.findIndex((d) => d.id === mon.defId)
    return index < 0 ? [] : [{ mon, def: defs[index], index }]
  })
  const order: Record<Sort, (a: Row, b: Row) => number> = {
    new: (a, b) => b.mon.obtainedAt - a.mon.obtainedAt,
    stars: (a, b) => monStars(b.mon, b.def) - monStars(a.mon, a.def),
    attack: (a, b) => attackOf(b.mon, b.def) - attackOf(a.mon, a.def),
    rarity: (a, b) => rarityRank(b.def) - rarityRank(a.def) || monStars(b.mon, b.def) - monStars(a.mon, a.def),
    luck: (a, b) => luckOf(b.mon) - luckOf(a.mon),
    dex: (a, b) => a.index - b.index || a.mon.obtainedAt - b.mon.obtainedAt,
  }
  const list = rows
    .filter(({ def }) => {
      const els = elementInfo(def).elements
      return element === 'all' || (element === 'none' ? els.length === 0 : els.includes(element))
    })
    .filter(({ def, mon }) => part === 'all' || nodeAttr(def, mon.nodeId) === part)
    .filter(({ def }) => inSeries(series, seriesOf(def)))
    .sort(order[sort])

  return (
    <div className="page">
      <MonsterTabs on="box" go={go} />
      <div className="dex-head">
        <strong>所持 {owned.length}体</strong>
      </div>
      {feedCount > 0 && (
        <button
          className={`btn wide${confirmFeed ? ' primary' : ''}`}
          onClick={() => {
            if (!confirmFeed) return setConfirmFeed(true)
            const r = bulkFeed()
            setConfirmFeed(false)
            setFedMsg(
              `${r.fed}体を、${r.kept}体に合成して運を上げました` +
                (r.luckMax > 0 ? `。運極が${r.luckMax}体できた！ 🟡トク玉×${r.eggs}` : ''),
            )
          }}
        >
          {confirmFeed
            ? `本当に${feedCount}体を合成する（激レア・相棒・出撃中は残します）`
            : `🍖 ノーマル以下のダブり${feedCount}体を、いちばん育っている子にまとめて合成`}
        </button>
      )}
      {fedMsg && <div className="result keep">{fedMsg}</div>}
      <div className="chips" role="group" aria-label="並び替え">
        {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
          <button key={s} type="button" className={`chip small${sort === s ? ' on' : ''}`} onClick={() => changeSort(s)}>
            {SORT_LABEL[s]}
          </button>
        ))}
      </div>
      <SeriesChips value={series} onChange={setSeries} />
      <div className="chips" role="group" aria-label="属性で絞り込み">
        <button type="button" className={`chip small${element === 'all' ? ' on' : ''}`} onClick={() => setElement('all')}>
          全属性
        </button>
        {ELEMENTS.map((e) => (
          <button
            key={e}
            type="button"
            className={`chip small${element === e ? ' on' : ''}`}
            style={element === e ? { borderColor: ELEMENT_COLOR[e], color: ELEMENT_COLOR[e] } : undefined}
            onClick={() => setElement(e)}
          >
            {ELEMENT_LABEL[e]}
          </button>
        ))}
        <button type="button" className={`chip small${element === 'none' ? ' on' : ''}`} onClick={() => setElement('none')}>
          {ZERO_LABEL}
        </button>
      </div>
      <div className="chips" role="group" aria-label="部位で絞り込み">
        <button type="button" className={`chip small${part === 'all' ? ' on' : ''}`} onClick={() => setPart('all')}>
          全部位
        </button>
        {FORM_ATTRS.map((a) => (
          <button key={a} type="button" className={`chip small${part === a ? ' on' : ''}`} onClick={() => setPart(a)}>
            {FORM_ATTR_LABEL[a]}
          </button>
        ))}
      </div>
      {owned.length === 0 && (
        <p className="muted">まだモンスターがいません。図鑑でモンスターを登録して、ショップでガチャを引きましょう。</p>
      )}
      <div className="dex-grid">
        {list.map(({ mon, def }) => {
          const el = elementInfo(def).elements[0]
          return (
            <button
              key={mon.id}
              className="dex-cell box-cell"
              style={el ? { borderColor: ELEMENT_COLOR[el] } : undefined}
              onClick={() => go({ name: 'monster', id: mon.id })}
              aria-label={plusName(def, mon)}
            >
              {partnerIds.has(mon.id) && <span className="box-partner">相</span>}
              {isLuckMax(mon) && <span className="box-luck">運極</span>}
              <MonsterImage {...monArt(def, mon)} size={56} plus={mon.plus} shiny={mon.shiny} />
              <Stars def={def} nodeId={mon.nodeId} mon={mon} />
              <span className="box-name">{plusName(def, mon)}</span>
            </button>
          )
        })}
      </div>
      {owned.length > 0 && list.length === 0 && <p className="muted">当てはまるモンスターがいません。</p>}
    </div>
  )
}

type Row = { mon: OwnedMonster; def: MonsterDef; index: number }
