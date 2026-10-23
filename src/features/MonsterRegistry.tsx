import { useState } from 'react'
import { imageOf } from '../lib/art'
import { useStore } from '../store'
import { SeriesChips } from '../components/SeriesChips'
import { inSeries, seriesOf, type SeriesFilter } from '../lib/series'
import { dexOrder } from '../lib/dex'
import { ELEMENTS, ELEMENT_LABEL } from '../lib/element'
import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { bannerNodeOf } from '../components/GachaBanner'
import { ElementBadge } from '../components/ElementBadge'
import { Abilities } from '../components/Abilities'
import { RARITY_KEYS, rarityOf, isPickupRarity } from '../lib/gacha'
import { elementInfo } from '../lib/element'
import { abilitySlots } from '../lib/gimmick'
import type { Go } from '../nav'
import { isHidden, monsterName, type Element, type MonsterDef, type QuestGrade, type RarityKey } from '../types'

type Filter = 'all' | 'todo' | 'gacha' | 'quest' | 'jogress'

const FILTER_LABEL: Record<Filter, string> = {
  all: '全部',
  todo: '未設定',
  gacha: 'ガチャ',
  quest: '降臨',
  jogress: 'ジョグレス',
}

/** まだ設定が終わっていないところ（バッジで出す） */
export function todosOf(def: MonsterDef): string[] {
  const todos: string[] = []
  if (!imageOf(def, FIRST_NODE_ID)) todos.push('画像なし')
  if (!isHidden(def) && elementInfo(def).elements.length === 0) todos.push('属性なし')
  if (!isHidden(def) && !def.questOnly && !def.tier && !def.rarity && !def.common) todos.push('レア度未設定')
  // レア・激レアはガチャに入れないと手に入らない（いつものガチャはなくなった）
  if (!isHidden(def) && !def.questOnly && isPickupRarity(rarityOf(def)) && !(def.gachas ?? []).length) todos.push('ガチャ未所属')
  return todos
}

/** 開発者用の画面：未入手でも絵と名前を出し、未設定のものを上にまとめる */
export function MonsterRegistry({ go }: { go: Go }) {
  const { defs, owned, state, autoTuneDefs, bulkUpdateDefs } = useStore()
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [done, setDone] = useState<string | null>(null)
  const order = dexOrder(defs)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [series, setSeries] = useState<SeriesFilter>('all')
  const [tuned, setTuned] = useState<number | null>(null)
  const hasMet = (defId: string) => owned.some((o) => o.defId === defId) || (state.dexFound[defId]?.length ?? 0) > 0
  const ownedCount = defs.filter((d) => hasMet(d.id)).length
  // おまかせで埋められるところ（属性・レア度・得意種目・アビリティ）が残っているもの
  const untuned = defs.filter(
    (d) =>
      !isHidden(d) &&
      ((!d.questOnly && !d.tier && !d.rarity && !d.common) ||
        !d.favoriteSlot ||
        ((d.abilities ?? []).length === 0 && abilitySlots(d) > 0)),
  )

  const matches = (d: MonsterDef) => {
    if (query.trim() && !d.name.includes(query.trim())) return false
    if (!inSeries(series, seriesOf(d))) return false
    if (filter === 'todo') return todosOf(d).length > 0
    if (filter === 'gacha') return !isHidden(d) && !d.questOnly
    if (filter === 'quest') return d.questOnly === true
    if (filter === 'jogress') return isHidden(d)
    return true
  }
  const list = order
    .map((def, index) => ({ def, index }))
    .filter(({ def }) => matches(def))
    // 未設定のものを上に
    .sort((a, b) => Number(todosOf(b.def).length > 0) - Number(todosOf(a.def).length > 0) || a.index - b.index)

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'more' })}>
        ← その他に戻る
      </button>
      <h1 className="title">モンスターの登録・編集</h1>
      <p className="muted">
        入手 {ownedCount}／登録 {defs.length}・未設定 {defs.filter((d) => todosOf(d).length > 0).length}
      </p>
      <div className="row wrap">
        <button className="btn primary" onClick={() => go({ name: 'monsterForm', preset: 'gacha' })}>
          ＋ ガチャ用
        </button>
        <button className="btn primary" onClick={() => go({ name: 'monsterForm', preset: 'quest' })}>
          ＋ 降臨用（名前と画像だけでOK）
        </button>
      </div>
      {untuned.length > 0 && (
        <button
          className="btn wide"
          onClick={() => {
            autoTuneDefs(untuned.map((d) => d.id))
            setTuned(untuned.length)
          }}
        >
          ✨ 未設定のところを、{untuned.length}体まとめておまかせで埋める（レア度・得意種目・アビリティ。属性は自分で）
        </button>
      )}
      {tuned !== null && <div className="result keep">{tuned}体をおまかせで埋めました</div>}


      <div className="chips" role="group" aria-label="絞り込み">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button key={f} type="button" className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>
      <SeriesChips value={series} onChange={setSeries} />
      <input
        className="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="名前でさがす"
        aria-label="名前でさがす"
      />

      <button className={`btn wide${selecting ? ' primary' : ''}`} onClick={() => (setSelecting(!selecting), setPicked([]), setDone(null))}>
        {selecting ? '☑️ まとめて変更をやめる' : '☑️ 何体か選んで、まとめて変える'}
      </button>
      {selecting && (
        <BulkBar
          count={picked.length}
          onSelectAll={() => setPicked(list.map((x) => x.def.id))}
          onApply={(patch) => {
            bulkUpdateDefs(picked, patch)
            setDone(`${picked.length}体を変えました`)
          }}
        />
      )}
      {done && <div className="result keep">{done}</div>}

      <div className="grid">
        {list.map(({ def, index }) => {
          const todos = todosOf(def)
          const on = picked.includes(def.id)
          return (
            <button
              key={def.id}
              className={`tile${todos.length > 0 ? ' todo' : ''}${on ? ' picked' : ''}`}
              onClick={() =>
                selecting
                  ? setPicked(on ? picked.filter((x) => x !== def.id) : [...picked, def.id])
                  : go({ name: 'monsterForm', id: def.id })
              }
            >
              {selecting && <span className="pick-mark">{on ? '☑️' : '⬜'}</span>}
              <span className="muted small">No.{String(index + 1).padStart(3, '0')}</span>
              <MonsterImage imageId={imageOf(def, bannerNodeOf(def)) ?? imageOf(def, FIRST_NODE_ID)} size={96} />
              <strong>{monsterName(def, FIRST_NODE_ID)}</strong>
              <span className="small">
                {isHidden(def) ? 'ジョグレス' : CONFIG.gacha.rarities[rarityOf(def)].label}
                {def.questOnly && '・降臨'}
                {hasMet(def.id) ? '' : '・未入手'}
              </span>
              <ElementBadge def={def} />
              <Abilities def={def} />
              {todos.map((t) => (
                <span key={t} className="todo-badge">
                  {t}
                </span>
              ))}
            </button>
          )
        })}
      </div>
      {list.length === 0 && <p className="muted">当てはまるモンスターがいません。</p>}
    </div>
  )
}

