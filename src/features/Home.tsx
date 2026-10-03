import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useStore } from '../store'
import {
  ATTRS,
  ATTR_LABEL,
  FORM_ATTR_LABEL,
  BONUS_SLOT,
  DAYS,
  DAY_KEYS,
  dayKeyOfDate,
  exerciseOfSlot,
  slotsOfDay,
} from '../data/exercises'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { CONFIG } from '../config/gameConfig'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName, nodeAttr } from '../types'

export function Home({ go }: { go: Go }) {
  const { state, menu, todaySets, defs, owned, today } = useStore()
  const todayDay = dayKeyOfDate(new Date(`${today}T12:00:00`))
  const gaugeMax = Math.max(100, ...ATTRS.map((a) => state.lifetimeExp[a]))

  const active = owned.find((o) => o.id === state.activeMonsterId) ?? owned[0]
  const activeDef = active && defs.find((d) => d.id === active.id)

  const doneCount = (exerciseId: string) =>
    Math.min(CONFIG.sets.perExercise, todaySets.filter((s) => s.exerciseId === exerciseId).length)

  return (
    <div className="page">
      <section className="card">
        {todayDay ? (
          <>
            <h2>
              今日のメニュー：{DAYS[todayDay].label}曜・{DAYS[todayDay].title}
            </h2>
            <ul className="mini-list">
              {[...slotsOfDay(todayDay), BONUS_SLOT].map((slot) => {
                const ex = exerciseOfSlot(slot, menu)
                return (
                  <li key={slot.id}>
                    <span>{ex.name}</span>
                    <span className="muted">
                      {doneCount(ex.id)}/{CONFIG.sets.perExercise}
                    </span>
                  </li>
                )
              })}
            </ul>
            <button className="btn primary wide" onClick={() => go({ name: 'training', day: todayDay })}>
              トレーニング開始
            </button>
          </>
        ) : (
          <>
            <h2>今日はお休みの日</h2>
            <p className="muted">やりたい日は、好きなメニューを選べます。</p>
            <div className="row">
              {DAY_KEYS.map((day) => (
                <button key={day} className="btn" onClick={() => go({ name: 'training', day })}>
                  {DAYS[day].title}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="btn wide" onClick={() => go({ name: 'cardio' })}>
          サブメニュー（有酸素）を記録
        </button>
      </section>

      <section className="card">
        <h2>所持</h2>
        <div className="wallet">
          {ATTRS.map((attr) => (
            <div key={attr} className="wallet-item">
              <span className="label" style={{ color: ATTR_COLOR[attr] }}>
                {ATTR_LABEL[attr]}EXP
              </span>
              <strong>{state.exp[attr].trained + state.exp[attr].bought}</strong>
              {state.exp[attr].bought > 0 && <span className="muted small">うち購入 {state.exp[attr].bought}</span>}
            </div>
          ))}
          <div className="wallet-item">
            <span className="label gold">ゴールド</span>
            <strong>{state.gold}G</strong>
          </div>
          <div className="wallet-item">
            <span className="label">タマゴ</span>
            <strong>{state.eggs}個</strong>
          </div>
        </div>
        {state.eggs > 0 && (
          <button className="btn wide" onClick={() => go({ name: 'shop' })}>
            タマゴを孵す
          </button>
        )}
      </section>

      <section className="card">
        <h2>育成中のモンスター</h2>
        {active && activeDef ? (
          <button className="monster-row" onClick={() => go({ name: 'monster', id: active.id })}>
            <MonsterImage imageId={activeDef.images[active.nodeId]} size={88} />
            <div>
              <strong>{monsterName(activeDef, active.nodeId)}</strong>
              <div className="muted">
                {FORM_ATTR_LABEL[nodeAttr(activeDef, active.nodeId)]}・{getNode(getTemplate(activeDef.templateId), active.nodeId).label}
              </div>
            </div>
          </button>
        ) : (
          <p className="muted">
            まだモンスターがいません。図鑑でモンスターを登録してから、ショップでタマゴを孵しましょう。
          </p>
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

      <button className="btn ghost wide" onClick={() => signOut(auth)}>
        ログアウト
      </button>
    </div>
  )
}
