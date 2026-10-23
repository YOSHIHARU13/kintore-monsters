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
    def('r1', { rarity: 'rare', gachas: ['g1'] }), // 以前の「レア」は激レアとして扱う
    def('s1', { rarity: 'superRare', gachas: ['g1', 'g2'] }),
    def('s2', { rarity: 'superRare', gachas: ['g2'] }), // 別のガチャ
    def('x', { rarity: 'superRare', gachas: ['g1'], recipe: ['h1', 'n1'] }), // 隠しモンスターは出ない
    def('d1', { rarity: 'superRare' }), // ガチャを選んでいない激レア → いつものガチャ
  ]

  it('レア度ごとの確率を、同じレア度のモンスターで山分けする', () => {
    const table = rateTable('g1', defs)
    expect(table.map((r) => r.def.id)).toEqual(['h1', 'h2', 'n1', 'r1', 's1'])
    const rate = Object.fromEntries(table.map((r) => [r.def.id, r.rate]))
    // ハズレ38%・ノーマル32%・レア18%・激レア12%。このガチャにはレアがいないので、残り82%で割り直す
    expect(rate.h1).toBeCloseTo(0.38 / 0.82 / 2)
    expect(rate.h2).toBeCloseTo(0.38 / 0.82 / 2)
    expect(rate.n1).toBeCloseTo(0.32 / 0.82)
    expect(rate.r1).toBeCloseTo(0.12 / 0.82 / 2)
    expect(rate.s1).toBeCloseTo(0.12 / 0.82 / 2)
    expect(tierRates(table).map((t) => t.count)).toEqual([2, 1, 2])
  })

  it('いないレア度の確率は、いるレア度に比率のまま回す', () => {
    const table = rateTable('g3', defs) // 激レアがいないガチャ：ハズレとノーマルだけ
    expect(table.map((r) => r.def.id)).toEqual(['h1', 'h2', 'n1'])
    expect(table.find((r) => r.def.id === 'n1')!.rate).toBeCloseTo(0.32 / 0.7)
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
    expect(draw(table, 29, 0)?.id).toBe('r1')
    expect(draw(table, 0, 0)?.id).toBe('h1')
    expect(isPity(29, rateTable('g3', defs))).toBe(false)
  })

  it('確率の表示', () => {
    expect(percent(0.5)).toBe('50%')
    expect(percent(10 / 17)).toBe('58.8%')
    expect(percent(0.03)).toBe('3%')
    expect(percent(1 / 21)).toBe('4.76%')
  })

  it('星は進化形態だけで決まる（レア度は関係ない）：★1 → ★2 → ★3。ジョグレスは★4が上限', () => {
    expect(starsOf(def('a', { rarity: 'hazure', templateId: 'early2' }), 'n2')).toBe(2)
    expect(starsOf(def('a'), 'n1')).toBe(1)
    expect(starsOf(def('a', { rarity: 'superRare' }), 'n1')).toBe(1)
    expect(starsOf(def('a'), 'n3')).toBe(3)
    expect(starsOf(def('a', { rarity: 'rare', templateId: 'lateBranch' }), 'n3b')).toBe(3)
    expect(starsOf(def('a', { recipe: ['x', 'y'], templateId: 'single' }), 'n1')).toBe(4) // 決めていなければ★4
    expect(starsOf(def('a', { recipe: ['x', 'y'], templateId: 'early2', jogressBirthStars: 3 }), 'n2')).toBe(4) // ★3誕生 → ★4
    expect(starsOf(def('a', { recipe: ['x', 'y'], jogressBirthStars: 3 }), 'n3')).toBe(4) // ★4より上にはならない
    // 進化しない降臨モンスターは、登録画面で決めた星（決めていなければ★3）
    expect(starsOf(def('a', { questOnly: true, templateId: 'single' }), 'n1')).toBe(3)
    expect(starsOf(def('a', { questOnly: true, templateId: 'single', fixedStars: 2 }), 'n1')).toBe(2)
  })
})

describe('レア（中当たり）', () => {
  it('そのガチャ限定で、激レアより当たりやすい', async () => {
    const { rateTable, isPickupRarity } = await import('./gacha')
    const d = (id: string, rarity: string, gachas?: string[]) => ({ id, name: id, templateId: 'linear3', images: {}, createdAt: 0, rarity, gachas }) as never
    const table = rateTable('g', [d('h', 'hazure'), d('n', 'normal'), d('u', 'uncommon', ['g']), d('s', 'superRare', ['g']), d('u2', 'uncommon', ['x'])])
    const rate = Object.fromEntries(table.map((r) => [r.def.id, r.rate]))
    expect(rate.u).toBeCloseTo(0.18)
    expect(rate.s).toBeCloseTo(0.12)
    expect(rate.u2).toBeUndefined() // 別のガチャのレアは出ない
    expect(isPickupRarity('uncommon')).toBe(true)
  })
})
