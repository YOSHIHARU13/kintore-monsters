import { describe, expect, it } from 'vitest'
import { allSeries, inSeries, questSeries, seriesOf } from './series'
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
})
