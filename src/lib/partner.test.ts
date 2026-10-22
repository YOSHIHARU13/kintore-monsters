import { describe, expect, it } from 'vitest'
import { autoPartners } from './partner'
import type { MonsterDef, OwnedMonster } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'chestArms', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})
const mon = (id: string, defId: string, nodeId = 'n1'): OwnedMonster => ({ id, defId, nodeId, obtainedAt: 0 })

describe('相棒のおまかせ', () => {
  it('倍率の高い組み合わせから、1体1枠で割り当てる（得意種目が優先されやすい）', () => {
    const defs = [def('a', { favoriteSlot: 'mon2' }), def('b'), def('c')]
    const owned = [mon('x', 'a'), mon('y', 'b', 'n3'), mon('z', 'c')]
    const result = autoPartners(['mon1', 'mon2', 'mon3'], owned, defs)
    expect(result.mon2).toBe('x') // 得意種目
    expect(new Set(Object.values(result)).size).toBe(3) // 同じモンスターは1つの枠だけ
    expect(result.mon1).toBe('y') // いちばん強い子は、得意種目のない枠でいちばん上に
  })

  it('モンスターが足りなければ、埋まらない枠もある', () => {
    expect(Object.keys(autoPartners(['mon1', 'mon2'], [mon('x', 'a')], [def('a')]))).toHaveLength(1)
  })
})
