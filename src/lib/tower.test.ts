import { describe, expect, it } from 'vitest'
import { allTowers, towerCleared, towerCount, towerFloors, towerLineup } from './tower'
import type { MonsterDef, Quest } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef =>
  ({ id, name: id, templateId: 'single', images: { n1: 'img' }, createdAt: 0, ...extra }) as MonsterDef
const chozetsu = (bossDefId: string) => ({ kind: 'boss', grade: 'chozetsu', bossDefId }) as Quest

// 超絶ボス：炎2・水2・木1・光2・闇2（図鑑の順）。塔限定2体。ほかの子
const bosses = [
  def('f1', { questOnly: true, element: 'fire' }),
  def('w1', { questOnly: true, element: 'water' }),
  def('f2', { questOnly: true, element: 'fire' }),
  def('g1', { questOnly: true, element: 'wood' }),
  def('l1', { questOnly: true, element: 'light' }),
  def('d1', { questOnly: true, element: 'dark' }),
  def('w2', { questOnly: true, element: 'water' }),
  def('l2', { questOnly: true, element: 'light' }),
  def('d2', { questOnly: true, element: 'dark' }),
]
const defs = [
  ...bosses,
  def('t1', { questOnly: true, tower: true, element: 'dark' }),
  def('t2', { questOnly: true, tower: true, element: 'light' }),
  def('q', { questOnly: true, element: 'wood' }), // 超絶ではない降臨
  def('a', { rarity: 'normal', element: 'fire', abilities: ['バリア'] }),
]
const quests = bosses.map((b) => chozetsu(b.id))

describe('試練の塔', () => {
  it('1〜10階は、超絶のボスを炎・水・木・光・闇の順に2周（同じ属性は図鑑順）。足りない枠はほかの降臨で埋める', () => {
    expect(towerLineup(defs, quests).map((d) => d?.id)).toEqual(['f1', 'w1', 'g1', 'l1', 'd1', 'f2', 'w2', 'q', 'l2', 'd2'])
  })
  it('11階は塔限定モンスターがボスで、倒すともらえる（パターンごとに入れ替わる）', () => {
    const oct = towerFloors('2026-10', defs, ['バリア'], quests)
    const nov = towerFloors('2026-11', defs, ['バリア'], quests)
    expect(oct).toHaveLength(11)
    expect(oct[10].quest.bossDefId).toBe(oct[10].reward.monsterDefId)
    expect(['t1', 't2']).toContain(oct[10].reward.monsterDefId)
    expect(nov[10].reward.monsterDefId).not.toBe(oct[10].reward.monsterDefId)
    // 1〜10階のボスも、月のパターンでずれる（3か月で一回り）
    expect(oct.slice(0, 10).map((f) => f.quest.bossDefId)).not.toEqual(nov.slice(0, 10).map((f) => f.quest.bossDefId))
    const jan = towerFloors('2027-01', defs, ['バリア'], quests)
    expect(oct.slice(0, 10).map((f) => f.quest.bossDefId)).toEqual(jan.slice(0, 10).map((f) => f.quest.bossDefId))
  })
  it('属性はボスの属性。上の階ほどHPが高く、3階から条件、8階から超絶。条件はボスに有利な属性と、誰かが持っているスキル', () => {
    const floors = towerFloors('2026-10', defs, ['バリア', 'シールド'], quests)
    for (let i = 1; i < floors.length; i++) expect(floors[i].quest.hp.normal).toBeGreaterThan(floors[i - 1].quest.hp.normal)
    // 10月はパターン1：並びが3つずれて、1階は光のボス（l1）、6階は光のボス（l2）
    expect(floors[0].quest.bossDefId).toBe('l1')
    expect(floors[0].quest.element).toBe('light')
    expect(floors[0].quest.requirements).toEqual([])
    expect(floors[5].quest.element).toBe('light')
    expect(floors[5].quest.requirements!.filter((r) => r.tag.startsWith('el:')).map((r) => r.tag)).toEqual(['el:dark'])
    expect(floors[5].quest.requirements!.some((r) => r.tag.includes('シールド'))).toBe(false) // 誰も持っていないスキルは求めない
    expect(floors[7].quest.grade).toBe('chozetsu')
  })
  it('塔限定モンスターがいなければ、11階は卵', () => {
    const floors = towerFloors('2026-10', defs.filter((d) => !d.tower), [], quests)
    expect(floors[10].reward.monsterDefId).toBeNull()
    expect(floors[10].reward.eggs).toBeGreaterThan(0)
  })
  it('クリアした階は月が変わると0に戻る', () => {
    expect(towerCleared({ tower: { month: '2026-10', cleared: 4 } }, '2026-10')).toBe(4)
    expect(towerCleared({ tower: { month: '2026-09', cleared: 10 } }, '2026-10')).toBe(0)
  })
  it('月ごとに3パターン（胸腕→脚→背肩の月）：どのボスもその月の部位で戦い、弱点もその部位の種目。条件も変わる', () => {
    const oct = towerFloors('2026-10', defs, ['バリア'], quests)
    const nov = towerFloors('2026-11', defs, ['バリア'], quests)
    expect(new Set(oct.map((f) => f.quest.attr)).size).toBe(1)
    expect(oct[0].quest.attr).not.toBe(nov[0].quest.attr)
    expect(oct[5].quest.weakSlots.every((w) => w.startsWith(oct[5].quest.attr === 'chestArms' ? 'mon' : oct[5].quest.attr === 'legs' ? 'wed' : 'fri'))).toBe(true)
    expect(towerFloors('2027-01', defs, ['バリア'], quests)[0].quest.attr).toBe(oct[0].quest.attr) // 3か月で一回り
    expect(oct[6].quest.requirements).toContainEqual({ tag: `pt:${oct[6].quest.attr}`, count: 2 })
  })
  it('塔のギミックは、そのボスの超絶クエストで使っているスキルを避ける', () => {
    const holders = [def('x', { rarity: 'superRare', element: 'fire', abilities: ['バリア', 'シールド'] }), def('y', { rarity: 'superRare', element: 'fire', abilities: ['リジェネ', 'ミラー'] })]
    const withQuest = [
      { ...chozetsu('l2'), requirements: [{ tag: 'ab:シールド', count: 3 }, { tag: 'ab:バリア', count: 3 }] },
      ...quests.filter((q) => q.bossDefId !== 'l2'),
    ]
    const floors = towerFloors('2026-10', [...defs, ...holders], ['バリア', 'シールド', 'リジェネ', 'ミラー'], withQuest)
    const l2 = floors.find((f) => f.quest.bossDefId === 'l2')!
    const abilities = l2.quest.requirements!.filter((r) => r.tag.startsWith('ab:')).map((r) => r.tag)
    expect(abilities.length).toBeGreaterThan(0)
    expect(abilities).not.toContain('ab:シールド')
    expect(abilities).not.toContain('ab:バリア')
  })
  it('コラボの子と、超究極のボスは塔に入れない', () => {
    const extra = [def('c1', { questOnly: true, element: 'fire', series: '鬼' }), def('k1', { questOnly: true, element: 'fire' })]
    const qs = [...quests, chozetsu('c1'), { kind: 'boss', grade: 'chokyukyoku', bossDefId: 'k1' } as Quest]
    const ids = towerLineup([def('c1', { questOnly: true, element: 'fire', series: '鬼' }), ...defs, ...extra.slice(1)], qs).map((d) => d?.id)
    expect(ids).not.toContain('c1')
    expect(ids).not.toContain('k1')
    expect(ids[0]).toBe('f1')
  })
})

