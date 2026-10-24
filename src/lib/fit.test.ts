import { describe, expect, it } from 'vitest'
import { fitMembers, fitOf, fitQuests, fitRate } from './fit'
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
    // 零属性の子は属性の条件を満たさないので、属性のあるボスでは適正にしない（どこでも独占しないように）
    expect(fitOf(def('z', { abilities: ['バリア', 'シールド'] }), q)).toBeNull()
    expect(fitOf(def('z', { abilities: ['バリア', 'シールド'] }), { ...q, element: undefined, requirements: [{ tag: 'kinds', count: 5 }, { tag: 'ab:バリア', count: 3 }] })).toBe('best')
  })
  it('そのモンスターの適正クエストは代役以上だけ。クエストの適正キャラは貢献の順', () => {
    const easy = quest('e', { grade: 'kiwami', requirements: [{ tag: 'el:wood', count: 3 }, { tag: 'ab:バリア', count: 2 }] })
    const a = def('a', { element: 'wood', abilities: ['バリア', 'シールド'] })
    // 適正＝アビリティが2つ以上合うところだけ（1つしか求めないクエストには出さない）
    expect(fitQuests(a, [easy, q]).map((x) => x.quest.id)).toEqual(['q'])
    const b = def('b', { element: 'wood', abilities: ['バリア'] })
    expect(fitMembers(q, [b, a]).map((x) => x.def.id)).toEqual(['a', 'b'])
  })
  it('刺さる率：条件の数で重みづけ（木4・バリア3・シールド3）', () => {
    expect(fitRate(def('a', { element: 'wood', abilities: ['バリア', 'シールド'] }), q)).toBe(1)
    expect(fitRate(def('b', { element: 'wood', abilities: ['バリア'] }), q)).toBeCloseTo(0.7)
    expect(fitRate(def('c', { element: 'fire', abilities: ['バリア'] }), q)).toBeCloseTo(0.3)
  })
})

describe('適正キャラの順位は貢献（1撃＋編成の条件を埋めるぶん）', () => {
  it('1撃の重さが同じなら、条件を多く埋めるほうが上。属性が合わないモンスターは並ばない', () => {
    const q = quest('q', { grade: 'bakuzetsu', requirements: [{ tag: 'el:wood', count: 5 }, { tag: 'ab:バリア', count: 3 }, { tag: 'ab:シールド', count: 3 }] })
    const list = fitMembers(q, [
      def('one', { element: 'wood', abilities: ['バリア'] }),
      def('two', { element: 'wood', abilities: ['バリア', 'シールド'] }),
      def('fire', { element: 'fire', abilities: ['バリア', 'シールド'] }),
    ])
    expect(list.map((x) => x.def.id)).toEqual(['two', 'one'])
    expect(list[0].hit).toBeGreaterThan(list[1].hit) // アビリティ2つで1撃も重い
    expect(list[0].support).toBeGreaterThan(list[1].support)
  })
  it('零属性のボス（属性の種類）では、2属性のモンスターが属性1つのモンスターより上', () => {
    const q = quest('q', { element: undefined, grade: 'bakuzetsu', requirements: [{ tag: 'kinds', count: 5 }] })
    const list = fitMembers(q, [def('single', { element: 'wood' }), def('dual', { jogressElements: ['wood', 'fire'] } as Partial<MonsterDef>)])
    expect(list[0].def.id).toBe('dual')
  })
})

describe('適正度（理想の激レアを100%）', () => {
  it('有利な属性で、求められるアビリティを2つ持つ激レアは100%前後。アビリティが合わないほど下がる', () => {
    const q = quest('q', { grade: 'bakuzetsu', requirements: [{ tag: 'el:wood', count: 5 }, { tag: 'ab:バリア', count: 3 }, { tag: 'ab:シールド', count: 3 }] })
    const list = fitMembers(q, [def('two', { element: 'wood', abilities: ['バリア', 'シールド'] }), def('none', { element: 'wood', abilities: ['ミラー'] })])
    expect(list[0].percent).toBeGreaterThanOrEqual(95)
    expect(list[0].percent).toBeLessThanOrEqual(105)
    expect(list[1].percent).toBeLessThan(80)
  })
})

describe('超絶以上はド適正だけが活躍', () => {
  it('「2つ同時」の組を持つ激レアが100%。アビリティ1つは6割未満、合わなければもっと下（高難度と同じアビリティ5種類で）', () => {
    const q = quest('q', {
      grade: 'bakuzetsu',
      requirements: [
        { tag: 'el:wood', count: 5 },
        { tag: 'ab2:シールド|バリア', count: 2 }, // 2つの名前は並べ替えた順（comboTag と同じ）
        ...['バリア', 'シールド', 'ミラー', 'リジェネ', 'ブロック'].map((g) => ({ tag: `ab:${g}`, count: 3 })),
      ],
    })
    const list = fitMembers(q, [
      def('combo', { element: 'wood', abilities: ['バリア', 'シールド'] }),
      def('one', { element: 'wood', abilities: ['バリア', 'ワープ'] }),
      def('none', { element: 'wood', abilities: ['ワープ', 'ギア'] }),
    ])
    const pct = Object.fromEntries(list.map((x) => [x.def.id, x.percent]))
    expect(pct.combo).toBeGreaterThanOrEqual(95)
    expect(pct.one).toBeLessThan(60)
    expect(pct.none).toBeLessThan(pct.one - 15)
  })
})
