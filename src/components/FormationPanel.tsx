import { CONFIG } from '../config/gameConfig'
import { tagLabel, type Formation } from '../lib/formation'

/** 求められる編成のメーター。条件ごとに「■■□ 2/3」、最後に編成倍率 */
export function FormationPanel({ formation, names }: { formation: Formation; names: Record<string, string> }) {
  if (formation.rows.length === 0) {
    return <p className="muted small">このクエストには編成の条件がありません（編成倍率 ×1.0）。</p>
  }
  return (
    <div className="formation">
      {formation.rows.map((r) => {
        const done = r.have >= r.need
        const extra = r.have - r.need
        return (
          <div key={r.tag} className={`formation-row${done ? ' done' : ''}`}>
            <span className="formation-tag">{tagLabel(r.tag, names)}</span>
            <span className="formation-meter" aria-hidden="true">
              {Array.from({ length: Math.max(r.need, r.have) }, (_, i) => (
                <i key={i} className={i < r.have ? (i < r.need ? 'on' : 'extra') : ''} />
              ))}
            </span>
            <span className="num formation-count">
              {r.have}/{r.need}
              {done && ' ✓'}
              {extra > 0 && `+${extra}`}
            </span>
          </div>
        )
      })}
      <div className="formation-rate">
        編成倍率 <strong>×{formation.rate.toFixed(2)}</strong>
        <span className="muted small">
          （何もなし×{CONFIG.formation.base}・ちょうど×1.0・超えた分は1つ+{CONFIG.formation.perExtra}）
        </span>
      </div>
    </div>
  )
}
