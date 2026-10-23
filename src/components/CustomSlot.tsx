import { useState } from 'react'
import { useStore } from '../store'
import { FAVORITE_SLOTS, SLOTS, exerciseOfSlot } from '../data/exercises'
import { allGimmicks } from '../lib/gimmick'
import { itemInfo, itemLabel, itemOrder } from '../lib/custom'
import type { MonsterDef, OwnedMonster } from '../types'

/** カスタマイズ枠：神殿のアイテムを1つ付けられる。付け直すと前のは消える（ワクワクステッキなら持ち物に戻る） */
export function CustomSlot({ mon, def }: { mon: OwnedMonster; def: MonsterDef }) {
  const { state, quests, menu, attachCustom, removeCustom } = useStore()
  const [picked, setPicked] = useState<string | null>(null) // 付けようとしているアイテム
  const [slot, setSlot] = useState<string | null>(null) // 「得意種目の追加」で選んだ種目
  const names = allGimmicks(quests)
  const sticks = state.sticks ?? 0
  const items = Object.entries(state.customItems ?? {})
    .filter(([, n]) => n > 0)
    .map(([k]) => k)
    .sort(itemOrder)
  const slotName = (slotId: string) => {
    const s = SLOTS.find((x) => x.id === slotId)
    return s ? exerciseOfSlot(s, menu).name : '？'
  }
  const current = mon.custom ? itemInfo(mon.custom, names) : null
  const wasted =
    (current?.kind === 'ability' && (def.abilities ?? []).includes(current.ability ?? '')) ||
    (current?.kind === 'favorite' && mon.customSlot === def.favoriteSlot)
  const pickedInfo = picked ? itemInfo(picked, names) : null
  const needSlot = pickedInfo?.kind === 'favorite'
  const ready = picked && (!needSlot || slot)

  const attach = (useStick: boolean) => {
    if (!picked) return
    attachCustom(mon.id, picked, needSlot ? (slot ?? undefined) : undefined, useStick)
    setPicked(null)
    setSlot(null)
  }

  return (
    <details className="card fold" open={!!mon.custom || items.length > 0}>
      <summary>
        <h2>🛠 カスタマイズ枠</h2>
      </summary>
      <p>
        {current ? (
          <>
            <strong>{itemLabel(mon.custom!, names)}</strong>
            {current.kind === 'favorite' && mon.customSlot && `：${slotName(mon.customSlot)}`}
            {wasted && <span className="warn small">（もともと持っているので効果なし）</span>}
          </>
        ) : (
          <span className="muted">空き</span>
        )}
      </p>
      {current && (
        <button className="btn small ghost" disabled={sticks < 1} onClick={() => removeCustom(mon.id)}>
          🪄 外して持ち物に戻す（ワクワクステッキ {sticks}本）
        </button>
      )}
      {items.length === 0 ? (
        <p className="muted small">神殿でカスタマイズアイテムを集めよう（攻撃力アップ・得意種目の追加・アビリティの追加）。</p>
      ) : (
        <ul className="mini-list">
          {items.map((k) => (
            <li key={k}>
              <span>
                {itemLabel(k, names)} ×{state.customItems![k]}
              </span>
              <button className={`btn small${picked === k ? ' primary' : ''}`} onClick={() => setPicked(picked === k ? null : k)}>
                付ける
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && needSlot && (
        <div className="field">
          得意種目にする種目
          <div className="chips" role="group" aria-label="得意種目にする種目">
            {FAVORITE_SLOTS.filter((s) => s.id !== def.favoriteSlot).map((s) => (
              <button key={s.id} type="button" className={`chip${slot === s.id ? ' on' : ''}`} onClick={() => setSlot(s.id)}>
                {slotName(s.id)}
              </button>
            ))}
          </div>
        </div>
      )}
      {ready &&
        (mon.custom ? (
          <div className="row wrap">
            <button className="btn small" onClick={() => attach(false)}>
              前の{itemLabel(mon.custom, names)}を消して付ける
            </button>
            <button className="btn small primary" disabled={sticks < 1} onClick={() => attach(true)}>
              🪄 前のを持ち物に戻して付ける（ステッキ {sticks}本）
            </button>
          </div>
        ) : (
          <button className="btn primary wide" onClick={() => attach(false)}>
            {itemLabel(picked!, names)} を付ける
          </button>
        ))}
    </details>
  )
}
