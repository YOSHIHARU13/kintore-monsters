import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { abstinenceGold, stepsGold } from '../lib/rewards'
import type { Go } from '../nav'
import type { Checkin } from '../types'

/** YYYY-MM-DD → 「10/21」 */
const shortDate = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`

export function Morning({ go }: { go: Go }) {
  const { state, yesterday, yesterdayCheckin, recordMorning } = useStore()
  const [stepsText, setStepsText] = useState('')
  const [abstained, setAbstained] = useState<boolean | null>(null)
  const [justRecorded, setJustRecorded] = useState<Checkin | null>(null)

  const steps = Math.min(CONFIG.morning.maxSteps, Math.max(0, Math.floor(Number(stepsText) || 0)))
  const nextDay = state.abstinenceStreak + 1
  const done = justRecorded ?? yesterdayCheckin
  const canRecord = stepsText !== '' && abstained !== null

  const record = () => {
    if (abstained === null) return
    const rec = recordMorning(steps, abstained)
    if (rec) {
      setJustRecorded(rec)
      navigator.vibrate?.(rec.abstained ? [80, 40, 160] : 80)
    }
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'home' })}>
        ← ホームに戻る
      </button>
      <h1 className="title">朝の記録（{shortDate(yesterday)}の分）</h1>
      <p className="muted small">
        前日の歩数と禁欲を、毎朝1回だけ記録します。所持 {state.gold}G
      </p>

      {done ? (
        <section className="card">
          <h2>記録しました：+{done.stepsGold + done.abstinenceGold}G</h2>
          <ul className="mini-list">
            <li>
              <span>歩数 {done.steps.toLocaleString()}歩</span>
              <span className="tag keep">+{done.stepsGold}G</span>
            </li>
            <li>
              <span>{done.abstained ? `禁欲 ${done.streak}日目` : '禁欲 リセット'}</span>
              <span className={`tag ${done.abstained ? 'beat' : ''}`}>+{done.abstinenceGold}G</span>
            </li>
          </ul>
          <p className="muted small">
            {done.abstained
              ? `明日の朝は禁欲${done.streak + 1}日目（+${abstinenceGold(done.streak + 1)}G）を狙えます。`
              : `今日から1日目（+${abstinenceGold(1)}G）として数え直しです。`}
          </p>
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
            <p className="muted small">
              {CONFIG.morning.stepsPerGold}歩ごとに1G（5000歩で{stepsGold(5000)}G）→ <strong>+{stepsGold(steps)}G</strong>
            </p>
          </section>

          <section className="card">
            <h2>前日、自慰行為はしなかった？</h2>
            <div className="row wrap">
              <button
                className={`btn${abstained === true ? ' primary' : ''}`}
                onClick={() => setAbstained(true)}
              >
                してない（禁欲{nextDay}日目 +{abstinenceGold(nextDay)}G）
              </button>
              <button className={`btn${abstained === false ? ' primary' : ''}`} onClick={() => setAbstained(false)}>
                した（+0G）
              </button>
            </div>
            {abstained === false && state.abstinenceStreak > 0 && (
              <p className="warn small">連続{state.abstinenceStreak}日がリセットされて、次は1日目からになります。</p>
            )}
            <p className="muted small">
              n日目は{CONFIG.morning.abstinenceGoldPerDay}G×n。{CONFIG.morning.abstinenceMaxDays}日目以降は毎日
              {abstinenceGold(CONFIG.morning.abstinenceMaxDays)}G。自己ベスト {state.bestAbstinenceStreak}日
            </p>
          </section>

          <button className="btn primary wide" disabled={!canRecord} onClick={record}>
            記録する（+{stepsGold(steps) + (abstained ? abstinenceGold(nextDay) : 0)}G）
          </button>
        </>
      )}
    </div>
  )
}
