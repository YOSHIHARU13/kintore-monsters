import { useStore } from '../store'
import { allSeries, type SeriesFilter } from '../lib/series'

/** シリーズ（コラボ）で絞り込むチップ。シリーズが1つもなければ出さない */
export function SeriesChips({ value, onChange }: { value: SeriesFilter; onChange: (v: SeriesFilter) => void }) {
  const { defs } = useStore()
  const list = allSeries(defs)
  if (list.length === 0) return null
  const options: [SeriesFilter, string][] = [['all', '全シリーズ'], ['', '通常'], ...list.map((s): [string, string] => [s, s])]
  return (
    <div className="chips" role="group" aria-label="シリーズで絞り込み">
      {options.map(([v, label]) => (
        <button key={`s-${v}`} type="button" className={`chip small${value === v ? ' on' : ''}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}
