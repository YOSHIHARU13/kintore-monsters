import { useStore } from '../store'
import { BONUS_SLOT, DAYS, EXERCISES, exerciseOfSlot, rangeText, slotsOfDay, type DayKey } from '../data/exercises'
import type { Go } from '../nav'

export function MenuEdit({ day, go }: { day: DayKey; go: Go }) {
  const { menu, setSlot } = useStore()

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'training', day })}>
        ← メニューに戻る
      </button>
      <h1 className="title">
        種目の差し替え（{DAYS[day].label}・{DAYS[day].title}）
      </h1>
      <p className="muted small">枠は固定で、各枠の種目だけを候補から選べます。</p>

      {[...slotsOfDay(day), BONUS_SLOT].map((slot, index) => {
        const current = exerciseOfSlot(slot, menu)
        return (
          <section className="card" key={slot.id}>
            <h2>{slot.day === 'bonus' ? 'ボーナス枠' : `枠${index + 1}`}</h2>
            <ul className="choice-list">
              {slot.candidates.map((id) => (
                <li key={id}>
                  <button className={`choice${id === current.id ? ' on' : ''}`} onClick={() => setSlot(slot.id, id)}>
                    <span>{EXERCISES[id].name}</span>
                    <span className="muted small">{rangeText(id)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
