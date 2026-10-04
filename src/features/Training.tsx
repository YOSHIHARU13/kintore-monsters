import { useStore } from '../store'
import { BONUS_SLOT, DAYS, DAY_KEYS, dumbbellText, exerciseOfSlot, rangeText, slotsOfDay, type Slot } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { partProgress, slotDone } from '../lib/week'
import { ATTR_COLOR, type Go } from '../nav'
import { MusicButtons } from '../music'

export function Training({ go }: { go: Go }) {
  const { menu, weekSets, todaySets, songs } = useStore()
  const progress = partProgress(weekSets)

  // タスクの枠は今週こなしたセット数、ボーナス枠は今日こなしたセット数
  const slotButton = (slot: Slot) => {
    const ex = exerciseOfSlot(slot, menu)
    const isBonus = slot.day === 'bonus'
    const done = isBonus
      ? Math.min(CONFIG.sets.perExercise, todaySets.filter((s) => s.slotId === slot.id).length)
      : slotDone(weekSets, slot.id)
    const complete = done >= CONFIG.sets.perExercise
    return (
      <li key={slot.id}>
        <button className={`slot${complete ? ' complete' : ''}`} onClick={() => go({ name: 'set', slotId: slot.id })}>
          <div>
            <strong>{ex.name}</strong>
            <div className="muted small">
              {rangeText(ex.id)}
              {ex.weighted ? `・${dumbbellText(ex)}` : ''}
            </div>
            <div className="muted small how">{ex.how}</div>
          </div>
          <span className="slot-count">
            {complete ? '✓ ' : ''}
            {done}/{CONFIG.sets.perExercise}
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="page">
      <MusicButtons />
      {songs.length === 0 && (
        <button className="btn small" onClick={() => go({ name: 'settings' })}>
          🎵 トレーニング中に流す曲を設定する
        </button>
      )}
      <p className="muted small">
        今週のタスクです。どの日に、どの種目からやってもOK。1種目は{CONFIG.sets.perExercise}セットで完了、月曜にリセットされます。
      </p>

      {DAY_KEYS.map((day) => (
        <section className="card" key={day}>
          <div className="part-head">
            <h2 style={{ color: ATTR_COLOR[DAYS[day].attr] }}>{DAYS[day].title}</h2>
            <span className="muted small">
              残り{progress[day].total - progress[day].done}セット
            </span>
            <button className="btn small" onClick={() => go({ name: 'menuEdit', day })}>
              種目を差し替える
            </button>
          </div>
          <ul className="slot-list">{slotsOfDay(day).map(slotButton)}</ul>
        </section>
      ))}

      <section className="card">
        <div className="part-head">
          <h2>ボーナス枠</h2>
          <span className="muted small">タスク外・1日{CONFIG.sets.perExercise}セットまで</span>
          <button className="btn small" onClick={() => go({ name: 'menuEdit', day: 'bonus' })}>
            種目を差し替える
          </button>
        </div>
        <ul className="slot-list">{slotButton(BONUS_SLOT)}</ul>
        <p className="muted small">だるい日は1セットだけでもOK。それも出席1回に数えます。</p>
      </section>

      <button className="btn wide" onClick={() => go({ name: 'cardio' })}>
        サブメニュー（有酸素）を記録
      </button>
    </div>
  )
}
