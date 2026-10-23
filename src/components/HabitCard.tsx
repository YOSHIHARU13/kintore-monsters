import { useEffect, useState } from 'react'
import { formatClock } from '../lib/date'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { habitGoldNow, habitLabelOf } from '../lib/rewards'

const TIMER_KEY = 'habitTimerStartedAt'

/** 習慣（瞑想など）を、やった直後にその場で記録する。Gもその場でもらえる */
export function HabitCard() {
  const { state, today, recordHabit } = useStore()
  const [minutesText, setMinutesText] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  // タイマー：はじめた時刻から数える（画面を閉じても、戻ってきたら続きから）
  const [startedAt, setStartedAt] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem(TIMER_KEY))
      return saved > 0 ? saved : null
    } catch {
      return null
    }
  })
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    try {
      if (startedAt) localStorage.setItem(TIMER_KEY, String(startedAt))
      else localStorage.removeItem(TIMER_KEY)
    } catch {
      // 保存できなくてもタイマーは動く
    }
    if (!startedAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  const elapsedSec = startedAt ? Math.max(0, (now - startedAt) / 1000) : 0
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
    setFlash(`${label}${byMinutes ? ` ${m}分` : ''} → +${earned}オーブ`)
    setMinutesText('')
    navigator.vibrate?.(60)
  }

  return (
    <section className="card">
      <h2>🧘 {label}</h2>
      {state.boosts?.habit && <p className="tag keep small">⚡ブースター使用中：次の記録はG2倍・上限なし</p>}
      <p className="muted small">
        {state.habitStreak}日連続（自己ベスト {state.bestHabitStreak}日）
        {byMinutes && `・今日 ${todayMinutes}分（オーブは${max}分まで）`}
      </p>
      {byMinutes && (
        <p className="small">
          {CONFIG.morning.habitRates.map((t) => `${t.from}分〜 1分${t.perMinute}オーブ`).join('・')}
          （1回で続けた分数で決まる。{CONFIG.morning.habitRates[CONFIG.morning.habitRates.length - 1].from}分で卵{Math.floor((CONFIG.morning.habitRates[CONFIG.morning.habitRates.length - 1].from * CONFIG.morning.habitRates[CONFIG.morning.habitRates.length - 1].perMinute) / CONFIG.shop.eggPrice)}個ぶん）
        </p>
      )}
      {flash && <div className="result keep">{flash}</div>}
      {byMinutes ? (
        <>
          <div className="row wrap">
            {[1, 3, 5, 10].map((m) => (
              <button key={m} className="btn" onClick={() => record(m)}>
                {m}分（+{habitGoldNow(state, today, m)}オーブ）
              </button>
            ))}
          </div>
          {startedAt === null ? (
            <button className="btn wide" onClick={() => setStartedAt(Date.now())}>
              ▶ タイマーではじめる
            </button>
          ) : (
            <div className="habit-timer">
              <strong className="num">{formatClock(elapsedSec)}</strong>
              <button
                className="btn primary"
                onClick={() => {
                  const m = Math.floor(elapsedSec / 60)
                  setStartedAt(null)
                  if (m >= 1) record(m)
                  else setFlash('1分たっていないので、記録しませんでした')
                }}
              >
                終わる（{Math.floor(elapsedSec / 60)}分を記録）
              </button>
              <button className="btn small ghost" onClick={() => setStartedAt(null)}>
                やめる
              </button>
            </div>
          )}
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
              記録（+{gold}オーブ）
            </button>
          </div>
        </>
      ) : doneToday ? (
        <p>今日はできた！ また明日。</p>
      ) : (
        <button className="btn primary wide" onClick={() => record(0)}>
          今日できた（+{CONFIG.morning.habitGold}オーブ）
        </button>
      )}
    </section>
  )
}
