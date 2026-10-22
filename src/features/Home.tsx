import { useStore } from '../store'
import { LoginBonus, Gifts } from './Missions'
import { activeToday, canClaim, dailyMissions, dexMissions, weeklyMissions } from '../lib/missions'
import { isLuckMax } from '../lib/fusion'
import { availableEvents } from '../lib/events'
import { awakenOf, imageOf } from '../lib/art'
import { ATTRS, ATTR_LABEL, DAYS, DAY_KEYS, TASK_SLOTS, exerciseOfSlot } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { Stars } from '../components/Stars'
import { ATTR_COLOR, type Go } from '../nav'
import { plusName } from '../types'
import { isWeekCleared, partProgress, slotDone } from '../lib/week'
import { nearGoals } from '../lib/progress'
import { BoosterPanel } from '../components/BoosterPanel'
import { HabitCard } from '../components/HabitCard'

export function Home({ go }: { go: Go }) {
  const { state, menu, weekSets, todaySets, week, defs, owned, yesterday, yesterdayCheckin, today } = useStore()
  const missionCtx = { state, today, week, todaySets, weekSets }
  const claimable = [...dailyMissions(missionCtx), ...weeklyMissions(missionCtx), ...dexMissions(defs, owned, state)].filter(
    (m) => canClaim(state, m),
  ).length
  const luckMaxCount = owned.filter(isLuckMax).length
  const freeEvents = availableEvents(state, today)
  const gaugeMax = Math.max(100, ...ATTRS.map((a) => state.lifetimeExp[a]))
  const progress = partProgress(weekSets)
  const remaining = DAY_KEYS.reduce((sum, day) => sum + progress[day].total - progress[day].done, 0)
  // 次にやる種目：まだ3セット終わっていない枠のうち、いちばん進んでいるもの（途中の種目を先に片付ける）
  const nextSlot = TASK_SLOTS.filter((s) => slotDone(weekSets, s.id) < CONFIG.sets.perExercise).sort(
    (a, b) => slotDone(weekSets, b.id) - slotDone(weekSets, a.id),
  )[0]
  const goals = nearGoals(owned, defs, 3)

  const morningDone = state.lastCheckinDate === yesterday || yesterdayCheckin !== null

  return (
    <div className="page">
      <LoginBonus />
      <Gifts />
      <button className="card mission-entry" onClick={() => go({ name: 'missions' })}>
        <span>🎯 ミッション</span>
        {claimable > 0 ? <span className="tag keep">受け取れる報酬 {claimable}</span> : <span className="muted small">デイリー・ウィークリー・図鑑</span>}
        {luckMaxCount > 0 && <span className="luck-max small">運極 {luckMaxCount}体</span>}
        <span>›</span>
      </button>
      {freeEvents.length > 0 && (
        <button className="card free-banner" onClick={() => go({ name: 'shop' })}>
          🎁 今日は{freeEvents.map((e) => e.label).join('・')}の日！ {activeToday(state, todaySets, today, yesterday) ? 'ショップで引こう' : '1つやって引こう'}
        </button>
      )}
      <section className="card">
        <h2>☀️ 朝の記録</h2>
        {morningDone ? (
          <p>
            {yesterdayCheckin
              ? `昨日 ${yesterdayCheckin.steps.toLocaleString()}歩・+${yesterdayCheckin.stepsGold + yesterdayCheckin.habitGold}G`
              : '前日の分は記録済み'}
          </p>
        ) : (
          <button className="btn primary wide" onClick={() => go({ name: 'morning' })}>
            前日の歩数を記録する
          </button>
        )}
        <p className="muted small">{CONFIG.morning.stepsPerGold}歩ごとに1G。歩いた分だけ増えます。</p>
      </section>

      <HabitCard />
      <BoosterPanel compact />

      <section className="card">
        <h2>今週の残りタスク：{isWeekCleared(weekSets) ? '全消し達成！' : `あと${remaining}セット`}</h2>
        {DAY_KEYS.map((day) => {
          const { done, total, slotsDone, slots } = progress[day]
          return (
            <div key={day} className="gauge-row">
              <span style={{ color: ATTR_COLOR[DAYS[day].attr] }}>
                {DAYS[day].title}{' '}
                <strong className="num">
                  {slotsDone}/{slots}
                </strong>
              </span>
              <Gauge value={done} max={total} color={ATTR_COLOR[DAYS[day].attr]} />
              <span className="num">{done === total ? '✓ 完了' : `残り${total - done}`}</span>
            </div>
          )
        })}
        {nextSlot ? (
          <button className="btn primary wide" onClick={() => go({ name: 'set', slotId: nextSlot.id })}>
            次にやる：{exerciseOfSlot(nextSlot, menu).name}（{slotDone(weekSets, nextSlot.id)}/
            {CONFIG.sets.perExercise}）
          </button>
        ) : (
          <button className="btn wide" onClick={() => go({ name: 'training' })}>
            余力があれば2周目へ
          </button>
        )}
        <p className="muted small">
          月曜はじまり。全部消すと +{CONFIG.weekly.clearGold}G（全消し 累計 <strong>{state.weeklyClears}</strong>週）
        </p>
      </section>

      <section className="card">
        <h2>もうすぐ進化</h2>
        {goals.length === 0 ? (
          <p className="muted">
            {owned.length === 0
              ? 'まだモンスターがいません。図鑑でモンスターを登録してから、ショップでタマゴを孵しましょう。'
              : 'みんな育ちきっています！ ショップで新しい仲間を探そう。'}
          </p>
        ) : (
          goals.map(({ mon, def, kind, have, need }) => (
            <button key={mon.id} className="monster-row goal-row" onClick={() => go({ name: 'monster', id: mon.id })}>
              <MonsterImage imageId={imageOf(def, mon.nodeId)} awaken={awakenOf(def, mon.nodeId)} size={56} plus={mon.plus} shiny={mon.shiny} />
              <span className="goal-body">
                <strong>{plusName(def, mon)}</strong> <Stars def={def} nodeId={mon.nodeId} />
                <Gauge value={have} max={need} />
                <span className="muted small">
                  {kind === 'evolve' ? '進化' : `＋${(mon.plus ?? 0) + 1}`}まで あと{Math.max(0, need - have)}EXP
                </span>
              </span>
            </button>
          ))
        )}
        {state.eggs > 0 && (
          <button className="btn wide" onClick={() => go({ name: 'shop' })}>
            タマゴを孵す（{state.eggs}個）
          </button>
        )}
      </section>

      <section className="card">
        <h2>これまでの積み重ね</h2>
        <div className="stats">
          <div>
            <strong>{state.attendance}</strong>
            <span className="muted">回 出席</span>
          </div>
          <div>
            <strong>{state.totalSets}</strong>
            <span className="muted">セット</span>
          </div>
          <div>
            <strong>{state.beatCount}</strong>
            <span className="muted">回 前回超え</span>
          </div>
          <div>
            <strong>{state.weeklyClears}</strong>
            <span className="muted">週 全消し</span>
          </div>
        </div>
        {ATTRS.map((attr) => (
          <div key={attr} className="gauge-row">
            <span>{ATTR_LABEL[attr]}</span>
            <Gauge value={state.lifetimeExp[attr]} max={gaugeMax} color={ATTR_COLOR[attr]} />
            <span className="num">{state.lifetimeExp[attr]}</span>
          </div>
        ))}
        <p className="muted small">属性ごとの累計獲得EXP（筋トレで稼いだ分）</p>
      </section>
    </div>
  )
}
