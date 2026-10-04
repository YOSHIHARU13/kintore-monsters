import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, FORM_ATTR_LABEL, DAYS, DAY_KEYS, exerciseOfSlot, slotsOfDay } from '../data/exercises'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { CONFIG } from '../config/gameConfig'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName, nodeAttr } from '../types'
import { isWeekCleared, partProgress, slotDone } from '../lib/week'

export function Home({ go }: { go: Go }) {
  const { state, menu, weekSets, defs, owned } = useStore()
  const gaugeMax = Math.max(100, ...ATTRS.map((a) => state.lifetimeExp[a]))
  const active = owned.find((o) => o.id === state.activeMonsterId) ?? owned[0]
  const activeDef = active && defs.find((d) => d.id === active.defId)
  const progress = partProgress(weekSets)
  const remaining = DAY_KEYS.reduce((sum, day) => sum + progress[day].total - progress[day].done, 0)

  return (
    <div className="page">
      <section className="card">
        <h2>今週の残りタスク：{isWeekCleared(weekSets) ? '全消し達成！' : `あと${remaining}セット`}</h2>
        <p className="muted small">
          月曜はじまり。好きな日に、好きな順番で。全部消すと +{CONFIG.weekly.clearGold}G（全消し 累計{' '}
          <strong>{state.weeklyClears}</strong>週）
        </p>
        <div className="part-summary">
          {DAY_KEYS.map((day) => (
            <span key={day} style={{ color: ATTR_COLOR[DAYS[day].attr] }}>
              {DAYS[day].title}{' '}
              <strong className="num">
                {progress[day].slotsDone}/{progress[day].slots}
              </strong>
            </span>
          ))}
        </div>
        {DAY_KEYS.map((day) => {
          const { done, total, slotsDone, slots } = progress[day]
          return (
            <div key={day} className="part">
              <div className="gauge-row">
                <span style={{ color: ATTR_COLOR[DAYS[day].attr] }}>
                  {DAYS[day].title}{' '}
                  <strong className="num">
                    {slotsDone}/{slots}
                  </strong>
                </span>
                <Gauge value={done} max={total} color={ATTR_COLOR[DAYS[day].attr]} />
                <span className="num">{done === total ? '✓ 完了' : `残り${total - done}セット`}</span>
              </div>
              <ul className="slot-list">
                {slotsOfDay(day).map((slot) => {
                  const ex = exerciseOfSlot(slot, menu)
                  const slotSets = slotDone(weekSets, slot.id)
                  const complete = slotSets >= CONFIG.sets.perExercise
                  return (
                    <li key={slot.id}>
                      <button
                        className={`slot task${complete ? ' complete' : ''}`}
                        onClick={() => go({ name: 'set', slotId: slot.id })}
                      >
                        <span>{ex.name}</span>
                        <span className="slot-count">
                          {complete ? '✓ ' : ''}
                          {slotSets}/{CONFIG.sets.perExercise}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
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

      <button className="btn ghost wide" onClick={() => signOut(auth)}>
        ログアウト
      </button>
    </div>
  )
}
