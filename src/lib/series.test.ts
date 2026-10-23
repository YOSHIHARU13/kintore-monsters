import { describe, expect, it } from 'vitest'
import { allSeries, gachaSeries, inSeries, questSeries, seriesOf, seriesStatus } from './series'
import type { MonsterDef } from '../types'

const def = (id: string, series?: string) => ({ id, name: id, templateId: 'single', images: {}, createdAt: 0, series }) as MonsterDef

describe('シリーズ（コラボ）', () => {
  it('モンスターのシリーズで分け、クエストはボスのシリーズになる', () => {
    const defs = [def('a'), def('b', '鬼退治コラボ'), def('c', '鬼退治コラボ'), def('d', ' 夏 ')]
    expect(allSeries(defs)).toEqual(['鬼退治コラボ', '夏'])
    expect(seriesOf(defs[0])).toBe('')
    expect(questSeries({ bossDefId: 'b' }, defs)).toBe('鬼退治コラボ')
    expect(inSeries('all', '夏')).toBe(true)
    expect(inSeries('', '夏')).toBe(false)
    expect(inSeries('', '')).toBe(true)
  })
  it('開催期間：開催中・開催前・終了。期間がなければいつでも', () => {
    const periods = { 鬼: { start: '2026-10-20', end: '2026-10-25' } }
    expect(seriesStatus('鬼', periods, '2026-10-23')).toEqual({ kind: 'active', daysLeft: 3 })
    expect(seriesStatus('鬼', periods, '2026-10-25')).toEqual({ kind: 'active', daysLeft: 1 })
    expect(seriesStatus('鬼', periods, '2026-10-18')).toEqual({ kind: 'upcoming', daysUntil: 2 })
    expect(seriesStatus('鬼', periods, '2026-10-26')).toEqual({ kind: 'ended' })
    expect(seriesStatus('夏', periods, '2026-10-26')).toEqual({ kind: 'always' })
    expect(seriesStatus('', periods, '2026-10-26')).toEqual({ kind: 'always' })
  })
  it('ガチャのシリーズは、激レアのピックアップが全員同じときだけ', () => {
    const r = (s: string | undefined, rarity: 'superRare' | 'normal') => ({ def: def('x', s), rarity, rate: 0 })
    expect(gachaSeries([r('鬼', 'superRare'), r('鬼', 'superRare'), r(undefined, 'normal')])).toBe('鬼')
    expect(gachaSeries([r('鬼', 'superRare'), r(undefined, 'superRare')])).toBe('')
  })
})

describe('コラボの表示名', () => {
  it('名前がもう「コラボ」で終わっていれば、二重にしない', async () => {
    const { collabLabel } = await import('./series')
    expect(collabLabel('遊戯王')).toBe('遊戯王コラボ')
    expect(collabLabel('遊戯王コラボ')).toBe('遊戯王コラボ')
  })
})
