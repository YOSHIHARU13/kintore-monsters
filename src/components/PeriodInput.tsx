import { useStore } from '../store'
import { seriesStatus, statusLabel } from '../lib/series'

/** コラボの開催期間（開始日〜終了日）。片方ずつ入れても保存され、両方そろうと有効 */
export function PeriodInput({ series }: { series: string }) {
  const { seriesPeriods, saveSeriesPeriod, today } = useStore()
  const p = seriesPeriods[series]
  const save = (start: string, end: string) => saveSeriesPeriod(series, start || end ? { start, end } : null)
  return (
    <span className="period-input">
      <span className="row wrap">
        <input type="date" value={p?.start ?? ''} onChange={(e) => save(e.target.value, p?.end ?? '')} aria-label={`${series}の開始日`} />
        〜
        <input type="date" value={p?.end ?? ''} onChange={(e) => save(p?.start ?? '', e.target.value)} aria-label={`${series}の終了日`} />
      </span>
      <span className="muted small">{statusLabel(seriesStatus(series, seriesPeriods, today)) || 'ずっと開催（日付を入れると期間限定）'}</span>
    </span>
  )
}
