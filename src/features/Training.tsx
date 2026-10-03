import { useStore } from '../store'
import {
  BONUS_SLOT,
  DAYS,
  DAY_KEYS,
  dayKeyOfDate,
  exerciseOfSlot,
  rangeText,
  slotsOfDay,
  type DayKey,
} from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import type { Go } from '../nav'
import { MusicButtons } from '../music'

export function Training({ day: dayProp, go }: { day?: DayKey; go: Go }) {
  const { menu, todaySets, today, songs } = useStore()
  const day = dayProp ?? dayKeyOfDate(new Date(`${today}T12:00:00`)) ?? 'mon'

  return (
    <div className="page">
      <div className="chips">
        {DAY_KEYS.map((k) => (
          <button key={k} className={`chip${k === day ? ' on' : ''}`} onClick={() => go({ name: 'training', day: k })}>
            {DAYS[k].label}・{DAYS[k].title}
          </button>
        ))}
      </div>

      <MusicButtons />
      {songs.length === 0 && (
        <button className="btn small" onClick={() => go({ name: 'settings' })}>
          🎵 トレーニング中に流す曲を設定する
        </button>
      )}

      <section className="card">
        <ul className="slot-list">
          {[...slotsOfDay(day), BONUS_SLOT].map((slot) => {
            const ex = exerciseOfSlot(slot, menu)
            const done = todaySets.filter((s) => s.exerciseId === ex.id).length
            const complete = done >= CONFIG.sets.perExercise
            return (
              <li key={slot.id}>
                <button
                  className={`slot${complete ? ' complete' : ''}`}
                  onClick={() => go({ name: 'set', day, slotId: slot.id })}
                >
                  <div>
                    <strong>{ex.name}</strong>
                    <div className="muted small">
                      {slot.day === 'bonus' ? 'ボーナス枠・' : ''}
                      {rangeText(ex.id)}
                    </div>
                    <div className="muted small how">{ex.how}</div>
                  </div>
                  <span className="slot-count">
                    {complete ? '✓ ' : ''}
                    {Math.min(done, CONFIG.sets.perExercise)}/{CONFIG.sets.perExercise}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="muted small">だるい日は1種目だけでもOK。それも出席1回に数えます。</p>
      </section>

      <button className="btn wide" onClick={() => go({ name: 'menuEdit', day })}>
        種目を差し替える
      </button>
      <button className="btn wide" onClick={() => go({ name: 'cardio' })}>
        サブメニュー（有酸素）を記録
      </button>
    </div>
  )
}
