import type { Gacha } from '../types'
import type { SeriesStatus } from './series'

/**
 * ガチャの開催：いつでも／日付で決める（終わっても日付を入れ直せば復刻）／毎月◯日〜◯日（超筋肉祭など）。
 * 決めていなければ、コラボのガチャはコラボの開催期間に、それ以外はいつでも
 */
export type GachaSchedule =
  | { kind: 'always' }
  | { kind: 'range'; start: string; end: string } // YYYY-MM-DD（その日を含む）
  | { kind: 'monthly'; from: number; to: number } // 毎月 from 日〜to 日

export interface GachaOpen {
  open: boolean
  label: string // 例：あと3日・11/1から・毎月10〜20日
}

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000)

/** 今日、そのガチャが引けるか */
export function gachaOpen(gacha: Pick<Gacha, 'schedule' | 'builtin'>, today: string, series?: SeriesStatus): GachaOpen {
  const s = gacha.schedule
  if (gacha.builtin || !s) {
    if (series && series.kind === 'upcoming') return { open: false, label: '近日開催' }
    if (series && series.kind === 'ended') return { open: false, label: '開催終了' }
    if (series && series.kind === 'active') return { open: true, label: `あと${series.daysLeft}日` }
    return { open: true, label: '' }
  }
  if (s.kind === 'always') return { open: true, label: '' }
  if (s.kind === 'range') {
    if (today < s.start) return { open: false, label: `${md(s.start)}から` }
    if (today > s.end) return { open: false, label: '開催終了' }
    return { open: true, label: `あと${days(today, s.end) + 1}日` }
  }
  const d = Number(today.slice(8, 10))
  if (d >= s.from && d <= s.to) return { open: true, label: `あと${s.to - d + 1}日（毎月${s.from}〜${s.to}日）` }
  return { open: false, label: `毎月${s.from}〜${s.to}日` }
}
