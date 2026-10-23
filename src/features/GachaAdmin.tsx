import { useStore } from '../store'
import { pickupCount, rateTable } from '../lib/gacha'
import { CONFIG } from '../config/gameConfig'
import type { Go } from '../nav'
import { gachaOpen } from '../lib/gachaSchedule'

/** 開発者メニュー：ガチャの管理（作る・編集する） */
export function GachaAdmin({ go }: { go: Go }) {
  const { gachas, defs, today } = useStore()
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'more' })}>
        ← その他に戻る
      </button>
      <h1 className="title">ガチャの管理</h1>
      <section className="card">
        <button className="btn primary wide" onClick={() => go({ name: 'gachaForm' })}>
          ＋ ガチャを作る
        </button>
        <ul className="mini-list">
          {gachas.map((g) => {
            const table = rateTable(g.id, defs)
            return (
              <li key={g.id}>
                <span>
                  {g.name}
                  <span className="muted small">
                    {' '}
                    全{table.length}種・ピックアップ{pickupCount(table)}
                    {!g.builtin && pickupCount(table) < CONFIG.gacha.minPickups && '（準備中）'}
                    {!g.builtin && (gachaOpen(g, today).label || (gachaOpen(g, today).open ? '' : '・開催していない'))}
                  </span>
                </span>
                <button className="btn small" onClick={() => go({ name: 'gachaForm', id: g.id })}>
                  編集
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
