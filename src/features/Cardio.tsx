import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { cardioGold } from '../lib/rewards'
import { Stepper } from '../components/Stepper'
import type { Go } from '../nav'

export function Cardio({ go }: { go: Go }) {
  const { state, todayActivities, recordCardio } = useStore()
  const [otherMinutes, setOtherMinutes] = useState(10)
  const [flash, setFlash] = useState<string | null>(null)

  const record = (kind: string, label: string, minutes: number) => {
    recordCardio(kind, label, minutes)
    setFlash(`${label} ${minutes}分 → +${cardioGold(minutes)}G`)
  }

  const todayGold = todayActivities.reduce((sum, a) => sum + a.gold, 0)

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'home' })}>
        ← ホームに戻る
      </button>
      <h1 className="title">サブメニュー</h1>
      <p className="muted">
        1分＝{CONFIG.cardio.goldPerMinute}G。上限なし。所持 {state.gold}G
      </p>

      {flash && <div className="result keep">{flash}</div>}

      <section className="card">
        <h2>ワンタップで記録</h2>
        {CONFIG.cardio.presets.map((p) => (
          <button key={p.id} className="btn wide" onClick={() => record(p.id, p.label, p.minutes)}>
            {p.label} {p.minutes}分（+{cardioGold(p.minutes)}G）
          </button>
        ))}
      </section>

      <section className="card">
        <h2>ダンス</h2>
        <div className="row wrap">
          {CONFIG.cardio.danceMinuteChoices.map((m) => (
            <button key={m} className="btn" onClick={() => record('dance', 'ダンス', m)}>
              {m}分
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>その他</h2>
        <Stepper value={otherMinutes} onChange={setOtherMinutes} min={1} max={300} unit="分" />
        <div className="row wrap">
          {[-10, -5, 5, 10].map((d) => (
            <button
              key={d}
              className="btn small"
              onClick={() => setOtherMinutes(Math.min(300, Math.max(1, otherMinutes + d)))}
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
        </div>
        <button className="btn primary wide" onClick={() => record('other', 'その他', otherMinutes)}>
          {otherMinutes}分を記録（+{cardioGold(otherMinutes)}G）
        </button>
      </section>

      {todayActivities.length > 0 && (
        <section className="card">
          <h2>今日の記録（合計 +{todayGold}G）</h2>
          <ul className="mini-list">
            {todayActivities.map((a) => (
              <li key={a.id}>
                <span>
                  {a.label} {a.minutes}分
                </span>
                <span className="tag keep">+{a.gold}G</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
