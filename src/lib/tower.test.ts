import { describe, expect, it } from 'vitest'
import { towerCleared, towerFloors, towerLineup } from './tower'
import type { MonsterDef, Quest } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef =>
  ({ id, name: id, templateId: 'single', images: { n1: 'img' }, createdAt: 0, ...extra }) as MonsterDef
const chozetsu = (bossDefId: string) => ({ kind: 'boss', grade: 'chozetsu', bossDefId }) as Quest

// 超絶ボス：炎2・水2・木1・光2・闇2（図鑑の順）。塔限定2体。ほかの子
const bosses = [
  def('f1', { questOnly: true, element: 'fire' }),
  def('w1', { questOnly: true, element: 'water' }),
  def('f2', { questOnly: true, element: 'fire' }),
  def('g1', { questOnly: true, element: 'wood' }),
  def('l1', { questOnly: true, element: 'light' }),
  def('d1', { questOnly: true, element: 'dark' }),
  def('w2', { questOnly: true, element: 'water' }),
  def('l2', { questOnly: true, element: 'light' }),
  def('d2', { questOnly: true, element: 'dark' }),
]
const defs = [
  ...bosses,
  def('t1', { questOnly: true, tower: true, element: 'dark' }),
  def('t2', { questOnly: true, tower: true, element: 'light' }),
  def('q', { questOnly: true, element: 'wood' }), // 超絶ではない降臨
  def('a', { rarity: 'normal', element: 'fire', abilities: ['バリア'] }),
]
const quests = bosses.map((b) => chozetsu(b.id))

describe('試練の塔', () => {
  it('1〜10階は、超絶のボスを炎・水・木・光・闇の順に2周（同じ属性は図鑑順）。足りない枠はほかの降臨で埋める', () => {
    expect(towerLineup(defs, quests).map((d) => d?.id)).toEqual(['f1', 'w1', 'g1', 'l1', 'd1', 'f2', 'w2', 'q', 'l2', 'd2'])
  })
  it('11階は塔限定モンスターがボスで、倒すともらえる（月替わりに順番）', () => {
    const oct = towerFloors('2026-10', defs, ['バリア'], quests)
    const nov = towerFloors('2026-11', defs, ['バリア'], quests)
    expect(oct).toHaveLength(11)
    expect(oct[10].quest.bossDefId).toBe(oct[10].reward.monsterDefId)
    expect(['t1', 't2']).toContain(oct[10].reward.monsterDefId)
    expect(nov[10].reward.monsterDefId).not.toBe(oct[10].reward.monsterDefId)
    expect(oct.slice(0, 10).map((f) => f.quest.bossDefId)).toEqual(nov.slice(0, 10).map((f) => f.quest.bossDefId)) // 毎月同じ並び
  })
  it('属性はボスの属性。上の階ほどHPが高く、3階から条件、8階から超絶。条件はボスに有利な属性と、誰かが持っているスキル', () => {
    const floors = towerFloors('2026-10', defs, ['バリア', 'シールド'], quests)
    for (let i = 1; i < floors.length; i++) expect(floors[i].quest.hp.normal).toBeGreaterThan(floors[i - 1].quest.hp.normal)
    expect(floors[0].quest.element).toBe('fire')
    expect(floors[0].quest.requirements).toEqual([])
    expect(floors[3].quest.element).toBe('light')
    expect(floors[3].quest.requirements!.filter((r) => r.tag.startsWith('el:')).map((r) => r.tag)).toEqual(['el:dark'])
    expect(floors[3].quest.requirements!.some((r) => r.tag.includes('シールド'))).toBe(false) // 誰も持っていないスキルは求めない
    expect(floors[7].quest.grade).toBe('chozetsu')
  })
  it('塔限定モンスターがいなければ、11階は卵', () => {
    const floors = towerFloors('2026-10', defs.filter((d) => !d.tower), [], quests)
    expect(floors[10].reward.monsterDefId).toBeNull()
    expect(floors[10].reward.eggs).toBeGreaterThan(0)
  })
  it('クリアした階は月が変わると0に戻る', () => {
    expect(towerCleared({ tower: { month: '2026-10', cleared: 4 } }, '2026-10')).toBe(4)
    expect(towerCleared({ tower: { month: '2026-09', cleared: 10 } }, '2026-10')).toBe(0)
  })
})
