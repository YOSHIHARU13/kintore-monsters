import { useStore } from '../store'
import { allSeries, seriesStatus } from '../lib/series'
import type { Go } from '../nav'

/** 開催中のコラボと、近日開催（予約済み）のコラボのお知らせ */
export function CollabNews({ go }: { go?: Go }) {
  const { defs, seriesPeriods, today } = useStore()
  const news = allSeries(defs)
    .map((name) => ({ name, st: seriesStatus(name, seriesPeriods, today) }))
    .filter(({ st }) => st.kind === 'active' || st.kind === 'upcoming')
  if (news.length === 0) return null
  return (
    <>
      {news.map(({ name, st }) => {
        const start = seriesPeriods[name]?.start ?? ''
        return (
          <button key={name} className={`collab-now${st.kind === 'active' ? ' on' : ''}`} onClick={() => go?.({ name: 'shop' })}>
            {st.kind === 'active'
              ? `🤝 ${name}コラボ 開催中！ あと${st.daysLeft}日`
              : `📅 ${name}コラボ ${Number(start.slice(5, 7))}/${Number(start.slice(8))}から開催！ あと${st.kind === 'upcoming' ? st.daysUntil : 0}日`}
          </button>
        )
      })}
    </>
  )
}
