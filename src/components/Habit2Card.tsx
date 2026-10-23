import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'

/** 2つ目の習慣（設定で選ぶ）。「昨日あった良いこと」は1つ書くごとに。書いたものは日記として残る */
export function Habit2Card() {
  const { state, today, recordHabit2, journal } = useStore()
  const [text, setText] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const kind = state.habit2?.kind
  const h = kind ? CONFIG.morning.habit2[kind] : undefined
  if (!kind || !h) return null
  const count = state.habit2?.date === today ? state.habit2.count : 0
  const done = count >= h.max
  const record = () => {
    const gold = recordHabit2(text)
    if (gold !== null) {
      setFlash(`${h.label} → +${gold}オーブ`)
      setText('')
      navigator.vibrate?.(60)
    }
  }
  return (
    <section className="card">
      <h2>
        {h.icon} {h.label}
      </h2>
      {kind === 'goodThings' ? (
        <>
          <p className="muted small">
            1つ書くごとに +{h.gold}オーブ（1日{h.max}つまで・今日 {count}/{h.max}）。良いことを思い出す習慣は、気分を前向きにしてくれます。
          </p>
          {!done && (
            <span className="row">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder="例：ベンチで前回より1回多く上がった" aria-label="昨日あった良いこと" />
              <button className="btn primary small" disabled={!text.trim()} onClick={record}>
                書く
              </button>
            </span>
          )}
          {journal.length > 0 && (
            <details>
              <summary className="small">これまでの良いこと（{journal.length}）</summary>
              <ul className="mini-list">
                {journal.slice(0, 30).map((j) => (
                  <li key={j.id}>
                    <span className="small">{j.text}</span>
                    <span className="muted small">{Number(j.date.slice(5, 7))}/{Number(j.date.slice(8, 10))}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : done ? (
        <p>今日はできた！</p>
      ) : (
        <button className="btn primary wide" onClick={record}>
          今日できた（+{h.gold}オーブ）
        </button>
      )}
      {done && kind === 'goodThings' && <p>今日は{h.max}つ書けた！</p>}
      {flash && <div className="result keep">{flash}</div>}
    </section>
  )
}
