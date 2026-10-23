import { describe, expect, it } from 'vitest'
import { planAbilities } from './abilityPlan'
import type { MonsterDef } from '../types'

const ALL = ['バリア', 'シールド', 'リジェネ', 'ミラー', 'ワープ', 'ブロック', 'ウィンド']
const OLD = ALL.slice(0, 4)
const mk = (i: number, tier: 'normal' | 'superRare'): MonsterDef =>
  ({ id: `m${i}`, name: `m${i}`, attr: 'legs', templateId: 'linear3', images: {}, tier, element: 'fire', abilities: [OLD[i % 4], OLD[(i + 1) % 4]], createdAt: i }) as MonsterDef

describe('アビリティの配り直し', () => {
  const defs = Array.from({ length: 42 }, (_, i) => mk(i, i % 3 === 0 ? 'normal' : 'superRare'))
  const plan = planAbilities(defs, ALL)
  it('枠の数ぶん、重ならずに持ち、新しいアビリティも含めて同じくらいの数に散る', () => {
    for (const p of plan) {
      const d = defs.find((x) => x.id === p.id)!
      expect(p.abilities).toHaveLength(d.tier === 'normal' ? 1 : 2)
      expect(new Set(p.abilities).size).toBe(p.abilities.length)
    }
    const counts = ALL.map((g) => plan.filter((p) => p.abilities.includes(g)).length)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })
  it('1つ目のアビリティは、なるべくそのまま残す。毎回同じ結果', () => {
    const kept = plan.filter((p) => p.abilities[0] === defs.find((d) => d.id === p.id)!.abilities![0]).length
    expect(kept).toBeGreaterThan(plan.length / 2)
    expect(planAbilities(defs, ALL)).toEqual(plan)
  })
})
