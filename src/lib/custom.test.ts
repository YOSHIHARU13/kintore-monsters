import { describe, expect, it } from 'vitest'
import { customAttack, customized, isFavorite, itemInfo, itemLabel, rollItem, rollTempleItems } from './custom'
import { tagsOf } from './formation'
import { attackOf } from './stats'
import { partnerRate } from './partner'
import type { MonsterDef, OwnedMonster, Quest } from '../types'

const seq = (...values: number[]) => () => values.shift() ?? 0.99
const def = { id: 'd', name: 'd', attr: 'legs', templateId: 'linear3', images: {}, createdAt: 0, rarity: 'normal', abilities: ['バリア'], favoriteSlot: 'mon1' } as MonsterDef
const mon = (extra: Partial<OwnedMonster> = {}): OwnedMonster => ({ id: 'o', defId: 'd', nodeId: 'n1', obtainedAt: 0, ...extra })

describe('カスタマイズアイテム', () => {
  it('アイテムの名前と格', () => {
    expect(itemLabel('atk1')).toBe('🥉 攻撃力 +500')
    expect(itemLabel('atk3')).toBe('🥇 攻撃力 +2,000')
    expect(itemLabel('fav')).toBe('🥈 得意種目の追加')
    expect(itemLabel('ab:ミラー')).toBe('🥇 アビリティ追加：ルーン')
    expect(itemInfo('ab:ミラー').grade).toBe(3)
  })

  it('くじ：銅・銀・金を決めて、銀は一部が得意種目、金は一部がアビリティ', () => {
    expect(rollItem('normal', ['バリア'], seq(0.1))).toBe('atk1')
    expect(rollItem('normal', ['バリア'], seq(0.7, 0.1))).toBe('fav')
    expect(rollItem('normal', ['バリア'], seq(0.7, 0.9))).toBe('atk2')
    expect(rollItem('normal', ['バリア'], seq(0.99, 0.1, 0))).toBe('ab:バリア')
    expect(rollItem('normal', ['バリア'], seq(0.99, 0.9))).toBe('atk3')
    // 修羅場は金が出やすい（20%）
    expect(rollItem('hard', [], seq(0.85, 0.9))).toBe('atk3')
  })

  it('神殿：時の間は1個確定、修羅場は2回のくじ。運極1体ごとにくじが増える', () => {
    expect(rollTempleItems('normal', 0, [], seq(0.5, 0.1))).toEqual(['atk1'])
    expect(rollTempleItems('hard', 0, [], seq(0.1, 0.1, 0.1, 0.1))).toHaveLength(2)
    expect(rollTempleItems('hard', 0, [], seq(0.9, 0.9))).toHaveLength(0)
    expect(rollTempleItems('normal', 2, [], seq(0.5, 0.1, 0.1, 0.1, 0.9))).toHaveLength(2)
  })

  it('付けると、攻撃力・得意種目・アビリティが増える', () => {
    expect(customAttack(mon({ custom: 'atk2' }))).toBe(1000)
    expect(attackOf(mon({ custom: 'atk2' }), def) - attackOf(mon(), def)).toBe(1000)
    const fav = customized(def, mon({ custom: 'fav', customSlot: 'tue1' }))
    expect(isFavorite(fav, 'mon1')).toBe(true)
    expect(isFavorite(fav, 'tue1')).toBe(true)
    expect(partnerRate(mon({ custom: 'fav', customSlot: 'tue1' }), def, 'tue1')).toBeGreaterThan(partnerRate(mon(), def, 'tue1'))
    // ノーマル（アビリティ1つまで）でも、カスタマイズのアビリティは別に数える
    const ab = customized(def, mon({ custom: 'ab:シールド' }))
    expect(tagsOf(ab)['ab:シールド']).toBe(1)
    expect(tagsOf(ab)['ab:バリア']).toBe(1)
    expect(tagsOf(ab)['ab2:シールド|バリア']).toBe(1)
    // もともと持っているアビリティは増えない
    expect(customized(def, mon({ custom: 'ab:バリア' }))).toBe(def)
  })
})

describe('金の獣神化は2属性', () => {
  it('相手の属性も持つ（同じ属性なら超属性）。金でない個体は1属性のまま', async () => {
    const { customized } = await import('./custom')
    const { elementInfo } = await import('./element')
    const { kindsOf } = await import('./formation')
    const def = { id: 'a', name: 'a', attr: 'legs', templateId: 'linear3', images: {}, createdAt: 0, element: 'fire', jogressPartner: 'b', partnerElement: 'wood' } as MonsterDef
    const gold = customized(def, { nodeId: 'n3', shinkaGold: true })
    expect(elementInfo(gold).elements).toEqual(['fire', 'wood'])
    expect(kindsOf([gold])).toBe(2)
    expect(elementInfo(customized(def, { nodeId: 'n3' })).elements).toEqual(['fire'])
    expect(elementInfo(customized({ ...def, partnerElement: 'fire' }, { nodeId: 'n3', shinkaGold: true }))).toEqual({ elements: ['fire'], super: true })
  })
})

describe('金の獣神化はアビリティ3つ・零属性のボスに強い', () => {
  it('相手のアビリティから1つ足して3つ。零属性のボスには2属性で×1.5', async () => {
    const { customized } = await import('./custom')
    const { setHit } = await import('./quest')
    const def = { id: 'a', name: 'a', attr: 'legs', templateId: 'linear3', images: {}, createdAt: 0, tier: 'superRare', element: 'fire', abilities: ['バリア', 'ミラー'], jogressPartner: 'b', partnerElement: 'wood', partnerAbilities: ['ミラー', 'ワープ'] } as MonsterDef
    const mon = { id: 'o', defId: 'a', nodeId: 'n3', obtainedAt: 0, shinka: true, shinkaGold: true }
    const gold = customized(def, mon)
    expect(Object.keys(tagsOf(gold)).filter((t) => t.startsWith('ab:')).sort()).toEqual(['ab:バリア', 'ab:ミラー', 'ab:ワープ'])
    const zero = { id: 'q', name: 'q', bossDefId: 'x', attr: 'backShoulders', weakSlots: [], hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: '', createdAt: 0 } as unknown as Quest
    const set = { slotId: 'mon1', day: 'mon' as const, eligible: true }
    const plain = customized(def, { ...mon, shinkaGold: false })
    const ratio = setHit(set, zero, [{ mon, def: gold }], '').damage / setHit(set, zero, [{ mon, def: plain }], '').damage
    expect(ratio).toBeCloseTo(1.5, 1)
  })
})
