import type { MonsterDef, Quest } from '../types'

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
