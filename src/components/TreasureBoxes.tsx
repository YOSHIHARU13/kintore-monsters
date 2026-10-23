import { useEffect, useState } from 'react'
import { BOX_ICON, boxLabel, sumBoxes, type BoxItem, type BoxKind } from '../lib/boxes'
import type { MonsterDef, Quest } from '../types'

/** 宝箱を1つずつ開ける演出（モンスト式）。当たり（降臨はボス、素材クエストはその素材）の箱は金色。タップで全部開く */
export function TreasureBoxes({ boxes, quest, boss, main = 'boss' }: { boxes: BoxItem[]; quest: Pick<Quest, 'element' | 'attr'>; boss: MonsterDef | undefined; main?: BoxKind }) {
  const [open, setOpen] = useState(0)
  useEffect(() => {
    if (open >= boxes.length) return
    const t = setTimeout(() => setOpen((n) => n + 1), open === 0 ? 500 : 380)
    return () => clearTimeout(t)
  }, [open, boxes.length])
  const done = open >= boxes.length
  const sum = sumBoxes(boxes)
  const name = (b: BoxItem) => boxLabel(b.kind, quest, boss?.name)
  return (
    <div className="treasure" onClick={() => setOpen(boxes.length)}>
      <div className="chest-grid">
        {boxes.map((b, i) => (
          <div key={i} className={`chest ${b.kind === main ? 'gold' : 'silver'}${i < open ? ' open' : ''}`}>
            <span className="chest-lid" />
            <span className="chest-body" />
            {i < open && (
              <span className="chest-item">
                <span className="chest-icon">{BOX_ICON[b.kind]}</span>
                <span className="chest-count">
                  {b.kind === 'boss' ? (b.count > 1 ? `${b.count}体` : '') : `×${b.count}`}
                  {b.kind === 'boss' && `運${b.luck ?? b.count}`}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
      {done ? (
        <p className="small treasure-sum">
          {sum.boss > 0 && `👾 ${boss?.name ?? 'ボス'} 運+${sum.luck}　`}
          {boxes
            .filter((b, i) => b.kind !== 'boss' && boxes.findIndex((x) => x.kind === b.kind) === i)
            .map((b) => `${BOX_ICON[b.kind]} ${name(b)} ×${sum[b.kind]}`)
            .join('　')}
        </p>
      ) : (
        <p className="muted small">タップで全部開ける</p>
      )}
    </div>
  )
}
