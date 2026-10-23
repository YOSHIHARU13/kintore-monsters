import { describe, expect, it } from 'vitest'
import { autoParty, partyScore } from './autoParty'
import type { Member } from './quest'
import type { MonsterDef, OwnedMonster, Quest } from '../types'

const def = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
  ({ id, name: id, templateId: 'linear3', images: {}, createdAt: 0, attr: 'legs', rarity: 'superRare', ...extra }) as MonsterDef
const member = (id: string, d: MonsterDef, extra: Partial<OwnedMonster> = {}): Member => ({
  mon: { id, defId: d.id, nodeId: 'n1', obtainedAt: 0, ...extra },
  def: d,
})
// 水のボス（木が有利）：木4・アーク3・ノヴァ3
const quest = {
  id: 'q', name: 'q', bossDefId: 'b', attr: 'legs', element: 'water', grade: 'chozetsu', weakSlots: [],
  requirements: [{ tag: 'el:wood', count: 4 }, { tag: 'ab:バリア', count: 3 }, { tag: 'ab:シールド', count: 3 }],
  hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: '', createdAt: 0,
} as Quest

describe('おまかせ編成', () => {
  const both = def('both', { element: 'wood', abilities: ['バリア', 'シールド'] })
  const arc = def('arc', { element: 'wood', abilities: ['バリア'] })
  const fire = def('fire', { element: 'fire', abilities: [] })
  const lucky = def('lucky', { element: 'wood', abilities: ['バリア'] })
  const cands = [
    ...Array.from({ length: 6 }, (_, i) => member(`b${i}`, both)),
    ...Array.from({ length: 6 }, (_, i) => member(`a${i}`, arc)),
    member('f', fire),
    member('L1', lucky, { luck: 99 }),
    member('L2', lucky, { luck: 99 }),
  ]

  it('最強：噛み合った2アビの子を積んで、倍率がいちばん高くなる6体', () => {
    const ids = autoParty(cands, quest, 'strongest')
    expect(ids).toHaveLength(6)
    expect(ids.every((id) => id.startsWith('b'))).toBe(true)
    const party = cands.filter((c) => ids.includes(c.mon.id))
    expect(partyScore(party, quest).rate).toBeGreaterThan(2)
  })

  it('運極重視：運極を積めるだけ積んで、編成倍率×1.0はキープ', () => {
    const ids = autoParty(cands, quest, 'luck')
    expect(ids).toContain('L1')
    expect(ids).toContain('L2')
    const party = cands.filter((c) => ids.includes(c.mon.id))
    expect(partyScore(party, quest).rate).toBeGreaterThanOrEqual(1)
  })
})
