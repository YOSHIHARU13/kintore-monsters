import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { habitLabelOf, nextStepBonus, stepsGold } from '../lib/rewards'
import type { Go } from '../nav'
import type { Checkin } from '../types'

/** 歩数ごとにもらえるゴールドの早見表 */
export function StepTable() {
  return (
    <ul className="mini-list">
      {CONFIG.morning.stepBonuses.map((b) => (
        <li key={b.steps}>
          <span>{b.steps.toLocaleString()}歩</span>
          <span className="tag keep">
            +{stepsGold(b.steps)}G（ボーナス+{b.gold}G込み）
          </span>
        </li>
      ))}
    </ul>
  )
}

/** YYYY-MM-DD → 「10/21」 */
const shortDate = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`

export function Morning({ go }: { go: Go }) {
  const { state, yesterday, yesterdayCheckin, recordMorning } = useStore()
  const [stepsText, setStepsText] = useState('')
  const [habit, setHabit] = useState<boolean | null>(null)
  const [justRecorded, setJustRecorded] = useState<Checkin | null>(null)

  const steps = Math.min(CONFIG.morning.maxSteps, Math.max(0, Math.floor(Number(stepsText) || 0)))
  const next = nextStepBonus(steps)
  const label = habitLabelOf(state)
  const done = justRecorded ?? yesterdayCheckin
  const canRecord = stepsText !== '' && habit !== null

  const record = () => {
    if (habit === null) return
    const rec = recordMorning(steps, habit)
    if (rec) {
      setJustRecorded(rec)
      navigator.vibrate?.(rec.habit ? [80, 40, 160] : 80)
    }
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'home' })}>
        ← ホームに戻る
      </button>
      <h1 className="title">朝の記録（{shortDate(yesterday)}の分）</h1>
      <p className="muted small">前日の歩数と習慣を、毎朝1回だけ記録します。所持 {state.gold}G</p>

      {done ? (
        <section className="card">
          <h2>記録しました：+{done.stepsGold + done.habitGold}G</h2>
          <ul className="mini-list">
            <li>
              <span>歩数 {done.steps.toLocaleString()}歩</span>
              <span className="tag keep">+{done.stepsGold}G</span>
            </li>
            <li>
              <span>
                {done.habitLabel || label}：{done.habit ? `○（${done.streak}日連続）` : '×'}
              </span>
              <span className="tag keep">+{done.habitGold}G</span>
            </li>
          </ul>
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
              {next && (
                <span className="muted small">
                  （あと{(next.steps - steps).toLocaleString()}歩で +{stepsGold(next.steps)}G だった）
                </span>
              )}
            </p>
            <StepTable />
          </section>

          <section className="card">
            <h2>前日：{label}？</h2>
            <div className="row wrap">
              <button className={`btn${habit === true ? ' primary' : ''}`} onClick={() => setHabit(true)}>
                できた（+{CONFIG.morning.habitGold}G）
              </button>
              <button className={`btn${habit === false ? ' primary' : ''}`} onClick={() => setHabit(false)}>
                できなかった
              </button>
            </div>
            <p className="muted small">
              いま {state.habitStreak}日連続（自己ベスト {state.bestHabitStreak}日）。習慣の名前は設定で変えられます。
            </p>
          </section>

          <button className="btn primary wide" disabled={!canRecord} onClick={record}>
            記録する（+{stepsGold(steps) + (habit ? CONFIG.morning.habitGold : 0)}G）
          </button>
        </>
      )}
    </div>
  )
}
