import { describe, expect, it } from 'vitest'
import { battlesReached, castleAvailable, castleBest, castleCleared, castleFloors, castleLineup, castleOpen, lastBossOf } from './castle'
import { towerOpen } from './tower'
import { abilitySlots } from './gimmick'
import { attackOf } from './stats'
import { autoGradeOf } from './questAuto'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
  ({ id, name: id, templateId: 'single', images: {}, createdAt: 0, attr: 'legs', questOnly: true, ...extra }) as MonsterDef
const ELS = ['fire', 'water', 'wood', 'light', 'dark'] as const

describe('降臨のレア度＝ボスの格', () => {
  it('アビリティはハズレ0・ノーマル1・レア2・激レア3、攻撃力の上乗せは0・1500・4500・6000', () => {
    const at = (rarity: MonsterDef['rarity']) => def('x', { rarity })
    expect((['hazure', 'normal', 'uncommon', 'superRare'] as const).map((r) => abilitySlots(at(r)))).toEqual([0, 1, 2, 3])
    const mon = { id: 'o', defId: 'x', nodeId: 'n1', obtainedAt: 0 }
    expect(attackOf(mon, at('superRare')) - attackOf(mon, at('normal'))).toBe(4500)
    expect(attackOf(mon, at('uncommon')) - attackOf(mon, at('normal'))).toBe(3000)
    // まとめて作るときの格：激レア→爆絶、レア→超絶（コラボは超究極）
    expect(autoGradeOf(at('superRare'))).toBe('bakuzetsu')
    expect(autoGradeOf(at('uncommon'))).toBe('chozetsu')
    expect(autoGradeOf(def('c', { rarity: 'uncommon', series: '鬼' }))).toBe('chokyukyoku')
    expect(autoGradeOf(at('hazure'))).toBe('jokyu')
  })
})

describe('零の孤城', () => {
  const bakus = ELS.flatMap((e) => [
    def(`${e}1`, { element: e, bossGrade: 'bakuzetsu', castleOnly: true }),
    def(`${e}2`, { element: e, bossGrade: 'bakuzetsu', castleOnly: true }),
  ])
  const last = def('king', { element: 'dark', bossGrade: 'bakuzetsu', castleLord: true, abilities: ['バリア'] })
  const holders = [
    def('h1', { questOnly: false, rarity: 'superRare', element: 'fire', abilities: ['バリア', 'シールド'] }),
    def('h2', { questOnly: false, rarity: 'superRare', element: 'water', abilities: ['リジェネ', 'ミラー'] }),
  ]
  const defs = [...bakus, last, ...holders]

  it('1〜10階は孤城限定の子を炎・水・木・光・闇の順に2周。城主は入れない。各階のボスは毎月の初回クリアで手に入る', () => {
    expect(castleLineup(defs, []).map((d) => d?.id)).toEqual(['fire1', 'water1', 'wood1', 'light1', 'dark1', 'fire2', 'water2', 'wood2', 'light2', 'dark2'])
    expect(lastBossOf(defs)?.id).toBe('king')
    const floors = castleFloors('2026-10', defs, [])
    expect(floors[0].reward.monsterDefId).toBe('fire1')
    // 孤城限定がいなくて、爆絶のボスで埋めた階は落とさない
    const filled = castleFloors('2026-10', [def('bz', { element: 'fire', bossGrade: 'bakuzetsu' })], [])
    expect(filled[0].quest.bossDefId).toBe('bz')
    expect(filled[0].reward.monsterDefId).toBeNull()
  })

  it('全階爆絶。11階は零属性の城主で、属性の種類を求める', () => {
    const floors = castleFloors('2026-10', defs, ['バリア', 'シールド', 'リジェネ', 'ミラー'])
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

  it('城主がいなければ、最上階はトク玉', () => {
    const top = castleFloors('2026-10', [...bakus], [])[10]
    expect(top.reward.monsterDefId).toBeNull()
    expect(top.reward.eggs).toBeGreaterThan(12) // いつもの12個＋城主のかわり
  })

  it('塔は毎月1〜10日、孤城は21日〜月末。クリアは月ごと（月が変わると0から）', () => {
    expect(castleCleared({}, '2026-10')).toBe(0)
    expect(castleCleared({ castle: { month: '2026-10', cleared: 4 } }, '2026-10')).toBe(4)
    expect(castleCleared({ castle: { month: '2026-10', cleared: 4 } }, '2026-11')).toBe(0)
    expect(castleOpen('2026-10-20')).toBe(false)
    expect(castleOpen('2026-10-21')).toBe(true)
    expect(castleOpen('2026-10-31')).toBe(true)
    expect(towerOpen('2026-10-10')).toBe(true)
    expect(towerOpen('2026-10-11')).toBe(false)
  })

  it('コラボの子と超究極のボスは入れない', () => {
    const collab = def('cb', { element: 'fire', bossGrade: 'bakuzetsu', series: '鬼' })
    const ids = castleLineup([collab, ...defs], [{ kind: 'boss', grade: 'chokyukyoku', bossDefId: 'fire1' }]).map((d) => d?.id)
    expect(ids).not.toContain('cb')
    expect(ids).not.toContain('fire1')
  })
})

describe('零の孤城のバトル', () => {
  it('HPを3等分して、削った分だけ突破（出撃は1回）', () => {
    expect(battlesReached(0, 900)).toBe(0)
    expect(battlesReached(299, 900)).toBe(0)
    expect(battlesReached(300, 900)).toBe(1)
    expect(battlesReached(650, 900)).toBe(2)
    expect(battlesReached(2000, 900)).toBe(3)
  })
  it('2バトル突破で次の階。最上階は1〜10階を全部突破してから。以前の記録は全部突破として読む', () => {
    const st = { castleBattles: { month: '2026-10', best: { '1': 2, '2': 1 } } }
    expect(castleAvailable(st, '2026-10', 1)).toBe(true)
    expect(castleAvailable(st, '2026-10', 2)).toBe(true)
    expect(castleAvailable(st, '2026-10', 3)).toBe(false)
    const all = { castleBattles: { month: '2026-10', best: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i + 1), 3])) } }
    expect(castleAvailable(all, '2026-10', 11)).toBe(true)
    expect(castleAvailable({ castleBattles: { month: '2026-10', best: { ...all.castleBattles.best, '7': 2 } } }, '2026-10', 11)).toBe(false)
    expect(castleBest({ castle: { month: '2026-10', cleared: 2 } }, '2026-10', 2)).toBe(3)
    expect(castleCleared(all, '2026-10')).toBe(10)
  })
})
