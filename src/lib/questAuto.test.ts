import { describe, expect, it } from 'vitest'
import { autoGradeOf, autoQuestSetup, basisRequirements } from './questAuto'
import { fitsQuest, isStrict } from './quest'
import type { MonsterDef } from '../types'

const boss = { id: 'b1', name: 'アシリュウ', templateId: 'single', attrs: { n1: 'legs' }, images: {}, element: 'water', questOnly: true, rarity: 'superRare', createdAt: 0 } as unknown as MonsterDef

describe('おまかせのクエスト', () => {
  it('超絶：刺さるキャラがいなければ、2つの属性を3ずつ＋実際に誰かが両方持っている組み合わせ', () => {
    const normal = (id: string, abilities: string[]) =>
      ({ id, name: id, templateId: 'linear3', images: {}, rarity: 'normal', abilities, createdAt: 0 }) as unknown as MonsterDef
    // ノーマルは1つしか持てないので、両方もつ子はいない → アビリティ1つの条件になる（誰も持っていない組み合わせにはしない）
    const r = autoQuestSetup(boss, 'chozetsu', 'boss', [], ['バリア', 'シールド', 'リジェネ', 'ミラー'], undefined, [normal('n', ['ミラー'])])
    expect(r.requirements[0]).toEqual({ tag: 'el:wood', count: 3 }) // 水には木が有利
    expect(r.requirements[1]).toMatchObject({ tag: expect.stringMatching(/^el:/), count: 3 })
    expect(r.requirements[2]).toEqual({ tag: 'ab:ミラー', count: 2 }) // 持っている子がいるアビリティ
    expect(r.weakSlots.length).toBeGreaterThan(0)
  })
  it('刺さるキャラを3体選ぶと、その子たちに多い属性と、両方持っている組み合わせで条件を作る', () => {
    const sr = (id: string, element: string, abilities: string[]) =>
      ({ id, name: id, templateId: 'linear3', images: {}, rarity: 'superRare', element, abilities, createdAt: 0 }) as unknown as MonsterDef
    const heroes = [sr('a', 'fire', ['バリア', 'ミラー']), sr('b', 'fire', ['ミラー', 'バリア']), sr('c', 'light', ['シールド', 'リジェネ'])]
    const reqs = basisRequirements({ kind: 'hero', heroes }, 'kyukyoku', undefined)
    expect(reqs).toEqual([
      { tag: 'el:fire', count: 2 },
      { tag: 'el:light', count: 2 },
      { tag: 'ab2:バリア|ミラー', count: 2 }, // 2体が両方持っている
    ])
  })
  it('超絶：刺さるキャラ（アビリティ2つの激レア）の属性と、アビリティを両方もつ条件になる', () => {
    const hero = { id: 'h', name: 'h', templateId: 'linear3', images: {}, rarity: 'superRare', element: 'fire', abilities: ['バリア', 'ミラー'], createdAt: 0 } as unknown as MonsterDef
    const r = autoQuestSetup(boss, 'chozetsu', 'boss', [], ['バリア', 'シールド', 'リジェネ', 'ミラー'], undefined, [hero])
    expect(r.heroId).toBe('h')
    expect(r.requirements).toEqual([
      { tag: 'el:fire', count: 3 },
      { tag: 'ab2:バリア|ミラー', count: 2 },
      { tag: 'el:wood', count: 2 }, // ボスに有利な属性も少し
    ])
  })
  it('超究極：同じコラボの子が刺さるキャラになる', () => {
    const mk = (id: string, series?: string) =>
      ({ id, name: id, templateId: 'linear3', images: {}, rarity: 'superRare', element: 'dark', abilities: ['バリア', 'ミラー'], series, createdAt: 0 }) as unknown as MonsterDef
    const collabBoss = { ...boss, series: '鬼' }
    const r = autoQuestSetup(collabBoss, 'chokyukyoku', 'boss', [], [], undefined, [mk('a'), mk('b', '鬼'), mk('c')])
    expect(r.heroId).toBe('b')
    expect(r.requirements.find((x) => x.tag.startsWith('ab2:'))?.count).toBe(3)
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
  it('適正：ボスに有利な属性か、編成で求められている属性を持っていればOK（半減しない）', () => {
    const q = { element: 'water' as const, requirements: [{ tag: 'el:light', count: 3 }] }
    const mk = (element: string) => ({ ...boss, element }) as MonsterDef
    expect(fitsQuest(mk('wood'), q)).toBe(true) // 水に有利
    expect(fitsQuest(mk('light'), q)).toBe(true) // 条件の属性
    expect(fitsQuest(mk('fire'), q)).toBe(false)
  })
})
