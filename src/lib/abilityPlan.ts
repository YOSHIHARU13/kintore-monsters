import { abilitySlots } from './gimmick'
import type { MonsterDef } from '../types'

/** アビリティの配り直しの版。上げると、アプリを開いたときに1回だけ全モンスターのアビリティを配り直す */
export const ABILITY_RULES = 1

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * アビリティを増やしたときの配り直し：どのアビリティも同じくらいの数のモンスターが持つように。
 * 1つ目のアビリティは、まだ数が足りていなければそのまま（そのモンスターらしさを残す）。
 * 残りの枠は、持っているモンスターが少ないアビリティから、同じ組み合わせが重ならないように選ぶ。属性や部位は変えない
 */
export function planAbilities(defs: MonsterDef[], gimmicks: string[]): { id: string; abilities: string[] }[] {
  const targets = [...defs].filter((d) => abilitySlots(d) > 0).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  const total = targets.reduce((sum, d) => sum + Math.min(abilitySlots(d), gimmicks.length), 0)
  const cap = Math.ceil(total / Math.max(1, gimmicks.length))
  const count: Record<string, number> = Object.fromEntries(gimmicks.map((g) => [g, 0]))
  const pairs: Record<string, number> = {}
  const pairKey = (a: string, b: string) => [a, b].sort().join('+')
  return targets.map((d) => {
    const n = Math.min(abilitySlots(d), gimmicks.length)
    const first = (d.abilities ?? []).find((g) => gimmicks.includes(g))
    const picked: string[] = first && count[first] < cap ? [first] : []
    while (picked.length < n) {
      const next = gimmicks
        .filter((g) => !picked.includes(g))
        .map((g) => ({ g, c: count[g], p: picked.reduce((s, x) => s + (pairs[pairKey(g, x)] ?? 0), 0), tie: hash(d.id + g) }))
        .sort((x, y) => x.c - y.c || x.p - y.p || x.tie - y.tie)[0]
      picked.push(next.g)
    }
    for (const g of picked) count[g]++
    for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) pairs[pairKey(picked[i], picked[j])] = (pairs[pairKey(picked[i], picked[j])] ?? 0) + 1
    return { id: d.id, abilities: picked }
  })
}
