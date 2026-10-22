import { describe, expect, it } from 'vitest'
import { towerCleared, towerFloors } from './tower'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef =>
  ({ id, name: id, templateId: 'linear3', images: { n1: 'img' }, element: 'fire', createdAt: 0, ...extra }) as MonsterDef

const defs = [def('a'), def('b', { element: 'water' }), def('t1', { questOnly: true, tower: true }), def('t2', { questOnly: true, tower: true })]

describe('試練の塔', () => {
  it('同じ月なら同じ塔になり、月が変わると変わる', () => {
    const a = towerFloors('2026-10', defs, ['バリア'])
    expect(a).toHaveLength(10)
    expect(towerFloors('2026-10', defs, ['バリア'])).toEqual(a)
    expect(towerFloors('2026-11', defs, ['バリア']).map((f) => f.quest.element)).not.toEqual(a.map((f) => f.quest.element))
  })
  it('上の階ほどHPが高く、条件が増え、8階から超絶', () => {
    const floors = towerFloors('2026-10', defs, ['バリア'])
    for (let i = 1; i < floors.length; i++) expect(floors[i].quest.hp.normal).toBeGreaterThan(floors[i - 1].quest.hp.normal)
    expect(floors[0].quest.requirements).toEqual([])
    expect(floors[9].quest.requirements).toHaveLength(2)
    expect(floors[7].quest.grade).toBe('chozetsu')
  })
  it('5階と10階で塔限定モンスター（月ごとに順番）。いなければ卵', () => {
    const floors = towerFloors('2026-10', defs, [])
    expect([floors[4].reward.monsterDefId, floors[9].reward.monsterDefId].sort()).toEqual(['t1', 't2'])
    const none = towerFloors('2026-10', defs.slice(0, 2), [])
    expect(none[4].reward.monsterDefId).toBeNull()
    expect(none[4].reward.eggs).toBeGreaterThan(0)
  })
  it('クリアした階は月が変わると0に戻る', () => {
    expect(towerCleared({ tower: { month: '2026-10', cleared: 4 } }, '2026-10')).toBe(4)
    expect(towerCleared({ tower: { month: '2026-09', cleared: 10 } }, '2026-10')).toBe(0)
  })
})
