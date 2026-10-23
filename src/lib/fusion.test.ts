import { describe, expect, it } from 'vitest'
import { canFeed, fusionGain, isLuckMax, luckAfter, luckBonus, planBulkFeed } from './fusion'
import type { MonsterDef, OwnedMonster } from '../types'

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

  it('運極ボーナス：1体につき報酬のオーブ+20%、素材のくじ+1回', () => {
    expect(luckBonus([{ luck: 99 }, { luck: 99 }, { luck: 5 }])).toEqual({ count: 2, goldRate: 1.4, extraRolls: 2 })
    expect(luckBonus([])).toEqual({ count: 0, goldRate: 1, extraRolls: 0 })
  })
})

describe('ダブりをまとめて合成', () => {
  const def = (id: string, rarity: 'hazure' | 'normal' | 'superRare') => ({ id, name: id, templateId: 'linear3', images: {}, rarity, createdAt: 0 }) as MonsterDef
  const mon = (id: string, defId: string, nodeId = 'n1', luck = 1, obtainedAt = 0) => ({ id, defId, nodeId, luck, obtainedAt }) as OwnedMonster
  const stars = (_d: MonsterDef, nodeId: string) => Number(nodeId.slice(1))
  const target = (d: MonsterDef) => d.rarity !== 'superRare'

  it('いちばん育っている1体に、同じモンスターを集める。激レアと相棒は対象外', () => {
    const defs = [def('h', 'hazure'), def('n', 'normal'), def('s', 'superRare')]
    const owned = [
      mon('h1', 'h', 'n1', 10), mon('h2', 'h', 'n3', 10), mon('h3', 'h', 'n1', 10),
      mon('n1', 'n', 'n1'), mon('n2', 'n', 'n2'), mon('n3', 'n', 'n1'),
      mon('s1', 's'), mon('s2', 's'),
    ]
    const plans = planBulkFeed(owned, defs, new Set(['n3']), stars, target)
    expect(plans).toEqual([
      { keeperId: 'h2', foodIds: expect.arrayContaining(['h1', 'h3']), luck: 30 },
      { keeperId: 'n3', foodIds: expect.arrayContaining(['n1', 'n2']), luck: 3 }, // 相棒がいればその子に集める
    ])
  })
  it('運が最大になったら、それ以上は食べさせない', () => {
    const owned = [mon('a', 'h', 'n1', 95), mon('b', 'h', 'n1', 10), mon('c', 'h', 'n1', 10)]
    const plans = planBulkFeed(owned, [def('h', 'hazure')], new Set(), stars, target)
    expect(plans[0].foodIds).toHaveLength(1)
    expect(plans[0].luck).toBe(99)
  })
})
