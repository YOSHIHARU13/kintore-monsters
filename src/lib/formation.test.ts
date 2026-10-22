import { describe, expect, it } from 'vitest'
import { formationOf, ownedSupply, requirementsFromMonsters, requirementsOf, shortfallHelp, tagsOf } from './formation'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'chestArms', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})

describe('編成', () => {
  const reqs = [
    { tag: 'el:fire', count: 3 },
    { tag: 'el:water', count: 3 },
    { tag: 'ab:バリア', count: 3 },
  ]

  it('タグ：超属性は2、複合属性は両方に1、アビリティは持てる数まで', () => {
    expect(tagsOf(def('a', { rarity: 'rare', element: 'fire', abilities: ['バリア'] }))).toEqual({ 'el:fire': 1, 'ab:バリア': 1 })
    expect(tagsOf(def('s', { recipe: ['x', 'y'], jogressElements: ['fire'], jogressSuper: true }))).toEqual({ 'el:fire': 2 })
    expect(tagsOf(def('d', { recipe: ['x', 'y'], jogressElements: ['fire', 'water'] }))).toEqual({ 'el:fire': 1, 'el:water': 1 })
    expect(tagsOf(def('h', { rarity: 'hazure', abilities: ['バリア'] }))).toEqual({}) // ハズレ・ノーマルはアビリティ0個
    expect(tagsOf(def('n', { abilities: ['バリア'] }))).toEqual({})
    // 激レアは2個、ジョグレスは3個まで
    expect(tagsOf(def('s', { rarity: 'superRare', abilities: ['バリア', 'シールド', 'ミラー'] }))).toEqual({ 'ab:バリア': 1, 'ab:シールド': 1 })
    expect(tagsOf(def('j', { recipe: ['x', 'y'], abilities: ['バリア', 'シールド', 'ミラー', 'リジェネ'] }))).toEqual({
      'ab:バリア': 1,
      'ab:シールド': 1,
      'ab:ミラー': 1,
    })
  })

  it('何もそろっていないと×0.4、ちょうどそろうと×1.0、超えた分は1つ+0.15', () => {
    expect(formationOf([], reqs).rate).toBe(0.4)
    const exact = [
      def('1', { rarity: 'rare', element: 'fire', abilities: ['バリア'] }),
      def('2', { rarity: 'rare', element: 'fire', abilities: ['バリア'] }),
      def('3', { rarity: 'rare', element: 'fire', abilities: ['バリア'] }),
      def('4', { element: 'water' }),
      def('5', { element: 'water' }),
      def('6', { element: 'water' }),
    ]
    expect(formationOf(exact, reqs).rate).toBe(1)
    const over = [...exact.slice(0, 5), def('6', { recipe: ['x', 'y'], jogressElements: ['water'], jogressSuper: true })]
    expect(formationOf(over, reqs).rate).toBe(1.15) // 水が4/3
    expect(formationOf([def('a', { element: 'fire' })], reqs).rate).toBe(0.47) // 炎1/3だけ
  })

  it('条件のないクエストはいつも×1.0', () => {
    expect(formationOf([], []).rate).toBe(1)
  })

  it('足りていない条件への貢献度（候補の並び順に使う）', () => {
    const rows = formationOf([def('a', { element: 'fire' })], reqs).rows
    expect(shortfallHelp(def('b', { rarity: 'rare', element: 'fire', abilities: ['バリア'] }), rows)).toBe(2)
    expect(shortfallHelp(def('c', { element: 'light' }), rows)).toBe(0)
  })

  it('条件を作る前のクエストは、ギミックを「対応アビリティ2体」として読む', () => {
    expect(requirementsOf({ gimmicks: ['バリア'] })).toEqual([{ tag: 'ab:バリア', count: 2 }])
  })

  it('クエスト側から：選んだモンスターの属性とアビリティで条件を作る', () => {
    const fireRare = def('a', { rarity: 'rare', element: 'fire', abilities: ['バリア'] })
    const water = def('b', { element: 'water' })
    expect(requirementsFromMonsters([fireRare])).toEqual([
      { tag: 'el:fire', count: 3 },
      { tag: 'ab:バリア', count: 2 },
    ])
    expect(requirementsFromMonsters([fireRare, water])).toEqual([
      { tag: 'el:fire', count: 2 },
      { tag: 'el:water', count: 2 },
      { tag: 'ab:バリア', count: 2 },
    ])
  })

  it('手持ちで満たせる数（同じモンスターを何体持っていても数える）', () => {
    const defs = [def('a', { element: 'fire' }), def('s', { recipe: ['x', 'y'], jogressElements: ['fire'], jogressSuper: true })]
    const owned = [{ defId: 'a' }, { defId: 'a' }, { defId: 's' }]
    expect(ownedSupply('el:fire', owned, defs)).toBe(4)
    expect(ownedSupply('el:water', owned, defs)).toBe(0)
  })
})
