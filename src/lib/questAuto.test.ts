import { describe, expect, it } from 'vitest'
import { autoGradeOf, autoQuestSetup } from './questAuto'
import { isStrict } from './quest'
import type { MonsterDef } from '../types'

const boss = { id: 'b1', name: 'アシリュウ', templateId: 'single', attrs: { n1: 'legs' }, images: {}, element: 'water', questOnly: true, rarity: 'superRare', createdAt: 0 } as unknown as MonsterDef

describe('おまかせのクエスト', () => {
  it('ボスの属性に有利な属性と、格に合った数のアビリティ・弱点を求める', () => {
    const r = autoQuestSetup(boss, 'chozetsu', 'boss', [], ['バリア', 'シールド', 'リジェネ', 'ミラー'])
    expect(r.requirements[0]).toEqual({ tag: 'el:wood', count: 3 }) // 水には木が有利
    expect(r.requirements.filter((x) => x.tag.startsWith('ab:'))).toHaveLength(2)
    expect(r.weakSlots.length).toBeGreaterThan(0)
  })
  it('ほかのクエストであまり使っていないアビリティを選ぶ', () => {
    const used = [{ id: 'q', requirements: [{ tag: 'ab:バリア', count: 2 }, { tag: 'ab:シールド', count: 2 }, { tag: 'ab:リジェネ', count: 2 }] }]
    const r = autoQuestSetup(boss, 'kyukyoku', 'boss', used, ['バリア', 'シールド', 'リジェネ', 'ミラー'])
    expect(r.requirements.find((x) => x.tag.startsWith('ab:'))?.tag).toBe('ab:ミラー')
  })
  it('まとめて作るときの格はレア度から（コラボの激レアは超究極）', () => {
    expect(autoGradeOf(boss)).toBe('chozetsu')
    expect(autoGradeOf({ ...boss, series: '鬼退治コラボ' })).toBe('chokyukyoku')
  })
  it('超究極も超絶と同じく、適正の属性以外は半減', () => {
    const q = { kind: 'boss' as const, element: 'fire' as const }
    expect(isStrict({ ...q, grade: 'chokyukyoku' })).toBe(true)
    expect(isStrict({ ...q, grade: 'chozetsu' })).toBe(true)
    expect(isStrict({ ...q, grade: 'kyukyoku' })).toBe(false)
  })
})
