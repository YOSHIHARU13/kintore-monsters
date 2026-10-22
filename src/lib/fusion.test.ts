import { describe, expect, it } from 'vitest'
import { canFeed, fusionGain, isLuckMax, luckAfter, luckBonus } from './fusion'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'chestArms', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})

describe('合体（＋）の素材', () => {
  const fire = def('f', { element: 'fire' })
  it('同じ属性の別のモンスターなら食べさせられる（同じモンスターは運のほうへ）', () => {
    expect(canFeed(fire, fire)).toBe(false)
    expect(canFeed(fire, def('f2', { element: 'fire' }))).toBe(true)
    expect(canFeed(fire, def('w', { element: 'water' }))).toBe(false)
    expect(canFeed(fire, def('d', { recipe: ['a', 'b'], jogressElements: ['water', 'fire'] }))).toBe(true) // 複合属性
    expect(canFeed(def('n'), def('n2'))).toBe(true) // 無属性どうし
    expect(canFeed(fire, def('n2'))).toBe(false)
  })

  it('＋1。食べさせた側の＋も引き継ぐ', () => {
    expect(fusionGain(fire, def('f2', { element: 'fire' }), { id: 'x', defId: 'f2', nodeId: 'n1', obtainedAt: 0, plus: 1 })).toBe(2)
  })
})

describe('運', () => {
  it('食べさせた側の運をそのまま足す（最大99）', () => {
    expect(luckAfter({}, {})).toBe(2)
    expect(luckAfter({ luck: 50 }, { luck: 10 })).toBe(60)
    expect(luckAfter({ luck: 95 }, { luck: 10 })).toBe(99)
    expect(isLuckMax({ luck: 99 })).toBe(true)
  })

  it('運極ボーナス：1体につき報酬G+20%、核+10%', () => {
    expect(luckBonus([{ luck: 99 }, { luck: 99 }, { luck: 5 }])).toEqual({ count: 2, goldRate: 1.4, coreRate: 0.2 })
    expect(luckBonus([])).toEqual({ count: 0, goldRate: 1, coreRate: 0 })
  })
})