describe('塔は超絶10体ごと', () => {
  const twenty = Array.from({ length: 20 }, (_, i) =>
    def(`c${i}`, { questOnly: true, bossGrade: 'chozetsu', element: (['fire', 'water', 'wood', 'light', 'dark'] as const)[i % 5], attrs: { n1: 'legs' }, createdAt: i }),
  )
  it('超絶が20体なら塔は2つ。2つ目の塔は11〜20体目の超絶', () => {
    expect(towerCount(twenty, [])).toBe(2)
    expect(towerCount(twenty.slice(0, 19), [])).toBe(1)
    const towers = allTowers('2026-10', twenty, [])
    expect(towers).toHaveLength(2)
    const second = towers[1].slice(0, 10).map((f) => f.quest.bossDefId)
    expect(new Set(second)).toEqual(new Set(twenty.slice(10).map((d) => d.id)))
    expect(towers[1][0].quest.name).toBe('第2の塔 1階')
    expect(towers[1][0].quest.id).not.toBe(towers[0][0].quest.id)
  })
  it('上の階では「ボスと同じ部位の子」も求める', () => {
    const top = allTowers('2026-10', twenty, [])[0][8]
    expect(top.quest.requirements).toContainEqual({ tag: 'pt:legs', count: 3 })
  })
  it('クリアは塔ごと', () => {
    const st = { tower: { month: '2026-10', cleared: 3 }, towerMore: { month: '2026-10', cleared: { '1': 7 } } }
    expect(towerCleared(st, '2026-10', 0)).toBe(3)
    expect(towerCleared(st, '2026-10', 1)).toBe(7)
    expect(towerCleared(st, '2026-11', 1)).toBe(0)
  })
})
