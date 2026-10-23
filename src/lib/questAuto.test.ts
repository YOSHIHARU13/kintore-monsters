import { describe, expect, it } from 'vitest'
import { autoGradeOf, autoQuestSetup, basisRequirements, bossQuestSync, coverageOf, spotlightOf } from './questAuto'
import { fitsQuest, isStrict } from './quest'
import type { MonsterDef, Quest } from '../types'

const boss = { id: 'b1', name: 'アシリュウ', templateId: 'single', attrs: { n1: 'legs' }, images: {}, element: 'water', questOnly: true, rarity: 'superRare', createdAt: 0 } as unknown as MonsterDef

describe('おまかせのクエスト', () => {
  it('基本は弱点属性＋アビリティの持ち物検査。格が上がるほど、数も種類も増える', () => {
    const sr = (id: string, element: string, abilities: string[]) =>
      ({ id, name: id, templateId: 'linear3', images: {}, rarity: 'superRare', element, abilities, createdAt: 0 }) as unknown as MonsterDef
    const all = ['バリア', 'シールド', 'リジェネ', 'ミラー']
    const defs = [sr('h', 'fire', ['バリア', 'ミラー']), sr('i', 'water', ['シールド', 'リジェネ'])]
    const at = (g: Parameters<typeof autoQuestSetup>[1]) => autoQuestSetup(boss, g, 'boss', [], all, undefined, defs).requirements
    expect(at('jokyu')).toEqual([{ tag: 'el:wood', count: 2 }]) // 水には木が有利。アビリティなし
    expect(at('kiwami')).toEqual([{ tag: 'el:wood', count: 3 }, { tag: expect.stringMatching(/^ab:/), count: 2 }])
    expect(at('kyukyoku')[1].count).toBe(3)
    // 超絶：アビリティ2種類。1体1つずつでよい（単アビの子も連れて行ける）
    const chozetsu = at('chozetsu')
    expect(chozetsu[0]).toEqual({ tag: 'el:wood', count: 4 })
    expect(chozetsu.filter((r) => r.tag.startsWith('ab:'))).toHaveLength(2)
    expect(chozetsu.some((r) => r.tag.startsWith('ab2:'))).toBe(false)
    // 爆絶：有利な属性5、アビリティ3種類、実際に誰かが2つ同時に持っている組み合わせ×2
    const bakuzetsu = at('bakuzetsu')
    expect(bakuzetsu[0]).toEqual({ tag: 'el:wood', count: 5 })
    expect(bakuzetsu.find((r) => r.tag.startsWith('ab2:'))).toMatchObject({ count: 2 })
    expect(['ab2:バリア|ミラー', 'ab2:シールド|リジェネ']).toContain(bakuzetsu.find((r) => r.tag.startsWith('ab2:'))!.tag)
    expect(bakuzetsu.filter((r) => r.tag.startsWith('ab:'))).toHaveLength(3)
    // 誰も持っていないアビリティは求めない
    const r2 = autoQuestSetup(boss, 'chozetsu', 'boss', [], all, undefined, [{ ...sr('n', 'fire', ['ミラー']), rarity: 'normal' } as MonsterDef])
    expect(r2.requirements).toEqual([{ tag: 'el:wood', count: 4 }, { tag: 'ab:ミラー', count: 3 }])
  })
  it('無属性のボスは、弱点の代わりに属性の種類を求める', () => {
    const none = { ...boss, element: undefined } as MonsterDef
    expect(autoQuestSetup(none, 'chozetsu', 'boss', [], [], undefined, []).requirements).toEqual([{ tag: 'kinds', count: 5 }])
    expect(autoQuestSetup(none, 'jokyu', 'boss', [], [], undefined, []).requirements).toEqual([{ tag: 'kinds', count: 3 }])
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
    // ガチャの子：激レア→超絶（コラボは超究極）
    const gacha = { ...boss, questOnly: false }
    expect(autoGradeOf(gacha)).toBe('chozetsu')
    expect(autoGradeOf({ ...gacha, series: '鬼退治コラボ' })).toBe('chokyukyoku')
    // 降臨の激レアは爆絶
    expect(autoGradeOf(boss)).toBe('bakuzetsu')
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
  it('タグはない：コラボでないボスは、同じ属性の子がいても誰かを接待しない', () => {
    const mk = (id: string, series?: string) =>
      ({ id, name: id, templateId: 'linear3', images: {}, rarity: 'superRare', element: 'fire', abilities: ['バリア'], series, createdAt: 0 }) as unknown as MonsterDef
    const r = autoQuestSetup(boss, 'kyukyoku', 'boss', [], ['バリア'], undefined, [mk('a'), mk('b')])
    expect(r.heroId).toBeUndefined()
    expect(r.requirements).toEqual([{ tag: 'el:wood', count: 3 }, { tag: 'ab:バリア', count: 3 }])
  })
})

describe('降臨のボスクエストは自動', () => {
  it('なければ作る。格や部位が変わったら合わせる。合っていれば何もしない。塔限定・城主は作らない', () => {
    const hp = () => 1000
    const made = bossQuestSync({ ...boss, bossGrade: 'kiwami' }, [], [], [], hp)!
    expect(made.id).toBeNull()
    expect(made.data).toMatchObject({ kind: 'boss', bossDefId: 'b1', grade: 'kiwami', attr: 'legs', hp: { normal: 1000 } })
    const existing = [{ id: 'q', kind: 'boss' as const, bossDefId: 'b1', grade: 'kiwami' as const, attr: 'legs' as const }]
    expect(bossQuestSync({ ...boss, bossGrade: 'kiwami' }, existing, [], [], hp)).toBeNull()
    expect(bossQuestSync({ ...boss, bossGrade: 'bakuzetsu' }, existing, [], [], hp)).toMatchObject({ id: 'q', data: { grade: 'bakuzetsu' } })
    expect(bossQuestSync({ ...boss, tower: true }, [], [], [], hp)).toBeNull()
    expect(bossQuestSync({ ...boss, castleLord: true }, [], [], [], hp)).toBeNull()
  })
})

describe('適正の偏りをなくす（主役）', () => {
  const mk = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
    ({ id, name: id, attr: 'legs', templateId: 'single', images: {}, createdAt: 0, ...extra }) as MonsterDef
  const ELS = ['fire', 'water', 'wood', 'light', 'dark'] as const
  const ABS = ['バリア', 'シールド', 'リジェネ', 'ミラー', 'パルス', 'ルーン']
  // ガチャの激レア10体（属性2体ずつ。アビリティはいろいろ）と、降臨20体
  const heroes = Array.from({ length: 10 }, (_, i) =>
    mk(`h${i}`, { tier: 'superRare', element: ELS[i % 5], abilities: [ABS[i % 6], ABS[(i + 2) % 6]] }),
  )
  const bosses = Array.from({ length: 20 }, (_, i) => mk(`b${i}`, { questOnly: true, bossGrade: 'chozetsu', element: ELS[i % 5] }))
  const defs = [...heroes, ...bosses]
  it('クエストを順に作ると、どの激レアにも刺さるクエストができて、独占する子がいない', () => {
    const made: Quest[] = []
    for (const b of bosses) {
      const r = autoQuestSetup(b, 'chozetsu', 'boss', made, ABS, undefined, defs)
      made.push({ id: `q-${b.id}`, kind: 'boss', bossDefId: b.id, requirements: r.requirements } as Quest)
    }
    const counts = heroes.map((h) => coverageOf(h, made))
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(3)
  })
  it('主役は、有利な属性を持つ子のうち、まだ刺さるクエストが少ない子', () => {
    const boss = mk('B', { questOnly: true, element: 'fire' }) // 水が有利
    const star = spotlightOf(boss, [], defs)
    expect(star?.element).toBe('water')
  })
})
