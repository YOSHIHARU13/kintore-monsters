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
  it('アビリティはハズレ0・ノーマル1・レア2・激レア3、攻撃力は爆絶が激レア★3より少し下、超絶がレア★3より下', () => {
    const at = (rarity: MonsterDef['rarity']) => def('x', { rarity })
    expect((['hazure', 'normal', 'uncommon', 'superRare'] as const).map((r) => abilitySlots(at(r)))).toEqual([0, 1, 2, 3])
    const mon = { id: 'o', defId: 'x', nodeId: 'n1', obtainedAt: 0 }
    expect(attackOf(mon, at('superRare')) - attackOf(mon, at('normal'))).toBe(5000)
    expect(attackOf(mon, at('uncommon')) - attackOf(mon, at('normal'))).toBe(1500)
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

  it('全階爆絶。11階は零属性の城主で、3属性×3体ずつを求める', () => {
    const floors = castleFloors('2026-10', defs, ['バリア', 'シールド', 'リジェネ', 'ミラー'])
    expect(floors).toHaveLength(11)
    expect(floors.every((f) => f.quest.grade === 'bakuzetsu')).toBe(true)
    expect(floors[0].quest.requirements![0]).toEqual({ tag: 'el:water', count: 4 }) // 炎には水が有利。1〜10階は属性の種類も
    expect(floors[0].quest.requirements).toContainEqual({ tag: 'kinds', count: 3 })
    const top = floors[10]
    expect(top.quest.element).toBeUndefined()
    // 3属性×3体ずつ（1属性のモンスター6体では届かない）
    const els = top.quest.requirements!.filter((r) => r.tag.startsWith('el:'))
    expect(els).toHaveLength(3)
    expect(els.every((r) => r.count === 3)).toBe(true)
    expect(top.quest.requirements!.filter((r) => r.tag.startsWith('ab:'))).toHaveLength(4)
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

describe('高難度の条件は個性優先', () => {
  it('今いるモンスターに合わせず、塔→禁筋→孤城を合わせて、同じ属性の階でアビリティの組み合わせが均等に出る', async () => {
    const { towerFloors } = await import('./tower')
    const { kinkinFloors } = await import('./kinkin')
    const { abilitySets } = await import('./questAuto')
    const ABS = ['バリア', 'シールド', 'リジェネ', 'ミラー', 'ワープ', 'ブロック', 'ウィンド']
    const els = ['fire', 'water', 'wood', 'light', 'dark'] as const
    const defs = Array.from({ length: 30 }, (_, i) =>
      def(`b${i}`, { element: els[i % 5], bossGrade: i < 10 ? 'chozetsu' : 'bakuzetsu', castleOnly: i >= 20, abilities: ['バリア'] }),
    )
    const tower = towerFloors('2026-10', defs, ABS).map((f) => f.quest)
    const kinkin = kinkinFloors('2026-10', defs, ABS, [], undefined, tower).map((f) => f.quest)
    const castle = castleFloors('2026-10', defs, ABS, [], undefined, [...tower, ...kinkin]).map((f) => f.quest)
    const all = abilitySets([...tower, ...kinkin, ...castle])
    const sets = all.map((s) => [...s.set].sort().join('+'))
    // 同じ属性の階（塔・禁筋・孤城を全部合わせて）で、アビリティの2つの組み合わせが均等に出る：
    // 21通り全部が出て、回数の差は2まで（2つ持ちのモンスターが、どの組み合わせでも同じくらいの数の階に刺さる）
    const pairsOf = (s: string[]) => s.flatMap((a, i) => s.slice(i + 1).map((b) => [a, b].sort().join('+')))
    const hard = all.filter((s) => s.element !== 'none' && s.set.length >= 3)
    for (const el of new Set(hard.map((s) => s.element))) {
      const count: Record<string, number> = {}
      for (const p of hard.filter((s) => s.element === el).flatMap((s) => pairsOf(s.set))) count[p] = (count[p] ?? 0) + 1
      const n = Object.values(count)
      expect(Object.keys(count).length).toBe(21) // 21通り全部（どの激レアにも刺さる階がある）
      expect(Math.max(...n) - Math.min(...n)).toBeLessThanOrEqual(2)
    }
    // 同じ属性の階では、同じ組を使わない
    const keyed = all.map((s) => `${s.element}:${[...s.set].sort().join('+')}`)
    expect(new Set(keyed).size).toBe(keyed.length)
    // 誰も持っていないアビリティも求める（あとから来るモンスターが刺さる）
    expect(sets.some((s) => s.includes('ウィンド'))).toBe(true)
  })
})
