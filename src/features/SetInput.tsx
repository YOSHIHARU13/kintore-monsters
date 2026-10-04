import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { EXERCISES, SLOTS, dumbbellText, exerciseOfSlot, rangeText, repRange } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { calcTarget, judgeSet, recentSessions, suggestProgression } from '../lib/target'
import { calcSetReward } from '../lib/rewards'
import { formatClock, weekStartKey } from '../lib/date'
import { Stepper } from '../components/Stepper'
import { Gauge } from '../components/Gauge'
import type { Go } from '../nav'
import { MusicButtons } from '../music'
import type { Judge, SetRecord } from '../types'

const JUDGE_LABEL: Record<Judge, string> = { beat: '前回超え', keep: 'キープ', normal: '記録' }

interface Result {
  judge: Judge
  eligible: boolean
  exp: number
  gold: number
  reps: number
  key: number
  weekCleared: boolean
}

export function SetInput({ slotId, go }: { slotId: string; go: Go }) {
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
  // 目標は「その日のうちで何セット目か」で比べ、報酬は「今週その枠で何セット目か」で決める
  const setNo = todays.length + 1
  const week = weekStartKey(new Date(`${store.today}T12:00:00`))
  const weekIds = new Set(
    [...store.weekSets, ...(history ?? []).filter((h) => h.date >= week)]
      .filter((s) => s.slotId === slotId)
      .map((s) => s.id),
  )
  const rewardNo = isBonus ? setNo : weekIds.size + 1
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
  const dayDone = todays.length >= CONFIG.sets.perExercise
  const baseDone = rewardNo > CONFIG.sets.perExercise

  const confirm = () => {
    const judge = judgeSet(reps, target)
    const reward = calcSetReward({ isBonus, setNo: rewardNo, judge, intervalOk })
    const { record: rec, weekCleared } = store.recordSet(
      {
        exerciseId: ex.id,
        slotId,
        day: slot.day,
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
    setResult({ judge, eligible: reward.eligible, exp: reward.exp, gold: reward.gold, reps, key: rec.ts, weekCleared })
    if (weekCleared) navigator.vibrate?.([120, 60, 120, 60, 320])
    else if (judge === 'beat') navigator.vibrate?.([80, 40, 160])
  }

  // 今日3セット終えたら今日までの結果から、まだなら前回までの結果から、次の一手を提案する
  const streak = CONFIG.progression.streak
  const suggestion = dayDone
    ? suggestProgression(recentSessions(history, streak), ex, range.max)
    : todays.length === 0
      ? suggestProgression(recentSessions(history.filter((h) => h.date !== store.today), streak), ex, range.max)
      : null
  const streakText = `${streak > 1 ? `${streak}回連続で` : dayDone ? '' : '前回は'}3セットとも上限達成！`

  const rewardText = (r: { exp: number; gold: number; eligible: boolean }) =>
    !r.eligible ? '記録のみ' : r.gold > 0 ? `+${r.gold}G` : `+${r.exp}EXP`

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'training' })}>
        ← メニューに戻る
      </button>
      <MusicButtons />
      <h1 className="title">{ex.name}</h1>
      <p className="muted">
        {isBonus ? 'ボーナス枠・' : ''}
        {rangeText(ex.id)}
      </p>
      <p className="small how">{ex.how}</p>
      {ex.perSide && (
        <p className="small how">
          ↔️ 左右の種目です。右と左を同じ回数ずつやって1セット。回数は<strong>片側ぶん</strong>を入れます（右10回＋左10回なら「10回」）。
        </p>
      )}

      {suggestion?.kind === 'addWeight' &&
        (dayDone ? (
          <div className="banner">{streakText} 次回は +1kg（{suggestion.toKg}kg）にしましょう。</div>
        ) : (
          weight === suggestion.fromKg && (
            <div className="banner">
              {streakText}
              <button className="btn small" onClick={() => setWeight(suggestion.toKg)}>
                {suggestion.toKg}kg に上げる
              </button>
            </div>
          )
        ))}
      {suggestion?.kind === 'upgrade' && (
        <div className="banner">
          {streakText} 上位種目に進めます。
          <button className="btn small" onClick={() => store.setSlot(slotId, suggestion.toExerciseId)}>
            「{EXERCISES[suggestion.toExerciseId].name}」に差し替える
          </button>
        </div>
      )}

      <section className="card set-card">
        <div className="set-head">
          <strong>
            {isBonus ? '' : '今週 '}
            {rewardNo}セット目
          </strong>
          <span className="target">{target !== null ? `目標 ${target}回` : '目標なし（初回）'}</span>
        </div>

        {ex.weighted && (
          <p className="muted small center">{dumbbellText(ex)}・重さは1個ぶんを入れます</p>
        )}
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
          {ex.perSide ? '左右各' : ''}
          {reps}回で確定
        </button>

        {baseDone ? (
          <p className="muted small center">
            {isBonus ? '今日' : '今週'}の{CONFIG.sets.perExercise}セットは完了。ここからは記録のみ（報酬なし）
          </p>
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
                  {ex.perSide ? '左右各' : ''}
                  {s.reps}回
                </span>
                <span className={`tag ${s.judge}`}>
                  {JUDGE_LABEL[s.judge]} {rewardText(s)}
                </span>
              </li>
            ))}
          </ul>
          {baseDone && (
            <button className="btn primary wide" onClick={() => go({ name: 'training' })}>
              この種目は完了！ 次の種目へ
            </button>
          )}
        </section>
      )}

      {result?.judge === 'beat' && !result.weekCleared && (
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
      {result?.weekCleared && (
        <div className="beat-overlay clear-overlay" key={result.key} onClick={() => setResult(null)}>
          <div className="beat-burst" />
          <div className="beat-burst reverse" />
          {Array.from({ length: 42 }, (_, i) => (
            <i key={i} className="spark" style={{ ['--i' as string]: i }} />
          ))}
          <div className="beat-text">
            <div className="clear-crown">👑</div>
            <div className="beat-title">今週 全消し！！</div>
            <div className="beat-sub">ボーナス +{CONFIG.weekly.clearGold}G</div>
            <div className="clear-count">全消し 累計 {store.state.weeklyClears + 1}週目</div>
            <div className="muted small">タップして続ける</div>
          </div>
        </div>
      )}
    </div>
  )
}
