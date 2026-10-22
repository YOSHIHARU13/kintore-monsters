import { useState } from 'react'
import { imageOf } from '../lib/art'
import { useStore } from '../store'
import { SeriesChips } from '../components/SeriesChips'
import { allSeries, inSeries, seriesOf, type SeriesFilter } from '../lib/series'
import { PeriodInput } from '../components/PeriodInput'
import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { bannerNodeOf } from '../components/GachaBanner'
import { ElementBadge } from '../components/ElementBadge'
import { Abilities } from '../components/Abilities'
import { rarityOf } from '../lib/gacha'
import { elementInfo } from '../lib/element'
import { abilitySlots } from '../lib/gimmick'
import type { Go } from '../nav'
import { isHidden, monsterName, type MonsterDef } from '../types'

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
  if (!isHidden(def) && !def.rarity && !def.common) todos.push('レア度未設定')
  // 激レアはガチャに入れないと手に入らない（いつものガチャはなくなった）
  if (!isHidden(def) && !def.questOnly && rarityOf(def) === 'superRare' && !(def.gachas ?? []).length) todos.push('ガチャ未所属')
  return todos
}

/** 開発者用の画面：未入手でも絵と名前を出し、未設定のものを上にまとめる */
export function MonsterRegistry({ go }: { go: Go }) {
  const { defs, owned, state, autoTuneDefs } = useStore()
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
      (elementInfo(d).elements.length === 0 ||
        (!d.rarity && !d.common) ||
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
  const list = defs
    .map((def, index) => ({ def, index }))
    .filter(({ def }) => matches(def))
    // 未設定のものを上に
    .sort((a, b) => Number(todosOf(b.def).length > 0) - Number(todosOf(a.def).length > 0) || a.index - b.index)

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'dex' })}>
        ← 図鑑に戻る
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
          ✨ 未設定のところを、{untuned.length}体まとめておまかせで埋める（属性・レア度・得意種目・アビリティ）
        </button>
      )}
      {tuned !== null && <div className="result keep">{tuned}体をおまかせで埋めました</div>}

      {allSeries(defs).length > 0 && (
        <details className="card fold">
          <summary>
            <h2>📅 コラボの開催期間</h2>
          </summary>
          <p className="muted small">
            期間を入れると、その間だけコラボガチャが引けて、クエストに「開催中」が出ます。終わったクエストは書庫に移り、いつでも遊べます。空ならずっと開催。
          </p>
          <ul className="mini-list">
            {allSeries(defs).map((name) => (
              <li key={name} className="period-row">
                <strong>{name}</strong>
                <PeriodInput series={name} />
              </li>
            ))}
          </ul>
        </details>
      )}

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

      <div className="grid">
        {list.map(({ def, index }) => {
          const todos = todosOf(def)
          return (
            <button
              key={def.id}
              className={`tile${todos.length > 0 ? ' todo' : ''}`}
              onClick={() => go({ name: 'monsterForm', id: def.id })}
            >
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
