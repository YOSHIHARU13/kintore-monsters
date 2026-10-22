import { describe, expect, it } from 'vitest'
import { canFeed, fusionGain } from './fusion'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'chestArms', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})

describe('合体の素材', () => {
  const fire = def('f', { element: 'fire' })
  it('同じモンスターか、同じ属性のモンスターなら食べさせられる', () => {
    expect(canFeed(fire, fire)).toBe(true)
    expect(canFeed(fire, def('f2', { element: 'fire' }))).toBe(true)
    expect(canFeed(fire, def('w', { element: 'water' }))).toBe(false)
    expect(canFeed(fire, def('d', { recipe: ['a', 'b'], jogressElements: ['water', 'fire'] }))).toBe(true) // 複合属性
    expect(canFeed(def('n'), def('n2'))).toBe(true) // 無属性どうし
    expect(canFeed(fire, def('n2'))).toBe(false)
  })

  it('同じモンスターなら＋2、同じ属性なら＋1。食べさせた側の＋も引き継ぐ', () => {
    expect(fusionGain(fire, fire, { id: 'x', defId: 'f', nodeId: 'n1', obtainedAt: 0 })).toBe(2)
    expect(fusionGain(fire, def('f2', { element: 'fire' }), { id: 'x', defId: 'f2', nodeId: 'n1', obtainedAt: 0, plus: 1 })).toBe(2)
  })
})
