import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { EXERCISES, SLOTS, exerciseOfSlot, rangeText, repRange, type DayKey } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { calcTarget, judgeSet, latestSession, suggestProgression } from '../lib/target'
import { calcSetReward } from '../lib/rewards'
import { formatClock } from '../lib/date'
import { Stepper } from '../components/Stepper'
import { Gauge } from '../components/Gauge'
import type { Go } from '../nav'
import type { Judge, SetRecord } from '../types'

const JUDGE_LABEL: Record<Judge, string> = { beat: '前回超え', keep: 'キープ', normal: '記録' }

interface Result {
  judge: Judge
  eligible: boolean
  exp: number
  gold: number
  reps: number
  key: number
}

export function SetInput({ day, slotId, go }: { day: DayKey; slotId: string; go: Go }) {
  const store = useStore()
  const slot = SLOTS.find((s) => s.id === slotId)!
  const ex = exerciseOfSlot(slot, store.menu)
  const isBonus = slot.day === 'bonus'
  const range = repRange(ex.id)

  const [history, setHistory] = useState<SetRecord[] | null>(null)
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let alive = true
    setHistory(null)
    setResult(null)
    const init = (h: SetRecord[]) => {
      if (!alive) return
      const last = h.length ? h.reduce((a, b) => (a.ts > b.ts ? a : b)) : null
      setWeight(ex.weighted ? (last?.weightKg ?? CONFIG.weight.defaultKg) : 0)
      setHistory(h)
    }
    store.getHistory(ex.id).then(init, () => init([]))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])

  const loaded = history !== null
  const todays = (history ?? []).filter((h) => h.date === store.today).sort((a, b) => a.ts - b.ts)
  const setNo = todays.length + 1
  const target = loaded ? calcTarget(history, setNo, weight) : null

  // 目標回数（なければ回数範囲の下限）を最初から入れておく
  useEffect(() => {
    if (loaded) setReps(target ?? range.min ?? Math.min(10, range.max))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, target, setNo, ex.id])

  if (!loaded) {
    return (
      <div className="page">
        <p className="muted">記録を読み込んでいます…</p>
      </div>
    )
  }

  const lastTs = history.length ? Math.max(...history.map((h) => h.ts)) : null
  const elapsedSec = lastTs ? (now - lastTs) / 1000 : Infinity
  const intervalOk = elapsedSec >= CONFIG.sets.minIntervalSec
  const baseDone = todays.length >= CONFIG.sets.perExercise

  const confirm = () => {
    const judge = judgeSet(reps, target)
    const reward = calcSetReward({ isBonus, setNo, judge, intervalOk })
    const rec = store.recordSet(
      {
        exerciseId: ex.id,
        slotId,
        day,
        setNo,
        weightKg: weight,
        reps,
        target,
        judge,
        eligible: reward.eligible,
        exp: reward.exp,
        gold: reward.gold,
      },
      reward.countsBeat,
    )
    setHistory([...history, rec])
    setNow(Date.now())
    setResult({ judge, eligible: reward.eligible, exp: reward.exp, gold: reward.gold, reps, key: rec.ts })
    if (judge === 'beat') navigator.vibrate?.([80, 40, 160])
  }

  // 今日3セット終えたらその結果から、まだなら前回の結果から、次の一手を提案する
  const prevSession = latestSession(history.filter((h) => h.date !== store.today))
  const suggestion = baseDone
    ? suggestProgression(todays, ex, range.max)
    : todays.length === 0
      ? suggestProgression(prevSession, ex, range.max)
      : null

  const rewardText = (r: { exp: number; gold: number; eligible: boolean }) =>
    !r.eligible ? '記録のみ' : r.gold > 0 ? `+${r.gold}G` : `+${r.exp}EXP`

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'training', day })}>
        ← メニューに戻る
      </button>
      <h1 className="title">{ex.name}</h1>
      <p className="muted">
        {isBonus ? 'ボーナス枠・' : ''}
        {rangeText(ex.id)}
      </p>

      {suggestion?.kind === 'addWeight' &&
        (baseDone ? (
          <div className="banner">3セットとも上限達成！ 次回は +1kg（{suggestion.toKg}kg）にしましょう。</div>
        ) : (
          weight === suggestion.fromKg && (
            <div className="banner">
              前回は3セットとも上限達成！
              <button className="btn small" onClick={() => setWeight(suggestion.toKg)}>
                {suggestion.toKg}kg に上げる
              </button>
            </div>
          )
        ))}
      {suggestion?.kind === 'upgrade' && (
        <div className="banner">
          {baseDone ? '3セットとも上限達成！' : '前回は3セットとも上限達成！'} 上位種目に進めます。
          <button className="btn small" onClick={() => store.setSlot(slotId, suggestion.toExerciseId)}>
            「{EXERCISES[suggestion.toExerciseId].name}」に差し替える
          </button>
        </div>
      )}

      <section className="card set-card">
        <div className="set-head">
          <strong>{setNo}セット目</strong>
          <span className="target">{target !== null ? `目標 ${target}回` : '目標なし（初回）'}</span>
        </div>

        {ex.weighted && (
          <Stepper
            value={weight}
            onChange={setWeight}
            min={CONFIG.weight.minKg}
            max={CONFIG.weight.maxKg}
            step={CONFIG.weight.stepKg}
            unit="kg"
          />
        )}
        <Stepper value={reps} onChange={setReps} min={0} max={99} unit="回" big />

        <button className="btn primary wide confirm" onClick={confirm}>
          {reps}回で確定
        </button>

        {setNo > CONFIG.sets.perExercise ? (
          <p className="muted small center">4セット目以降は記録のみ（報酬なし）</p>
        ) : !intervalOk ? (
          <p className="warn small center">
            あと{Math.ceil(CONFIG.sets.minIntervalSec - elapsedSec)}秒 休むと報酬の対象になります
          </p>
        ) : null}
      </section>

      {todays.length > 0 && (
        <section className="card">
          <div className="rest">
            <span>休憩 {formatClock(elapsedSec)}</span>
            <span className="muted small">目安 {formatClock(CONFIG.sets.restSec)}</span>
          </div>
          <Gauge value={elapsedSec} max={CONFIG.sets.restSec} />
        </section>
      )}

      {result && result.judge !== 'beat' && (
        <div className={`result ${result.judge}`}>
          {JUDGE_LABEL[result.judge]}！ {rewardText(result)}
        </div>
      )}

      {todays.length > 0 && (
        <section className="card">
          <h2>今日の記録</h2>
          <ul className="mini-list">
            {todays.map((s) => (
              <li key={s.id}>
                <span>
                  {s.setNo}セット目　{ex.weighted ? `${s.weightKg}kg × ` : ''}
                  {s.reps}回
                </span>
                <span className={`tag ${s.judge}`}>
                  {JUDGE_LABEL[s.judge]} {rewardText(s)}
                </span>
              </li>
            ))}
          </ul>
          {baseDone && (
            <button className="btn primary wide" onClick={() => go({ name: 'training', day })}>
              この種目は完了！ 次の種目へ
            </button>
          )}
        </section>
      )}

      {result?.judge === 'beat' && (
        <div className="beat-overlay" key={result.key} onClick={() => setResult(null)}>
          <div className="beat-burst" />
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} className="spark" style={{ ['--i' as string]: i }} />
          ))}
          <div className="beat-text">
            <div className="beat-title">前回超え！！</div>
            <div className="beat-sub">
              {result.reps}回 {result.eligible ? `／ ${rewardText(result)}` : '（報酬対象外）'}
            </div>
            <div className="muted small">タップして続ける</div>
          </div>
        </div>
      )}
    </div>
  )
}
