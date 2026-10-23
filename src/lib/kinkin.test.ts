import { describe, expect, it } from 'vitest'
import { kinkinCleared, kinkinFloors, kinkinOpen } from './kinkin'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef>): MonsterDef =>
  ({ id, name: id, templateId: 'single', images: {}, createdAt: 0, attr: 'legs', questOnly: true, ...extra }) as MonsterDef

describe('禁筋の獄', () => {
  const bosses = (['fire', 'water', 'wood', 'light', 'dark'] as const).flatMap((e, i) => [
    def(`c${i}`, { element: e, bossGrade: 'chozetsu' }),
    def(`b${i}`, { element: e, bossGrade: 'bakuzetsu' }),
    def(`x${i}`, { element: e, bossGrade: 'chozetsu', series: '鬼' }), // コラボは入れない
  ])
  it('全20階。15階までは超絶、16階から爆絶。どの階も「ボスと同じ部位の子」を求め、ボスは落とさない', () => {
    const floors = kinkinFloors(bosses, [])
    expect(floors).toHaveLength(20)
    expect(floors[14].quest.grade).toBe('chozetsu')
    expect(floors[15].quest.grade).toBe('bakuzetsu')
    expect(floors.every((f) => f.quest.requirements!.some((r) => r.tag === 'pt:legs'))).toBe(true)
    expect(floors.every((f) => f.reward.monsterDefId === null)).toBe(true)
    expect(floors.some((f) => f.quest.bossDefId.startsWith('x'))).toBe(false)
    // 報酬はオーブ多め（月に約400）と、筋肉玉・銀のアイテム・ステッキ
    expect(floors.reduce((sum, f) => sum + f.reward.gold, 0)).toBeGreaterThanOrEqual(400)
    expect(floors.some((f) => (f.reward.balls ?? 0) > 0)).toBe(true)
  })
  it('毎月11〜20日。クリアは月ごと', () => {
    expect(kinkinOpen('2026-10-10')).toBe(false)
    expect(kinkinOpen('2026-10-11')).toBe(true)
    expect(kinkinOpen('2026-10-20')).toBe(true)
    expect(kinkinOpen('2026-10-21')).toBe(false)
    expect(kinkinCleared({ kinkin: { month: '2026-10', cleared: 5 } }, '2026-10')).toBe(5)
    expect(kinkinCleared({ kinkin: { month: '2026-10', cleared: 5 } }, '2026-11')).toBe(0)
  })
})
