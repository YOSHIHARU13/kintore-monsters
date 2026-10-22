import { describe, expect, it } from 'vitest'
import { builtinMaterialQuests } from './materials'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
  ({ id, name: id, templateId: 'linear3', images: {}, createdAt: 0, ...extra }) as MonsterDef

describe('いつでもある素材クエスト', () => {
  it('核の種類ごとに1つ。敵はその部位のハズレから日替わり', () => {
    const defs = [
      def('n', { attrs: { n1: 'legs' }, rarity: 'normal' }),
      def('h1', { attrs: { n1: 'legs' }, rarity: 'hazure', element: 'fire' }),
      def('h2', { attrs: { n1: 'legs' }, rarity: 'hazure', element: 'water' }),
    ] as MonsterDef[]
    const qs = builtinMaterialQuests(defs, '2026-10-23')
    expect(qs.map((q) => q.attr)).toEqual(['chestArms', 'legs', 'backShoulders', 'none', 'none'])
    expect(qs[4]).toMatchObject({ id: 'mat-coins', drop: 'coins' }) // コインの金庫
    expect(qs.every((q) => q.kind === 'material' && q.builtin)).toBe(true)
    const legs = (date: string) => builtinMaterialQuests(defs, date).find((q) => q.attr === 'legs')!
    expect(['h1', 'h2']).toContain(legs('2026-10-23').bossDefId)
    expect(legs('2026-10-24').bossDefId).not.toBe(legs('2026-10-23').bossDefId) // 次の日は別の敵
    expect(legs('2026-10-24').element).not.toBe(legs('2026-10-23').element) // 属性も変わる
  })
  it('5つのクエストに毎日5属性を1つずつ。どの属性のハズレも出番がある', () => {
    const els = ['fire', 'water', 'wood', 'light', 'dark']
    const defs = els.flatMap((e) => [def(`${e}1`, { rarity: 'hazure', element: e } as Partial<MonsterDef>), def(`${e}2`, { rarity: 'hazure', element: e } as Partial<MonsterDef>)])
    const qs = builtinMaterialQuests(defs, '2026-10-23')
    expect(new Set(qs.map((q) => q.element)).size).toBe(5)
    const seen = new Set<string>()
    for (let d = 1; d <= 20; d++) for (const q of builtinMaterialQuests(defs, `2026-11-${String(d).padStart(2, '0')}`)) seen.add(q.bossDefId)
    expect(seen.size).toBe(10) // 20日あれば全員出てくる
  })
})