/** まとめて変えるときの操作：決めた項目だけ変える（属性も、ここでは自分で選ぶ） */
function BulkBar({ count, onSelectAll, onApply }: {
  count: number
  onSelectAll: () => void
  onApply: (patch: { element?: Element | null; tier?: RarityKey; bossGrade?: QuestGrade; series?: string }) => void
}) {
  const [element, setElement] = useState<Element | null | undefined>(undefined)
  const [tier, setTier] = useState<RarityKey | undefined>(undefined)
  const [grade, setGrade] = useState<QuestGrade | undefined>(undefined)
  const [series, setSeries] = useState<string | undefined>(undefined)
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" className={`chip small${on ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  )
  return (
    <section className="card bulk-bar">
      <div className="part-head">
        <strong>{count}体を選択中</strong>
        <button className="btn small ghost" onClick={onSelectAll}>
          表示中を全部選ぶ
        </button>
      </div>
      <div className="field">
        属性
        <div className="chips" role="group" aria-label="まとめて変える属性">
          {chip(element === undefined, '変えない', () => setElement(undefined))}
          {ELEMENTS.map((e) => chip(element === e, ELEMENT_LABEL[e], () => setElement(e)))}
          {chip(element === null, '零', () => setElement(null))}
        </div>
      </div>
      <div className="field">
        レア度（ガチャのモンスター）
        <div className="chips" role="group" aria-label="まとめて変えるレア度">
          {chip(tier === undefined, '変えない', () => setTier(undefined))}
          {RARITY_KEYS.map((r) => chip(tier === r, CONFIG.gacha.rarities[r].label, () => setTier(r)))}
        </div>
      </div>
      <div className="field">
        降臨の格（降臨のモンスター）
        <div className="chips" role="group" aria-label="まとめて変える降臨の格">
          {chip(grade === undefined, '変えない', () => setGrade(undefined))}
          {(['jokyu', 'kiwami', 'kyukyoku', 'chozetsu', 'chokyukyoku', 'bakuzetsu'] as const).map((g) =>
            chip(grade === g, CONFIG.quest.grades[g].label, () => setGrade(g)),
          )}
        </div>
      </div>
      <label className="field">
        シリーズ（コラボ名。空にすると通常に戻す）
        <span className="row">
          <input value={series ?? ''} onChange={(e) => setSeries(e.target.value)} placeholder="変えない" maxLength={16} aria-label="まとめて変えるシリーズ" />
          {series !== undefined && chip(false, '変えない', () => setSeries(undefined))}
        </span>
      </label>
      <button
        className="btn primary wide"
        disabled={count === 0 || (element === undefined && !tier && !grade && series === undefined)}
        onClick={() => onApply({ element, tier, bossGrade: grade, series })}
      >
        {count}体をまとめて変える
      </button>
    </section>
  )
}
