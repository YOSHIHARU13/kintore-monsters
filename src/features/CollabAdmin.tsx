import { useState } from 'react'
import { useStore } from '../store'
import { allSeries, collabLabel, seriesOf } from '../lib/series'
import { PeriodInput } from '../components/PeriodInput'
import type { Go } from '../nav'

/** 開発者メニュー：コラボの管理（名前をまとめて変える・開催期間） */
export function CollabAdmin({ go }: { go: Go }) {
  const { defs } = useStore()
  const names = allSeries(defs)
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'more' })}>
        ← その他に戻る
      </button>
      <h1 className="title">コラボの管理</h1>
      <p className="muted small">
        コラボは、モンスターの登録で「シリーズ（コラボ名）」を入れると作られます。ここでは名前をまとめて変えたり、開催期間を決めたりできます。
        期間を入れると、その間だけコラボガチャが引けて、クエストに「開催中」が出ます。終わったクエストは書庫に移り、いつでも遊べます。空ならずっと開催。
      </p>
      {names.length === 0 && <p className="muted">まだコラボがありません。</p>}
      {names.map((name) => (
        <CollabRow key={name} name={name} count={defs.filter((d) => seriesOf(d) === name).length} />
      ))}
    </div>
  )
}

function CollabRow({ name, count }: { name: string; count: number }) {
  const { renameSeries } = useStore()
  const [text, setText] = useState(name)
  return (
    <section className="card">
      <h2>
        🤝 {collabLabel(name)} <span className="muted small">{count}体</span>
      </h2>
      <label className="field">
        コラボ名（「コラボ」は表示のときに自動で付きます）
        <span className="row">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={16} aria-label={`${name}の新しい名前`} />
          <button className="btn small" disabled={!text.trim() || text.trim() === name} onClick={() => renameSeries(name, text)}>
            {count}体まとめて変える
          </button>
        </span>
      </label>
      <PeriodInput series={name} />
    </section>
  )
}
