import { describe, expect, it } from 'vitest'
import { builtinMaterialQuests } from './materials'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
  ({ id, name: id, templateId: 'linear3', images: {}, createdAt: 0, ...extra }) as MonsterDef

describe('いつでもある素材クエスト', () => {
  it('核の種類ごとに1つ。敵はその部位のハズレから', () => {
    const defs = [
      def('n', { attrs: { n1: 'legs' }, rarity: 'normal' }),
      def('h', { attrs: { n1: 'legs' }, rarity: 'hazure' }),
    ] as MonsterDef[]
    const qs = builtinMaterialQuests(defs)
    expect(qs.map((q) => q.attr)).toEqual(['chestArms', 'legs', 'backShoulders', 'none'])
    expect(qs.every((q) => q.kind === 'material' && q.builtin)).toBe(true)
    expect(qs.find((q) => q.attr === 'legs')?.bossDefId).toBe('h')
  })
})
