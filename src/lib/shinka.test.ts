import { describe, expect, it } from 'vitest'
import { canShinka, planJogressMove, planLuckUse, shinkaRecipe, shinkaTierOf } from './shinka'
import { attackOf } from './stats'
import type { MonsterDef, OwnedMonster } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef =>
  ({ id, name: id, attr: 'legs', templateId: 'linear3', images: {}, createdAt: 0, ...extra }) as MonsterDef
const mon = (extra: Partial<OwnedMonster> = {}): OwnedMonster => ({ id: 'o', defId: 'x', nodeId: 'n3', obtainedAt: 0, ...extra })

describe('獣神化', () => {
  const sr = def('sr', { tier: 'superRare', element: 'fire' })

  it('ガチャの激レアの最終形態と、爆絶の降臨だけ。レアや超絶の降臨はできない', () => {
    expect(canShinka(mon(), sr)).toBe(true)
    expect(canShinka(mon({ nodeId: 'n2' }), sr)).toBe(false) // 最終形態でない
    expect(canShinka(mon({ shinka: true }), sr)).toBe(false) // もう獣神化した
    expect(canShinka(mon(), def('r', { tier: 'rare' }))).toBe(false)
    expect(canShinka(mon({ nodeId: 'n1' }), def('b', { questOnly: true, bossGrade: 'bakuzetsu', templateId: 'single' }))).toBe(true)
    expect(canShinka(mon({ nodeId: 'n1' }), def('c', { questOnly: true, bossGrade: 'chozetsu', templateId: 'single' }))).toBe(false)
  })

  it('格：合体なら金、獣神化の絵があれば銀、なければ銅。強さも金＞銀＞銅、爆絶の降臨の銅は少し弱い', () => {
    expect(shinkaTierOf(mon(), sr)).toBeNull()
    expect(shinkaTierOf(mon({ shinka: true }), sr)).toBe('bronze')
    expect(shinkaTierOf(mon({ shinka: true }), { ...sr, images: { shinka: 'img' } })).toBe('silver')
    expect(shinkaTierOf(mon({ shinka: true, shinkaGold: true }), sr)).toBe('gold')
    expect(shinkaTierOf(mon(), def('h', { recipe: ['a', 'b'] }))).toBe('gold') // 以前のジョグレスの子
    const atk = (m: Partial<OwnedMonster>, d = sr) => attackOf(mon(m), d)
    expect(atk({ shinka: true }) - atk({})).toBe(3000 + 1500) // ★が1つ増える＋銅の上乗せ
    expect(atk({ shinka: true }, { ...sr, images: { shinka: 'img' } })).toBeGreaterThan(atk({ shinka: true }))
    expect(atk({ shinka: true, shinkaGold: true })).toBeGreaterThan(atk({ shinka: true }, { ...sr, images: { shinka: 'img' } }))
    const baku = def('b', { questOnly: true, bossGrade: 'bakuzetsu', templateId: 'single' })
    expect(attackOf(mon({ nodeId: 'n1', shinka: true }), baku) - attackOf(mon({ nodeId: 'n1' }), baku)).toBe(3000) // 降臨は★のぶんだけ
  })

  it('レシピ：子ごとに決まっていて変わらない。体数は1〜5、運は4〜20（モンストの運1〜5の4倍）', () => {
    const chozetsu = ['f1', 'f2', 'f3', 'w1'].map((id, i) => def(id, { questOnly: true, bossGrade: 'chozetsu', element: i < 3 ? 'fire' : 'water', templateId: 'single' }))
    const defs = [sr, ...chozetsu]
    const a = shinkaRecipe(sr, defs)
    expect(a).toEqual(shinkaRecipe(sr, defs)) // いつも同じ
    expect(a.length).toBeGreaterThanOrEqual(1)
    expect(a.length).toBeLessThanOrEqual(3)
    for (const item of a) {
      expect(item.count).toBeGreaterThanOrEqual(1)
      expect(item.count).toBeLessThanOrEqual(5)
      expect(item.luck % 4).toBe(0)
      expect(item.luck).toBeLessThanOrEqual(20)
    }
    // 爆絶の降臨は、同じ属性の超絶の降臨から
    const baku = def('b', { questOnly: true, bossGrade: 'bakuzetsu', element: 'fire', templateId: 'single' })
    for (const item of shinkaRecipe(baku, [...defs, baku])) expect(['f1', 'f2', 'f3']).toContain(item.defId)
    // コラボの激レアは、同じコラボの降臨から
    const collab = def('c', { tier: 'superRare', series: '鬼' })
    const oni = def('oni', { questOnly: true, bossGrade: 'kyukyoku', series: '鬼', templateId: 'single' })
    expect(shinkaRecipe(collab, [...defs, collab, oni]).map((i) => i.defId)).toEqual(['oni'])
  })

  it('運の使い方：低い子から使い切り、余った運の子はBOXに残る（運15が要るとき、運17の子は運2で残る）', () => {
    expect(planLuckUse(15, [{ id: 'a', luck: 17 }])).toEqual({ remove: [], keep: { id: 'a', luck: 2 } })
    expect(planLuckUse(12, [{ id: 'a', luck: 4 }, { id: 'b', luck: 8 }, { id: 'c', luck: 5 }])).toEqual({ remove: ['a', 'c'], keep: { id: 'b', luck: 5 } })
    expect(planLuckUse(8, [{ id: 'a', luck: 4 }, { id: 'b', luck: 4 }])).toEqual({ remove: ['a', 'b'], keep: null })
    expect(planLuckUse(20, [{ id: 'a', luck: 4 }])).toBeNull() // 足りない
  })
})

describe('以前のジョグレスの引っ越し', () => {
  it('生まれた子は、1体目の激レアの金の獣神化に（IDはそのまま）。相手・絵・名前を1体目に入れて、生まれた子の登録は消す', () => {
    const a = def('a', { tier: 'superRare' })
    const b = def('b', { tier: 'superRare' })
    const h = def('h', { recipe: ['a', 'b'], templateId: 'single', images: { n1: 'img-h' }, name: 'カイザー' })
    const plan = planJogressMove([a, b, h], [mon({ id: 'm1', defId: 'h', nodeId: 'n1', luck: 30 })])
    expect(plan.defs).toEqual([{ id: 'a', data: { jogressPartner: 'b', 'images.gold': 'img-h', 'names.gold': 'カイザー' } }])
    expect(plan.owned).toEqual([
      { id: 'm1', data: { defId: 'a', nodeId: 'n3', shinka: true, shinkaGold: true, investedBy: {}, investedFrom: {} } },
    ])
    expect(plan.remove).toEqual(['h'])
    // 決めてある相手・絵は上書きしない
    const set = planJogressMove([{ ...a, jogressPartner: 'x', images: { gold: 'mine' } }, b, h], [])
    expect(set.defs[0].data).toEqual({ 'names.gold': 'カイザー' })
  })
})
