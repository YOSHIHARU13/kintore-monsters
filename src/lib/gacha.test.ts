import { describe, expect, it } from 'vitest'
import { draw, isPity, percent, pickFrom, rateTable, starsOf, tierRates } from './gacha'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'none', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})

describe('ガチャ', () => {
  const defs = [
    def('h1', { rarity: 'hazure' }),
    def('h2', { common: true }), // 旧形式のハズレ枠もハズレ
    def('n1'), // レア度なし → ノーマル（どのガチャからも出る）
    def('r1', { rarity: 'rare', gachas: ['g1'] }),
    def('s1', { rarity: 'superRare', gachas: ['g1', 'g2'] }),
    def('s2', { rarity: 'superRare', gachas: ['g2'] }), // 別のガチャ
    def('x', { rarity: 'superRare', gachas: ['g1'], recipe: ['h1', 'n1'] }), // 隠しモンスターは出ない
    def('d1', { rarity: 'rare' }), // ガチャを選んでいないレア → いつものガチャ
  ]

  it('レア度ごとの確率を、同じレア度のモンスターで山分けする', () => {
    const table = rateTable('g1', defs)
    expect(table.map((r) => r.def.id)).toEqual(['h1', 'h2', 'n1', 'r1', 's1'])
    const rate = Object.fromEntries(table.map((r) => [r.def.id, r.rate]))
    expect(rate.h1).toBeCloseTo(0.25)
    expect(rate.h2).toBeCloseTo(0.25)
    expect(rate.n1).toBeCloseTo(0.35)
    expect(rate.r1).toBeCloseTo(0.12)
    expect(rate.s1).toBeCloseTo(0.03)
    expect(tierRates(table).map((t) => t.count)).toEqual([2, 1, 1, 1])
  })

  it('いないレア度の確率は、いるレア度に比率のまま回す', () => {
    const table = rateTable('default', defs) // ハズレ・ノーマル・レア（d1）だけ
    expect(table.map((r) => r.def.id)).toEqual(['h1', 'h2', 'n1', 'd1'])
    const total = 0.5 + 0.35 + 0.12
    expect(table.find((r) => r.def.id === 'd1')!.rate).toBeCloseTo(0.12 / total)
    expect(table.reduce((sum, r) => sum + r.rate, 0)).toBeCloseTo(1)
  })

  it('確率どおりに選ぶ', () => {
    const table = rateTable('g1', defs)
    expect(pickFrom(table, 0)?.id).toBe('h1')
    expect(pickFrom(table, 0.6)?.id).toBe('n1')
    expect(pickFrom(table, 0.9)?.id).toBe('r1')
    expect(pickFrom(table, 0.99)?.id).toBe('s1')
    expect(pickFrom([], 0.5)).toBeNull()
  })

  it('天井：激レアが出ないまま30回目は激レア確定（激レアがいないガチャでは起きない）', () => {
    const table = rateTable('g1', defs)
    expect(isPity(28, table)).toBe(false)
    expect(isPity(29, table)).toBe(true)
    expect(draw(table, 29, 0)?.id).toBe('s1')
    expect(draw(table, 0, 0)?.id).toBe('h1')
    expect(isPity(29, rateTable('default', defs))).toBe(false)
  })

  it('確率の表示', () => {
    expect(percent(0.5)).toBe('50%')
    expect(percent(10 / 17)).toBe('58.8%')
    expect(percent(0.03)).toBe('3%')
    expect(percent(1 / 21)).toBe('4.76%')
  })

  it('星：生まれたときはレア度で決まり、進化ごとに+1。ジョグレスは最終形態で★7', () => {
    expect(starsOf(def('a', { rarity: 'hazure', templateId: 'early2' }), 'n2')).toBe(2)
    expect(starsOf(def('a'), 'n1')).toBe(2)
    expect(starsOf(def('a'), 'n3')).toBe(4)
    expect(starsOf(def('a', { rarity: 'rare', templateId: 'lateBranch' }), 'n3b')).toBe(5)
    expect(starsOf(def('a', { rarity: 'superRare' }), 'n1')).toBe(4)
    expect(starsOf(def('a', { rarity: 'superRare' }), 'n3')).toBe(6)
    expect(starsOf(def('a', { recipe: ['x', 'y'], templateId: 'single' }), 'n1')).toBe(7)
    expect(starsOf(def('a', { recipe: ['x', 'y'] }), 'n1')).toBe(5) // 3段のジョグレスは 5 → 6 → 7
  })
})
