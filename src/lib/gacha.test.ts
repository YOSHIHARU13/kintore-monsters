import { describe, expect, it } from 'vitest'
import { percent, pickFrom, rateTable } from './gacha'
import type { Gacha, MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'none', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})
const gacha: Gacha = {
  id: 'g1', name: 'テスト', bannerImageId: null, shinyRate: 0.05, rarity: { b: 'rare', c: 'superRare' }, createdAt: 0, builtin: false,
}

describe('ガチャ', () => {
  const defs = [
    def('a', { gachas: ['g1'] }),
    def('b', { gachas: ['g1', 'g2'] }),
    def('c', { gachas: ['g1'] }),
    def('x', { gachas: ['g2'] }), // 別のガチャ
    def('z', { common: true }), // ハズレ枠
    def('h', { gachas: ['g1'], recipe: ['a', 'b'] }), // 隠しモンスターは出ない
    def('n'), // どこにも入れていない → いつものガチャ
  ]

  it('中身はそのガチャのモンスターとハズレ枠。確率はレア度の重みで決まる', () => {
    const table = rateTable(gacha, defs)
    expect(table.map((r) => r.def.id)).toEqual(['a', 'b', 'c', 'z'])
    const rate = Object.fromEntries(table.map((r) => [r.def.id, r.rate]))
    expect(rate.a).toBeCloseTo(10 / 24)
    expect(rate.b).toBeCloseTo(3 / 24)
    expect(rate.c).toBeCloseTo(1 / 24)
    expect(rate.z).toBeCloseTo(10 / 24)
  })

  it('どこにも入れていないモンスターは、いつものガチャに入る', () => {
    const builtin = { ...gacha, id: 'default', rarity: {} }
    expect(rateTable(builtin, defs).map((r) => r.def.id)).toEqual(['z', 'n'])
  })

  it('確率どおりに選ぶ', () => {
    const table = rateTable(gacha, defs)
    expect(pickFrom(table, 0)?.id).toBe('a')
    expect(pickFrom(table, 10 / 24 + 0.001)?.id).toBe('b')
    expect(pickFrom(table, 13 / 24 + 0.001)?.id).toBe('c')
    expect(pickFrom(table, 0.9999)?.id).toBe('z')
    expect(pickFrom([], 0.5)).toBeNull()
  })

  it('確率の表示', () => {
    expect(percent(0.5)).toBe('50%')
    expect(percent(10 / 21)).toBe('47.6%')
    expect(percent(1 / 21)).toBe('4.76%')
    expect(percent(0.05)).toBe('5%')
  })
})
