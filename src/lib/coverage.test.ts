import { describe, expect, it } from 'vitest'
import { abilitySupply, attrSupply, elementSupply, isShort, questFits, recommend, similarDefs, slotSupply } from './coverage'
import type { MonsterDef, Quest } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'chestArms', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})
const quest = (id: string, extra: Partial<Quest> = {}): Quest => ({
  id, name: id, bossDefId: 'b', attr: 'legs', weakSlots: [], gimmicks: [],
  hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: 'flame', createdAt: 0, ...extra,
})

describe('登録画面の被り・不足', () => {
  const defs = [
    def('a', { rarity: 'rare', abilities: ['バリア'], favoriteSlot: 'mon4', element: 'fire' }),
    def('b', { attr: 'legs', attrs: { n1: 'legs', n2: 'legs', n3: 'legs' } }),
  ]
  const quests = [
    quest('q1', {
      requirements: [{ tag: 'el:fire', count: 3 }, { tag: 'ab:バリア', count: 2 }, { tag: 'ab:シールド', count: 2 }],
      weakSlots: ['wed1'],
    }),
    quest('q2', { requirements: [{ tag: 'el:water', count: 3 }, { tag: 'ab:シールド', count: 2 }] }),
  ]

  it('属性：持っている数と、その属性を求めるクエストの数。部位は数だけ', () => {
    const e = elementSupply(defs, quests)
    expect(e.fire).toEqual({ have: 1, need: 1 })
    expect(e.water).toEqual({ have: 0, need: 1 })
    expect(isShort(e.water)).toBe(true)
    expect(isShort(e.light)).toBe(false) // 求めるボスがいなければ不足ではない
    expect(attrSupply(defs, quests).legs).toEqual({ have: 1, need: 0 })
  })

  it('アビリティと得意種目の需要と供給（自分は数えない）', () => {
    expect(abilitySupply('シールド', defs, quests)).toEqual({ have: 0, need: 2 })
    expect(abilitySupply('バリア', defs, quests, 'a')).toEqual({ have: 0, need: 1 })
    expect(slotSupply('wed1', defs, quests)).toEqual({ have: 0, need: 1 })
  })

  it('刺さるクエスト：編成の条件に貢献できるか', () => {
    const draft = def('new', { recipe: ['x', 'y'], jogressElements: ['fire'], abilities: ['バリア', 'シールド'], favoriteSlot: 'wed1' })
    const fits = questFits(draft, quests, { バリア: 'アーク', シールド: 'ノヴァ' })
    expect(fits[0].grade).toBe('◎')
    expect(fits[0].reasons).toEqual(['🔥炎', 'アーク', 'ノヴァ', '得意種目が弱点'])
    expect(fits[1].reasons).toEqual(['ノヴァ'])
    expect(questFits(def('x', { element: 'light' }), quests, {}).every((f) => f.grade === '×')).toBe(true)
  })

  it('同じ構成のモンスターを見つける', () => {
    const draft = def('new', { rarity: 'rare', abilities: ['バリア'], favoriteSlot: 'mon4', element: 'fire' })
    expect(similarDefs(draft, defs).map((d) => d.id)).toEqual(['a'])
  })

  it('おすすめ：属性はいちばん足りないもの。アビリティと得意種目は、同じ属性の中で足りないもの', () => {
    const rec = recommend(defs, quests, ['バリア', 'シールド', 'ミラー'], 2)
    expect(rec.element).toBe('water') // 水を求めるクエストがあるのに、水のモンスターがいない
    // 水を求めるクエスト（q2）はシールドを求めている。水のモンスターにはまだシールド持ちがいない
    expect(rec.abilities[0]).toBe('シールド')
    // 炎のモンスターとして考えると、炎の中ではバリアは足りている（a が持っている）ので、シールドが先
    const fire = recommend(defs, quests, ['バリア', 'シールド'], 1, undefined, undefined, 'fire')
    expect(fire.element).toBe('fire')
    expect(fire.abilities).toEqual(['シールド'])
  })
})
