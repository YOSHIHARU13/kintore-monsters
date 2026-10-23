import { describe, expect, it } from 'vitest'
import { castleFloors } from './castle'
import { floorRatio, idealPool, lifespanOf, lifespansOf } from './lifespan'
import type { MonsterDef } from '../types'

const ELS = ['fire', 'water', 'wood', 'light', 'dark'] as const
const ABS = ['バリア', 'シールド', 'リジェネ', 'ミラー', 'パルス', 'ルーン', 'アーク', 'ノヴァ']
const PARTS = ['chestArms', 'legs', 'backShoulders'] as const
const mk = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
  ({ id, name: id, attr: 'legs', templateId: 'linear3', images: {}, createdAt: 0, ...extra }) as MonsterDef

// ガチャの子（激レア n 体・レア20体）と、孤城限定10体・爆絶10体
function roster(superRares: number): MonsterDef[] {
  return [
    ...Array.from({ length: superRares }, (_, i) =>
      mk(`sr${i}`, { tier: 'superRare', element: ELS[i % 5], attr: PARTS[i % 3], abilities: [ABS[i % 8], ABS[(i + 3) % 8]], createdAt: i }),
    ),
    ...Array.from({ length: 20 }, (_, i) => mk(`r${i}`, { tier: 'rare', element: ELS[i % 5], attr: PARTS[i % 3], abilities: [ABS[(i + 1) % 8]], createdAt: 100 + i })),
    ...Array.from({ length: 10 }, (_, i) =>
      mk(`c${i}`, { questOnly: true, castleOnly: true, bossGrade: 'bakuzetsu', templateId: 'single', element: ELS[i % 5], createdAt: 200 + i }),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      mk(`b${i}`, { questOnly: true, bossGrade: 'bakuzetsu', templateId: 'single', element: ELS[i % 5], abilities: [ABS[i % 8]], createdAt: 300 + i }),
    ),
  ]
}
const floorsOf = (defs: MonsterDef[]) => castleFloors('2026-10', defs, ABS).map((f) => f.quest)

describe('コンテンツの寿命', () => {
  it('激レアが増えるほど、孤城の階を1日で削れる割合が上がる', () => {
    const few = roster(5)
    const many = roster(40)
    const avg = (defs: MonsterDef[]) => floorsOf(defs).reduce((s, q) => s + floorRatio(q, idealPool(defs, q)), 0) / 11
    expect(avg(many)).toBeGreaterThan(avg(few))
  })
  it('全部の階が楽勝になるまでの激レアの数：最短（ぴったり刺さる子）≦ 目安（ばらばらの子）', { timeout: 60000 }, () => {
    const r = lifespanOf(roster(10), floorsOf, ABS)
    expect(r.floors).toHaveLength(11)
    expect(r.best).not.toBeNull()
    if (r.typical !== null) expect(r.best!).toBeLessThanOrEqual(r.typical)
  })
})

describe('手持ちの寿命', () => {
  it('何も持っていなければ1日で倒せる階はなく、理想より厳しい。手持ちを育てきった階の数は理想以下', { timeout: 60000 }, () => {
    const defs = roster(10)
    const none = lifespansOf(defs, [], floorsOf, ABS)
    expect(none.mine.easy).toBe(0)
    expect(none.mine.grownEasy).toBe(0)
    // 激レアを全員、生まれたて（1段階目）で持っている
    const owned = defs
      .filter((d) => d.tier === 'superRare')
      .map((d, i) => ({ id: `o${i}`, defId: d.id, nodeId: 'n1', obtainedAt: 0 }))
    const some = lifespansOf(defs, owned, floorsOf, ABS)
    const avg = (fs: { ratio: number }[]) => fs.reduce((s, f) => s + f.ratio, 0) / fs.length
    expect(avg(some.mine.floors)).toBeGreaterThan(0)
    expect(avg(some.mine.floors)).toBeLessThan(avg(some.ideal.floors))
    expect(some.mine.grownEasy).toBeLessThanOrEqual(some.ideal.easy)
  })
})

describe('寿命のひとこと', () => {
  it('楽勝なら足しどき、まだなら「あと約◯体」', async () => {
    const { lifespanText } = await import('../components/Lifespan')
    const base = { floors: [], easy: 0, best: 3 }
    expect(lifespanText({ ...base, typical: 0 })).toContain('足しどき')
    expect(lifespanText({ ...base, typical: 24 })).toBe('孤城が楽勝になるまで 激レアあと約24体')
    expect(lifespanText({ ...base, typical: null })).toContain('まだまだ')
  })
})
