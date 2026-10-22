import { useStore } from '../store'
import { allTags } from '../lib/tags'

/** タグで絞り込むチップ（'' なら全部）。タグが1つもなければ出さない */
export function TagChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { defs } = useStore()
  const list = allTags(defs)
  if (list.length === 0) return null
  return (
    <div className="chips" role="group" aria-label="タグで絞り込み">
      <button type="button" className={`chip small${value === '' ? ' on' : ''}`} onClick={() => onChange('')}>
        全タグ
      </button>
      {list.map((t) => (
        <button key={t} type="button" className={`chip small${value === t ? ' on' : ''}`} onClick={() => onChange(value === t ? '' : t)}>
          🏷️{t}
        </button>
      ))}
    </div>
  )
}
