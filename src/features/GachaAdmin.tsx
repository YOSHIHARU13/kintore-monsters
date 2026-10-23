import { useStore } from '../store'
import { pickupCount, rateTable } from '../lib/gacha'
import { CONFIG } from '../config/gameConfig'
import type { Go } from '../nav'
import { gachaOpen, periodText, thinDays } from '../lib/gachaSchedule'
import { gachaSeries, seriesStatus } from '../lib/series'

/** 開発者メニュー：ガチャの管理（作る・編集する） */
export function GachaAdmin({ go }: { go: Go }) {
  const { gachas, defs, today, seriesPeriods } = useStore()
  // いつでも期間限定のガチャが minOpen 種類あるか（いつものガチャは数えない）
  const limited = gachas.filter((g) => !g.builtin)
  const countOn = (day: string) =>
    limited.filter((g) => gachaOpen(g, day, seriesStatus(gachaSeries(rateTable(g.id, defs)), seriesPeriods, day)).open).length
  const gaps = thinDays(countOn, today, CONFIG.gacha.planDays, CONFIG.gacha.minOpen)
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'more' })}>
        ← その他に戻る
      </button>
      <h1 className="title">ガチャの管理</h1>
      <section className="card">
        <h2>📅 開催の予定（{CONFIG.gacha.planDays}日）</h2>
        {gaps.length === 0 ? (
          <p className="small">いつでも期間限定のガチャが{CONFIG.gacha.minOpen}種類以上開いています。</p>
        ) : (
          <>
            <p className="warn small">期間限定のガチャが{CONFIG.gacha.minOpen}種類に足りない日があります。ガチャの「開催」を入れてください：</p>
            <ul className="mini-list">
              {gaps.map((p) => (
                <li key={p.start}>
                  <span className="small">
                    {periodText(p)}：{p.count}種類
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
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
