import { useStore } from '../store'
import { allGimmicks } from '../lib/gimmick'
import { itemInfo, itemLabel, itemOrder } from '../lib/custom'
import { SLOTS, exerciseOfSlot } from '../data/exercises'
import { monArt } from '../lib/art'
import { MonsterImage } from '../components/MonsterImage'
import type { Go } from '../nav'
import { plusName } from '../types'

/** カスタマイズアイテムの一覧：持っているアイテムと、付けている子 */
export function CustomItems({ go }: { go: Go }) {
  const { state, quests, owned, defs, menu } = useStore()
  const names = allGimmicks(quests)
  const held = Object.entries(state.customItems ?? {})
    .filter(([, n]) => n > 0)
    .map(([k]) => k)
    .sort(itemOrder)
  const wearing = owned
    .filter((o) => o.custom)
    .flatMap((mon) => {
      const def = defs.find((d) => d.id === mon.defId)
      return def ? [{ mon, def }] : []
    })
    .sort((a, b) => itemOrder(a.mon.custom!, b.mon.custom!))
  const slotName = (slotId: string) => {
    const s = SLOTS.find((x) => x.id === slotId)
    return s ? exerciseOfSlot(s, menu).name : '？'
  }
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'more' })}>
        ← その他に戻る
      </button>
      <h1 className="title">カスタマイズアイテム</h1>
      <p className="muted small">
        神殿で落ちます。モンスターの詳細の「🛠 カスタマイズ枠」で1体に1つ付けられます。付け直すと前のは消えます（🪄ワクワクステッキを使うと持ち物に戻せます）。
      </p>

      <section className="card">
        <h2>持っているアイテム</h2>
        <p className="small">🪄 ワクワクステッキ {state.sticks ?? 0}本（試練の塔の5階・10階）</p>
        {held.length === 0 ? (
          <p className="muted small">まだありません。クエストの「🏛 神殿」を回ろう。</p>
        ) : (
          <ul className="mini-list">
            {held.map((k) => (
              <li key={k}>
                <span>{itemLabel(k, names)}</span>
                <strong className="num">×{state.customItems![k]}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>付けているモンスター（{wearing.length}体）</h2>
        {wearing.length === 0 ? (
          <p className="muted small">まだいません。</p>
        ) : (
          <ul className="choice-list">
            {wearing.map(({ mon, def }) => (
              <li key={mon.id}>
                <button className="choice" onClick={() => go({ name: 'monster', id: mon.id })}>
                  <span className="monster-row">
                    <MonsterImage {...monArt(def, mon)} size={40} plus={mon.plus} />
                    <span>
                      {plusName(def, mon)}
                      <br />
                      <span className="small">
                        {itemLabel(mon.custom!, names)}
                        {itemInfo(mon.custom!).kind === 'favorite' && mon.customSlot && `：${slotName(mon.customSlot)}`}
                      </span>
                    </span>
                  </span>
                  <span>›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
