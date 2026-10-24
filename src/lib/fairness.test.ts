import { describe, expect, it } from 'vitest'
import { towerFloors } from './tower'
import { kinkinFloors } from './kinkin'
import { castleFloors } from './castle'
import { gradeOf } from './quest'
import { isStandIn } from './fit'
import type { MonsterDef } from '../types'

const ABS = ['バリア', 'シールド', 'リジェネ', 'ミラー', 'ワープ', 'ブロック', 'ウィンド']
const ELS = ['fire', 'water', 'wood', 'light', 'dark'] as const
const def = (id: string, x: Partial<MonsterDef>) => ({ id, name: id, attr: 'legs', templateId: 'linear3', images: {}, createdAt: 0, ...x }) as MonsterDef

/**
 * 適正の公平さ：あり得る激レア（5属性 × アビリティ2つの組み合わせ21通り）を全部登録して、
 * 高難度（塔の超絶の階・禁筋・孤城。零属性の城主は除く）で代役以上（属性が合って、アビリティが2つ以上合う）になれる階の数を数える
 */
function standInCounts(month: string): number[] {
  const bosses = Array.from({ length: 30 }, (_, i) =>
    def(`b${i}`, { questOnly: true, templateId: 'single', element: ELS[i % 5], bossGrade: i < 10 ? 'chozetsu' : 'bakuzetsu', castleOnly: i >= 20 }),
  )
  const srs = ELS.flatMap((e) =>
    ABS.flatMap((a, i) => ABS.slice(i + 1).map((b) => def(`sr-${e}-${a}-${b}`, { tier: 'superRare', element: e, abilities: [a, b] }))),
  )
  const defs = [...bosses, ...srs]
  const tower = towerFloors(month, defs, ABS).map((f) => f.quest)
  const kinkin = kinkinFloors(month, defs, ABS, [], undefined, tower).map((f) => f.quest)
  const castle = castleFloors(month, defs, ABS, [], undefined, [...tower, ...kinkin]).map((f) => f.quest)
  const hard = [...tower, ...kinkin, ...castle].filter((q) => q.element && ['chozetsu', 'bakuzetsu'].includes(gradeOf(q)))
  return srs.map((s) => hard.filter((q) => isStandIn(s, q)).length)
}

describe('適正の公平さ', () => {
  it.each(['2026-10', '2026-11', '2026-12'])('%s：どの激レアも、代役以上になれる階が2〜4か所', (month) => {
    const n = standInCounts(month)
    expect(Math.min(...n)).toBeGreaterThanOrEqual(2)
    expect(Math.max(...n)).toBeLessThanOrEqual(4)
  })
})
