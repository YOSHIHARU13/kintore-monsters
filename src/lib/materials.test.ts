import { describe, expect, it } from 'vitest'
import { builtinMaterialQuests, builtinTempleQuests } from './materials'
import { atDifficulty } from './quest'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
  ({ id, name: id, templateId: 'linear3', images: {}, createdAt: 0, ...extra }) as MonsterDef

const ELS = ['fire', 'water', 'wood', 'light', 'dark'] as const

describe('いつでもある素材クエスト', () => {
  const defs = ELS.flatMap((e) => [
    def(`${e}1`, { rarity: 'hazure', element: e, attrs: { n1: 'legs' } }),
    def(`${e}2`, { rarity: 'hazure', element: e, attrs: { n1: 'chestArms' } }),
  ])

  it('10個：5属性の結晶・炎水木で部位の核・光でコイン・闇で筋肉玉', () => {
    const qs = builtinMaterialQuests(defs, '2026-10-23')
    expect(qs).toHaveLength(10)
    expect(qs.filter((q) => q.drop === 'stone').map((q) => q.element)).toEqual([...ELS])
    expect(qs.filter((q) => q.drop === 'muscle').map((q) => [q.attr, q.element])).toEqual([
      ['chestArms', 'fire'],
      ['backShoulders', 'water'],
      ['legs', 'wood'],
    ])
    expect(qs.find((q) => q.drop === 'coins')).toMatchObject({ id: 'mat-coins', element: 'light' })
    expect(qs.find((q) => q.drop === 'ball')).toMatchObject({ id: 'mat-none', element: 'dark' })
    expect(qs.every((q) => q.kind === 'material' && q.builtin)).toBe(true)
  })

  it('敵はその属性のハズレ。同じ属性の2つのクエストには、別のハズレが出る', () => {
    const qs = builtinMaterialQuests(defs, '2026-10-23')
    for (const q of qs) expect(defs.find((d) => d.id === q.bossDefId)?.element).toBe(q.element)
    for (const e of ELS) {
      const two = qs.filter((q) => q.element === e)
      expect(two).toHaveLength(2)
      expect(two[0].bossDefId).not.toBe(two[1].bossDefId)
    }
    // 次の日は入れ替わる（部位の決まりがないクエスト）
    const light = qs.find((q) => q.id === 'mat-stone-light')!
    expect(builtinMaterialQuests(defs, '2026-10-24').find((q) => q.id === light.id)!.bossDefId).not.toBe(light.bossDefId)
  })

  it('核のクエストは、その部位のハズレを優先', () => {
    const qs = builtinMaterialQuests(defs, '2026-10-23')
    expect(qs.find((q) => q.attr === 'legs')!.bossDefId).toBe('wood1')
    expect(qs.find((q) => q.attr === 'chestArms')!.bossDefId).toBe('fire2')
  })

  it('難易度が上がるほど、編成の条件がきつくなる（初級はほぼ縛りなし）', () => {
    const withAbility = [...defs, def('g', { rarity: 'normal', element: 'water', abilities: ['バリア'] })]
    const q = builtinMaterialQuests(withAbility, '2026-10-23', ['バリア'])[0]
    const total = (d: 'easy' | 'normal' | 'hard') => (atDifficulty(q, d).requirements ?? []).reduce((s, r) => s + r.count, 0)
    expect(total('easy')).toBe(0)
    expect(total('normal')).toBeGreaterThan(0)
    expect(total('hard')).toBeGreaterThan(total('normal'))
    expect(atDifficulty(q, 'hard').requirements!.some((r) => r.tag.startsWith('ab:'))).toBe(true)
    expect(atDifficulty(q, 'hard').weakSlots.length).toBeGreaterThanOrEqual(atDifficulty(q, 'easy').weakSlots.length)
  })
})

describe('神殿', () => {
  it('5属性ぶん。敵はその属性のノーマル、難易度は時の間・修羅場', () => {
    const defs = [
      def('h', { rarity: 'hazure', element: 'fire' }),
      def('n', { rarity: 'normal', element: 'fire', abilities: ['バリア'] }),
    ]
    const qs = builtinTempleQuests(defs, '2026-10-23', ['バリア'])
    expect(qs).toHaveLength(5)
    expect(qs.every((q) => q.drop === 'custom' && q.kind === 'material')).toBe(true)
    expect(qs[0]).toMatchObject({ id: 'mat-temple-fire', element: 'fire', bossDefId: 'n' })
    expect(Object.keys(qs[0].requirementsBy!)).toEqual(['normal', 'hard'])
  })
})
