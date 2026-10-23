import { describe, expect, it } from 'vitest'
import { bossGradeOf, drawSure, percent, pickFrom, rarityOf, rateTable, starsOf, tierRates } from './gacha'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'none', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})

describe('ガチャ', () => {
  const defs = [
    def('h1', { rarity: 'hazure' }), // 以前のハズレ → ノーマル
    def('h2', { common: true }), // 旧形式のハズレ枠もノーマル
    def('n1'), // レア度なし（以前のノーマル） → レア（どのガチャからも出る）
    def('r1', { rarity: 'rare', gachas: ['g1'] }), // 以前の「レア」は激レアとして扱う
    def('s1', { tier: 'superRare', gachas: ['g1', 'g2'] }),
    def('s2', { tier: 'superRare', gachas: ['g2'] }), // 別のガチャ
    def('x', { tier: 'superRare', gachas: ['g1'], recipe: ['h1', 'n1'] }), // 隠しモンスターは出ない
    def('d1', { tier: 'superRare' }), // ガチャを選んでいない激レア → いつものガチャ
  ]

  it('レア度ごとの確率を、同じレア度のモンスターで山分けする（モンストと同じ：ノーマル88%・レア8.4%・激レア3.6%）', () => {
    const table = rateTable('g1', defs)
    expect(table.map((r) => r.def.id)).toEqual(['h1', 'h2', 'n1', 'r1', 's1'])
    const rate = Object.fromEntries(table.map((r) => [r.def.id, r.rate]))
    expect(rate.h1).toBeCloseTo(0.44)
    expect(rate.h2).toBeCloseTo(0.44)
    expect(rate.n1).toBeCloseTo(0.084)
    expect(rate.r1).toBeCloseTo(0.018)
    expect(rate.s1).toBeCloseTo(0.018)
    expect(tierRates(table).map((t) => t.count)).toEqual([2, 1, 2])
  })

  it('いないレア度の確率は、いるレア度に比率のまま回す', () => {
    const table = rateTable('g3', defs) // 激レアがいないガチャ：ノーマルとレアだけ
    expect(table.map((r) => r.def.id)).toEqual(['h1', 'h2', 'n1'])
    expect(table.find((r) => r.def.id === 'n1')!.rate).toBeCloseTo(0.084 / 0.964)
    expect(table.reduce((sum, r) => sum + r.rate, 0)).toBeCloseTo(1)
  })

  it('確率どおりに選ぶ', () => {
    const table = rateTable('g1', defs)
    expect(pickFrom(table, 0)?.id).toBe('h1')
    expect(pickFrom(table, 0.9)?.id).toBe('n1')
    expect(pickFrom(table, 0.97)?.id).toBe('r1')
    expect(pickFrom(table, 0.99)?.id).toBe('s1')
    expect(pickFrom([], 0.5)).toBeNull()
  })

  it('確定（ホシ玉）：レア以上から。激レア40%、残りはレア', () => {
    const table = rateTable('g1', defs)
    expect(drawSure(table, 0.1, 0.4)?.id).toBe('r1') // 激レアの1体目
    expect(drawSure(table, 0.3, 0.4)?.id).toBe('s1') // 激レアの2体目
    expect(drawSure(table, 0.5, 0.4)?.id).toBe('n1') // レア
    // 激レアがいなければレアから
    expect(drawSure(rateTable('g3', defs), 0.1, 0.4)?.id).toBe('n1')
  })

  it('確率の表示', () => {
    expect(percent(0.5)).toBe('50%')
    expect(percent(10 / 17)).toBe('58.8%')
    expect(percent(0.03)).toBe('3%')
    expect(percent(1 / 21)).toBe('4.76%')
  })

  it('星は進化形態で決まり、レア度の上限まで（ノーマル★2・レア★3・激レア★3）。ジョグレスは★4', () => {
    expect(starsOf(def('a', { tier: 'normal' }), 'n3')).toBe(2)
    expect(starsOf(def('a'), 'n1')).toBe(1)
    expect(starsOf(def('a', { tier: 'superRare' }), 'n1')).toBe(1)
    expect(starsOf(def('a'), 'n3')).toBe(3)
    expect(starsOf(def('a', { tier: 'superRare', templateId: 'lateBranch' }), 'n3b')).toBe(3)
    expect(starsOf(def('a', { recipe: ['x', 'y'], templateId: 'single' }), 'n1')).toBe(4) // 決めていなければ★4
    expect(starsOf(def('a', { recipe: ['x', 'y'], templateId: 'early2', jogressBirthStars: 3 }), 'n2')).toBe(4) // ★3誕生 → ★4
    expect(starsOf(def('a', { recipe: ['x', 'y'], jogressBirthStars: 3 }), 'n3')).toBe(4) // ★4より上にはならない
    // 降臨は格で決まる（上級★1・極★2・究極以上★3）
    expect(starsOf(def('a', { questOnly: true, templateId: 'single', bossGrade: 'jokyu' }), 'n1')).toBe(1)
    expect(starsOf(def('a', { questOnly: true, templateId: 'single', bossGrade: 'kiwami' }), 'n1')).toBe(2)
    expect(starsOf(def('a', { questOnly: true, templateId: 'single', bossGrade: 'bakuzetsu' }), 'n1')).toBe(3)
  })
})

describe('コラボの子', () => {
  it('どのレア度でも、そのコラボのガチャ（同じコラボの子を入れたガチャ）からだけ出る。コラボのガチャのレアはコラボの子だけ', () => {
    const list = [
      def('n', { tier: 'normal' }),
      def('r', { tier: 'rare' }),
      def('cn', { tier: 'normal', series: '鬼' }),
      def('cr', { tier: 'rare', series: '鬼' }),
      def('cs', { tier: 'superRare', series: '鬼', gachas: ['oni'] }),
      def('s', { tier: 'superRare', gachas: ['fes'] }),
    ]
    const ids = (g: string) => rateTable(g, list).map((r) => r.def.id)
    expect(ids('oni')).toEqual(['n', 'cn', 'cr', 'cs'])
    expect(ids('fes')).toEqual(['n', 'r', 's'])
  })
  it('以前のレア度の読み替え・降臨の格', () => {
    expect(rarityOf({ rarity: 'hazure' })).toBe('normal')
    expect(rarityOf({ rarity: 'normal' })).toBe('rare')
    expect(rarityOf({ rarity: 'uncommon' })).toBe('rare')
    expect(rarityOf({ rarity: 'superRare' })).toBe('superRare')
    expect(rarityOf({ tier: 'normal', rarity: 'superRare' })).toBe('normal') // 新しいレア度が先
    expect(bossGradeOf({ questOnly: true, rarity: 'uncommon' })).toBe('chozetsu')
    expect(bossGradeOf({ questOnly: true, rarity: 'uncommon', series: '鬼' })).toBe('chokyukyoku')
    expect(bossGradeOf({ questOnly: true, bossGrade: 'kiwami', rarity: 'superRare' })).toBe('kiwami')
    expect(bossGradeOf({ rarity: 'superRare' })).toBeUndefined()
  })
})
