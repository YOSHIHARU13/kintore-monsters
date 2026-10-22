import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { stepsGold } from '../lib/rewards'
import type { Go } from '../nav'
import type { Checkin } from '../types'

/** YYYY-MM-DD → 「10/21」 */
const shortDate = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`

export function Morning({ go }: { go: Go }) {
  const { state, yesterday, yesterdayCheckin, recordMorning } = useStore()
  const [stepsText, setStepsText] = useState('')
  const [justRecorded, setJustRecorded] = useState<Checkin | null>(null)

  const steps = Math.min(CONFIG.morning.maxSteps, Math.max(0, Math.floor(Number(stepsText) || 0)))
  const done = justRecorded ?? yesterdayCheckin

  const record = () => {
    const rec = recordMorning(steps)
    if (rec) {
      setJustRecorded(rec)
      navigator.vibrate?.(80)
    }
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'home' })}>
        ← ホームに戻る
      </button>
      <h1 className="title">朝の記録（{shortDate(yesterday)}の分）</h1>
      <p className="muted small">前日の歩数を、毎朝1回だけ記録します。所持 {state.gold}G</p>

      {done ? (
        <section className="card">
          <h2>記録しました：+{done.stepsGold + done.habitGold}G</h2>
          <p>歩数 {done.steps.toLocaleString()}歩</p>
          <button className="btn primary wide" onClick={() => go({ name: 'home' })}>
            ホームへ
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>前日の歩数</h2>
            <label className="field">
              スマホの歩数アプリの数字をそのまま入れてください
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={CONFIG.morning.maxSteps}
                placeholder="例：6500"
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
              />
            </label>
            <p>
              → <strong>+{stepsGold(steps)}G</strong>
              <span className="muted small">（{CONFIG.morning.stepsPerGold}歩ごとに1G・歩いた分だけ増える）</span>
            </p>
          </section>

          <button className="btn primary wide" disabled={stepsText === ''} onClick={record}>
            記録する（+{stepsGold(steps)}G）
          </button>
        </>
      )}
    </div>
  )
}
