import { describe, expect, it } from 'vitest'
import { fitMembers, fitOf, fitQuests } from './fit'
import type { MonsterDef, Quest } from '../types'

const def = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
  ({ id, name: id, attr: 'legs', templateId: 'linear3', images: {}, createdAt: 0, tier: 'superRare', ...extra }) as MonsterDef
const quest = (id: string, extra: Partial<Quest>): Quest =>
  ({ id, name: id, bossDefId: 'b', attr: 'legs', element: 'water', weakSlots: [], hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: '', createdAt: 0, ...extra }) as Quest

describe('適正', () => {
  const q = quest('q', { grade: 'chozetsu', requirements: [{ tag: 'el:wood', count: 4 }, { tag: 'ab:バリア', count: 3 }, { tag: 'ab:シールド', count: 3 }] })
  it('◎：属性が合って、条件のアビリティを2つ。○：1つ。属性が合わなければ適正なし', () => {
    expect(fitOf(def('a', { element: 'wood', abilities: ['バリア', 'シールド'] }), q)).toBe('best')
    expect(fitOf(def('b', { element: 'wood', abilities: ['バリア'] }), q)).toBe('good')
    expect(fitOf(def('c', { element: 'fire', abilities: ['バリア', 'シールド'] }), q)).toBeNull()
    expect(fitOf(def('z', { abilities: ['バリア', 'シールド'] }), q)).toBe('best') // 零属性はどこでもOK
  })
  it('その子の適正クエストは◎が先・格の高い順。クエストの適正キャラは◎が先', () => {
    const easy = quest('e', { grade: 'kiwami', requirements: [{ tag: 'el:wood', count: 3 }, { tag: 'ab:バリア', count: 2 }] })
    const a = def('a', { element: 'wood', abilities: ['バリア', 'シールド'] })
    expect(fitQuests(a, [easy, q]).map((x) => x.quest.id)).toEqual(['q', 'e'])
    const b = def('b', { element: 'wood', abilities: ['バリア'] })
    expect(fitMembers(q, [b, a]).map((x) => x.def.id)).toEqual(['a', 'b'])
  })
})
