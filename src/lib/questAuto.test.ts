import { describe, expect, it } from 'vitest'
import { autoGradeOf, autoQuestSetup, basisRequirements } from './questAuto'
import { fitsQuest, isStrict } from './quest'
import type { MonsterDef } from '../types'

const boss = { id: 'b1', name: 'アシリュウ', templateId: 'single', attrs: { n1: 'legs' }, images: {}, element: 'water', questOnly: true, rarity: 'superRare', createdAt: 0 } as unknown as MonsterDef

describe('おまかせのクエスト', () => {
  it('タグの仲間がいなければ、ボスに有利な属性＋実際に誰かが持っているギミックだけ（無関係な属性は求めない）', () => {
    const sr = (id: string, element: string, abilities: string[]) =>
      ({ id, name: id, templateId: 'linear3', images: {}, rarity: 'superRare', element, abilities, createdAt: 0 }) as unknown as MonsterDef
    const defs = [sr('h', 'fire', ['バリア', 'ミラー']), sr('i', 'water', ['シールド', 'リジェネ'])]
    const r = autoQuestSetup(boss, 'chozetsu', 'boss', [], ['バリア', 'シールド', 'リジェネ', 'ミラー'], undefined, defs)
    expect(r.heroId).toBeUndefined()
    expect(r.requirements[0]).toEqual({ tag: 'el:wood', count: 4 }) // 水には木が有利
    expect(r.requirements[1]).toMatchObject({ tag: expect.stringMatching(/^ab2:/), count: 2 }) // 誰かが両方持っている組み合わせ
    expect(r.requirements.filter((x) => x.tag.startsWith('el:'))).toHaveLength(1) // 炎や水は求めない
    expect(r.weakSlots.length).toBeGreaterThan(0)
    // ノーマル1つ持ちだけなら、両方もつ条件は作らず、そのギミック1つ
    const normal = { ...sr('n', 'fire', ['ミラー']), rarity: 'normal' } as MonsterDef
    const r2 = autoQuestSetup(boss, 'chozetsu', 'boss', [], ['バリア', 'シールド', 'リジェネ', 'ミラー'], undefined, [normal])
    expect(r2.requirements).toEqual([{ tag: 'el:wood', count: 4 }, { tag: 'ab:ミラー', count: 2 }])
  })
  it('刺さるキャラを3体選ぶと、その子たちに多い属性と、両方持っている組み合わせで条件を作る', () => {
    const sr = (id: string, element: string, abilities: string[]) =>
      ({ id, name: id, templateId: 'linear3', images: {}, rarity: 'superRare', element, abilities, createdAt: 0 }) as unknown as MonsterDef
    const heroes = [sr('a', 'fire', ['バリア', 'ミラー']), sr('b', 'fire', ['ミラー', 'バリア']), sr('c', 'light', ['シールド', 'リジェネ'])]
    const reqs = basisRequirements({ kind: 'hero', heroes }, 'kyukyoku', undefined)
    // 理想の6体は a×4・b・c。究極はその約2/3：炎5→3、光1→1、バリアとミラー両方5→3
    expect(reqs).toEqual([
      { tag: 'el:fire', count: 3 },
      { tag: 'el:light', count: 1 },
      { tag: 'ab2:バリア|ミラー', count: 3 },
    ])
  })
  it('超究極：同じコラボの子が刺さるキャラになる', () => {
    const mk = (id: string, series?: string) =>
      ({ id, name: id, templateId: 'linear3', images: {}, rarity: 'superRare', element: 'dark', abilities: ['バリア', 'ミラー'], series, createdAt: 0 }) as unknown as MonsterDef
    const collabBoss = { ...boss, series: '鬼' }
    const r = autoQuestSetup(collabBoss, 'chokyukyoku', 'boss', [], [], undefined, [mk('a'), mk('b', '鬼'), mk('c')])
    expect(r.heroId).toBe('b')
    expect(r.requirements.find((x) => x.tag.startsWith('ab2:'))?.count).toBe(6) // 超究極は理想どおり
    expect(r.requirements.some((x) => x.tag.startsWith('tg:'))).toBe(false) // タグそのものは条件にしない
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
  it('ボスとタグが同じ子たち（因縁の仲間）が刺さる条件になる。タグそのものは条件にしない', () => {
    const mk = (id: string, element: string, abilities: string[], tags: string[], series?: string) =>
      ({ id, name: id, templateId: 'linear3', images: {}, rarity: 'superRare', element, abilities, tags, series, createdAt: 0 }) as unknown as MonsterDef
    const rival = { ...boss, tags: ['因縁'] } as MonsterDef
    const defs = [mk('a', 'fire', ['バリア', 'ミラー'], ['因縁']), mk('b', 'fire', ['バリア', 'ミラー'], []), mk('c', 'dark', ['シールド', 'リジェネ'], ['因縁'], '鬼')]
    const r = autoQuestSetup(rival, 'kyukyoku', 'boss', [], ['バリア', 'シールド', 'リジェネ', 'ミラー'], undefined, defs)
    // 「因縁」が一致するのは a だけ（c はコラボの子なので、コラボの中だけのタグ）
    expect(r.heroId).toBe('a')
    expect(r.requirements).toEqual([
      { tag: 'el:fire', count: 4 },
      { tag: 'ab2:バリア|ミラー', count: 4 },
    ])
  })
})
