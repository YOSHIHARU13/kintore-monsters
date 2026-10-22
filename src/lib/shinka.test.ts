import { describe, expect, it } from 'vitest'
import { canShinka, shinkaFoods } from './shinka'
import { attackOf, monStars } from './stats'
import type { MonsterDef, OwnedMonster } from '../types'

const def = (id: string, extra: Partial<MonsterDef>) => ({ id, name: id, templateId: 'linear3', images: {}, createdAt: 0, ...extra }) as MonsterDef
const mon = (id: string, defId: string, nodeId = 'n3', extra: Partial<OwnedMonster> = {}) => ({ id, defId, nodeId, obtainedAt: 0, ...extra }) as OwnedMonster

describe('神化', () => {
  const sr = def('s', { rarity: 'superRare', element: 'fire' })
  it('ガチャの激レアの最終形態だけ。神化すると★4で攻撃力も上がる', () => {
    expect(canShinka(mon('a', 's'), sr)).toBe(true)
    expect(canShinka(mon('a', 's', 'n2'), sr)).toBe(false) // 最終形態じゃない
    expect(canShinka(mon('a', 's'), def('n', { rarity: 'normal' }))).toBe(false)
    expect(canShinka(mon('a', 's', 'n3', { shinka: true }), sr)).toBe(false)
    const done = mon('a', 's', 'n3', { shinka: true })
    expect(monStars(done, sr)).toBe(4)
    expect(attackOf(done, sr) - attackOf(mon('a', 's'), sr)).toBe(3000)
  })
  it('素材は同じ属性の降臨モンスター（相棒などは除く）', () => {
    const defs = [sr, def('q1', { questOnly: true, element: 'fire' }), def('q2', { questOnly: true, element: 'water' })]
    const owned = [mon('x', 'q1', 'n1'), mon('y', 'q2', 'n1'), mon('z', 'q1', 'n1')]
    expect(shinkaFoods(sr, owned, defs, new Set(['z'])).map((f) => f.mon.id)).toEqual(['x'])
  })
  it('コラボの激レアは、同じコラボの降臨が素材（属性は問わない）', () => {
    const collab = def('c', { rarity: 'superRare', element: 'fire', series: '鬼' })
    const defs = [collab, def('q1', { questOnly: true, element: 'water', series: '鬼' }), def('q2', { questOnly: true, element: 'fire' })]
    const owned = [mon('x', 'q1', 'n1'), mon('y', 'q2', 'n1')]
    expect(shinkaFoods(collab, owned, defs, new Set()).map((f) => f.mon.id)).toEqual(['x'])
  })
})
