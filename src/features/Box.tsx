import { useState } from 'react'
import { awakenOf, imageOf } from '../lib/art'
import { useStore } from '../store'
import { FORM_ATTRS, FORM_ATTR_LABEL, type FormAttr } from '../data/exercises'
import { MonsterImage } from '../components/MonsterImage'
import { CONFIG } from '../config/gameConfig'
import { Stars } from '../components/Stars'
import { MonsterTabs } from '../components/MonsterTabs'
import type { Go } from '../nav'
import { RARITY_KEYS, rarityOf, starsOf } from '../lib/gacha'
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_LABEL, elementInfo } from '../lib/element'
import { attackOf } from '../lib/stats'
import { isLuckMax, luckOf } from '../lib/fusion'
import { isHidden, nodeAttr, plusName, type Element, type MonsterDef, type OwnedMonster } from '../types'

type Sort = 'new' | 'stars' | 'attack' | 'rarity' | 'luck' | 'dex'
const SORT_LABEL: Record<Sort, string> = { new: '入手順', stars: '星', attack: '攻撃力', rarity: 'レア度', luck: '運', dex: '図鑑順' }
const SORT_KEY = 'boxSort'

/** レア度の高さ（ジョグレスがいちばん上） */
const rarityRank = (def: MonsterDef) => (isHidden(def) ? RARITY_KEYS.length : RARITY_KEYS.indexOf(rarityOf(def)))

/** BOX：モンストのように小さいアイコンを並べる。並び替えと絞り込みつき */
export function Box({ go }: { go: Go }) {
  const { owned, defs, state } = useStore()
  const [sort, setSort] = useState<Sort>(() => {
    try {
      return (localStorage.getItem(SORT_KEY) as Sort) || 'new'
    } catch {
      return 'new'
    }
  })
  const [element, setElement] = useState<Element | 'none' | 'all'>('all')
  const [part, setPart] = useState<FormAttr | 'all'>('all')
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
    stars: (a, b) => starsOf(b.def, b.mon.nodeId) - starsOf(a.def, a.mon.nodeId) || (b.mon.plus ?? 0) - (a.mon.plus ?? 0),
    attack: (a, b) => attackOf(b.mon, b.def) - attackOf(a.mon, a.def),
    rarity: (a, b) => rarityRank(b.def) - rarityRank(a.def) || starsOf(b.def, b.mon.nodeId) - starsOf(a.def, a.mon.nodeId),
    luck: (a, b) => luckOf(b.mon) - luckOf(a.mon),
    dex: (a, b) => a.index - b.index || a.mon.obtainedAt - b.mon.obtainedAt,
  }
  const list = rows
    .filter(({ def }) => {
      const els = elementInfo(def).elements
      return element === 'all' || (element === 'none' ? els.length === 0 : els.includes(element))
    })
    .filter(({ def, mon }) => part === 'all' || nodeAttr(def, mon.nodeId) === part)
    .sort(order[sort])

  return (
    <div className="page">
      <MonsterTabs on="box" go={go} />
      <div className="dex-head">
        <strong>所持 {owned.length}体</strong>
        <span className="muted small">合体で＋（最大＋{CONFIG.fusion.maxPlus}）</span>
      </div>
      <div className="chips" role="group" aria-label="並び替え">
        {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
          <button key={s} type="button" className={`chip small${sort === s ? ' on' : ''}`} onClick={() => changeSort(s)}>
            {SORT_LABEL[s]}
          </button>
        ))}
      </div>
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
          無属性
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
        <p className="muted">まだモンスターがいません。図鑑でモンスターを登録して、ショップでタマゴを孵しましょう。</p>
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
              <MonsterImage imageId={imageOf(def, mon.nodeId)} awaken={awakenOf(def, mon.nodeId)} size={56} plus={mon.plus} shiny={mon.shiny} />
              <Stars def={def} nodeId={mon.nodeId} />
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
