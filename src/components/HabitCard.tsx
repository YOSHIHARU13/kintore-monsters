import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { habitGoldNow, habitLabelOf } from '../lib/rewards'

/** 習慣（瞑想など）を、やった直後にその場で記録する。Gもその場でもらえる */
export function HabitCard() {
  const { state, today, recordHabit } = useStore()
  const [minutesText, setMinutesText] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const label = habitLabelOf(state)
  const byMinutes = state.habitMode === 'minutes'
  const todayMinutes = state.habitDate === today ? state.habitMinutesToday : 0
  const doneToday = state.habitDate === today
  const minutes = Math.min(600, Math.max(0, Math.floor(Number(minutesText) || 0)))
  const gold = habitGoldNow(state, today, minutes)
  const max = CONFIG.morning.habitMaxMinutes

  const record = (m: number) => {
    const earned = recordHabit(m)
    if (earned === null) return
    setFlash(`${label}${byMinutes ? ` ${m}分` : ''} → +${earned}G`)
    setMinutesText('')
    navigator.vibrate?.(60)
  }

  return (
    <section className="card">
      <h2>🧘 {label}</h2>
      <p className="muted small">
        {state.habitStreak}日連続（自己ベスト {state.bestHabitStreak}日）
        {byMinutes && `・今日 ${todayMinutes}分（Gは${max}分まで）`}
      </p>
      {flash && <div className="result keep">{flash}</div>}
      {byMinutes ? (
        <>
          <div className="row wrap">
            {[5, 10, 15, 20].map((m) => (
              <button key={m} className="btn" onClick={() => record(m)}>
                {m}分（+{habitGoldNow(state, today, m)}G）
              </button>
            ))}
          </div>
          <div className="row">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="分"
              value={minutesText}
              onChange={(e) => setMinutesText(e.target.value)}
              aria-label={`${label}の分数`}
            />
            <button className="btn primary" disabled={minutes < 1} onClick={() => record(minutes)}>
              記録（+{gold}G）
            </button>
          </div>
        </>
      ) : doneToday ? (
        <p>今日はできた！ また明日。</p>
      ) : (
        <button className="btn primary wide" onClick={() => record(0)}>
          今日できた（+{CONFIG.morning.habitGold}G）
        </button>
      )}
    </section>
  )
}
