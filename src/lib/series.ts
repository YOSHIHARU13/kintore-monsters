import type { MonsterDef, Quest } from '../types'
import type { Rate } from './gacha'

/** シリーズ（コラボ名）。空なら通常 */
export const seriesOf = (def: Pick<MonsterDef, 'series'> | undefined): string => def?.series?.trim() ?? ''

/** 登録されているシリーズ（登録順） */
export function allSeries(defs: MonsterDef[]): string[] {
  return [...new Set(defs.map(seriesOf).filter((s) => s !== ''))]
}

/** クエストのシリーズは、ボスのモンスターのシリーズ */
export function questSeries(quest: Pick<Quest, 'bossDefId'>, defs: MonsterDef[]): string {
  return seriesOf(defs.find((d) => d.id === quest.bossDefId))
}

/** 絞り込み：'all' なら全部、'' なら通常、それ以外はそのシリーズ */
export type SeriesFilter = 'all' | string
export const inSeries = (filter: SeriesFilter, series: string) => filter === 'all' || filter === series

/** コラボの開催期間（どちらも YYYY-MM-DD・その日を含む）。期間がなければいつでも */
export interface Period {
  start: string
  end: string
}
export type Periods = Record<string, Period>

export type SeriesStatus =
  | { kind: 'always' } // 通常・期間なし
  | { kind: 'active'; daysLeft: number } // 開催中（あと何日。最終日は1）
  | { kind: 'upcoming'; daysUntil: number }
  | { kind: 'ended' }

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000)

export function seriesStatus(series: string, periods: Periods, today: string): SeriesStatus {
  const p = series ? periods[series] : undefined
  if (!p?.start || !p?.end) return { kind: 'always' }
  if (today < p.start) return { kind: 'upcoming', daysUntil: days(today, p.start) }
  if (today > p.end) return { kind: 'ended' }
  return { kind: 'active', daysLeft: days(today, p.end) + 1 }
}

/** ガチャのシリーズ：激レアのピックアップが全員同じシリーズならそれ（混ざっていれば通常） */
export function gachaSeries(table: Rate[]): string {
  const names = [...new Set(table.filter((t) => t.rarity === 'superRare').map((t) => seriesOf(t.def)))]
  return names.length === 1 ? names[0] : ''
}

/** 開催状況の短い表示（例：開催中 あと3日） */
export function statusLabel(st: SeriesStatus): string {
  if (st.kind === 'active') return `開催中 あと${st.daysLeft}日`
  if (st.kind === 'upcoming') return `あと${st.daysUntil}日で開催`
  if (st.kind === 'ended') return '開催終了'
  return ''
}
