import { describe, expect, it } from 'vitest'
import { castleCleared, castleFloors, castleLineup, lastBossOf } from './castle'
import { abilitySlots } from './gimmick'
import { attackOf } from './stats'
import { autoGradeOf } from './questAuto'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
  ({ id, name: id, templateId: 'single', images: {}, createdAt: 0, attr: 'legs', questOnly: true, ...extra }) as MonsterDef
const ELS = ['fire', 'water', 'wood', 'light', 'dark'] as const

describe('降臨の格', () => {
  it('爆絶級はアビリティ2・攻撃力+4500、城主級はアビリティ3・+6000。通常の降臨は1・最大+3000', () => {
    const normal = def('n', { rarity: 'superRare' })
    const baku = def('b', { rarity: 'normal', questTier: 'bakuzetsu' })
    const last = def('l', { rarity: 'hazure', questTier: 'lastBoss' })
    expect([abilitySlots(normal), abilitySlots(baku), abilitySlots(last)]).toEqual([1, 2, 3])
    const mon = { id: 'o', defId: 'x', nodeId: 'n1', obtainedAt: 0 }
    expect(attackOf(mon, baku) - attackOf(mon, normal)).toBe(1500)
    expect(attackOf(mon, last) - attackOf(mon, normal)).toBe(3000)
    // まとめて作るとき、爆絶級は爆絶のクエストになる
    expect(autoGradeOf(baku)).toBe('bakuzetsu')
  })
})

describe('零の孤城', () => {
  const bakus = ELS.flatMap((e) => [def(`${e}1`, { element: e, questTier: 'bakuzetsu' }), def(`${e}2`, { element: e, questTier: 'bakuzetsu' })])
  const last = def('king', { element: 'dark', questTier: 'lastBoss', abilities: ['バリア'] })
  const holders = [
    def('h1', { questOnly: false, rarity: 'superRare', element: 'fire', abilities: ['バリア', 'シールド'] }),
    def('h2', { questOnly: false, rarity: 'superRare', element: 'water', abilities: ['リジェネ', 'ミラー'] }),
  ]
  const defs = [...bakus, last, ...holders]

  it('1〜10階は爆絶級を炎・水・木・光・闇の順に2周', () => {
    expect(castleLineup(defs, []).map((d) => d?.id)).toEqual(['fire1', 'water1', 'wood1', 'light1', 'dark1', 'fire2', 'water2', 'wood2', 'light2', 'dark2'])
    expect(lastBossOf(defs)?.id).toBe('king')
  })

  it('全階爆絶。11階は零属性の城主で、属性の種類を求める', () => {
    const floors = castleFloors(defs, ['バリア', 'シールド', 'リジェネ', 'ミラー'])
    expect(floors).toHaveLength(11)
    expect(floors.every((f) => f.quest.grade === 'bakuzetsu')).toBe(true)
    expect(floors[0].quest.requirements![0]).toEqual({ tag: 'el:water', count: 5 }) // 炎には水が有利
    const top = floors[10]
    expect(top.quest.element).toBeUndefined()
    expect(top.quest.requirements![0]).toEqual({ tag: 'kinds', count: 5 })
    expect(top.reward.monsterDefId).toBe('king')
    // HPは上の階ほど高い
    expect(top.quest.hp.normal).toBeGreaterThan(floors[0].quest.hp.normal)
    // ブースター詰め合わせ・カスタマイズアイテムの階がある
    expect(floors.some((f) => (f.reward.boosters ?? []).length >= 3)).toBe(true)
    expect(floors.some((f) => f.reward.custom)).toBe(true)
  })

  it('城主級がいなければ、最上階はトク玉', () => {
    const top = castleFloors([...bakus], [])[10]
    expect(top.reward.monsterDefId).toBeNull()
    expect(top.reward.eggs).toBeGreaterThan(30)
  })

  it('クリアは1回きり（月で戻らない）', () => {
    expect(castleCleared({})).toBe(0)
    expect(castleCleared({ castle: { cleared: 4 } })).toBe(4)
  })
})
