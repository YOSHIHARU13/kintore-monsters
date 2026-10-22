import { describe, expect, it } from 'vitest'
import { advantageAttr, affinity, checkinHits, questHits, setHit, standardWeekDamage } from './quest'
import type { MonsterDef, OwnedMonster, Quest, SetRecord } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'chestArms', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})
const mon = (id: string, defId: string, extra: Partial<OwnedMonster> = {}): OwnedMonster => ({
  id, defId, nodeId: 'n1', obtainedAt: 0, ...extra,
})
const quest: Quest = {
  id: 'q', name: 'q', bossDefId: 'b', attr: 'legs', weakSlots: ['mon4'], weakSkill: 'beat',
  hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: 'flame', createdAt: 0,
}
const set = (slotId: string, day: SetRecord['day'], extra: Partial<SetRecord> = {}) =>
  ({ slotId, day, date: '2026-10-05', judge: 'normal', eligible: true, ...extra }) as const

describe('クエスト', () => {
  it('相性：胸腕 → 脚 → 背肩 → 胸腕。無はいつも等倍', () => {
    expect(affinity('chestArms', 'legs')).toBe(2)
    expect(affinity('legs', 'chestArms')).toBe(0.5)
    expect(affinity('none', 'legs')).toBe(1)
    expect(affinity('legs', 'none')).toBe(1)
    expect(advantageAttr('legs')).toBe('chestArms')
    expect(advantageAttr('none')).toBeNull()
  })

  it('セットでは、その部位の属性のモンスターと無属性だけが攻撃する', () => {
    const chest = { mon: mon('c', 'c'), def: def('c') } // ノーマル★2
    const legs = { mon: mon('l', 'l'), def: def('l', { attr: 'legs' }) }
    const none = { mon: mon('n', 'n'), def: def('n', { attr: 'none' }) }
    const party = [chest, legs, none]
    // 胸腕のセット：胸腕 10×2×2（相性）+ 無 10×2×1 = 60
    expect(setHit(set('mon2', 'mon'), quest, party, new Set(), '').damage).toBe(60)
    // 脚のセット：脚 10×2×1 + 無 20 = 40
    expect(setHit(set('wed1', 'wed'), quest, party, new Set(), '').damage).toBe(40)
    // 攻撃できるモンスターがいなければ素手で 10
    expect(setHit(set('fri1', 'fri'), quest, [chest], new Set(), '')).toMatchObject({ damage: 10, notes: ['素手'] })
  })

  it('弱点種目×2、得意種目×1.5、特攻（やり方ができたとき）×2', () => {
    const fav = { mon: mon('c', 'c'), def: def('c', { favoriteSlot: 'mon4', skill: 'beat' }) }
    // 10 × 2（★2）× 2（相性）× 2（弱点）× 1.5（得意）= 120、前回超えなら ×2 で 240
    expect(setHit(set('mon4', 'mon'), quest, [fav], new Set(), '').damage).toBe(120)
    const hit = setHit(set('mon4', 'mon', { judge: 'beat' }), quest, [fav], new Set(), '')
    expect(hit.damage).toBe(240)
    expect(hit.notes).toContain('cの前回超え特攻')
  })

  it('星と＋が多いほど攻撃力が上がる', () => {
    const weak = { mon: mon('a', 'a'), def: def('a') }
    const strong = { mon: mon('b', 'b', { nodeId: 'n3', plus: 5 }), def: def('b', { rarity: 'superRare' }) }
    const a = setHit(set('mon2', 'mon'), quest, [weak], new Set(), '').damage
    const b = setHit(set('mon2', 'mon'), quest, [strong], new Set(), '').damage
    expect(b / a).toBeCloseTo((6 * 1.5) / 2) // ★6＋5 と ★2
  })

  it('歩数と習慣は全員で攻撃する', () => {
    const party = [{ mon: mon('c', 'c'), def: def('c') }, { mon: mon('l', 'l'), def: def('l', { attr: 'legs' }) }]
    const hits = checkinHits(
      { date: 'd', steps: 8000, habit: true, habitLabel: '瞑想', habitMinutes: 10, streak: 1, stepsGold: 0, habitGold: 0, ts: 0 },
      quest,
      party,
    )
    // 歩数：8 × (2×2 + 2×1) = 48、習慣：10 × 0.5 × 6 = 30
    expect(hits.map((h) => h.damage)).toEqual([48, 30])
  })

  it('報酬の対象外のセットは数えない', () => {
    const party = [{ mon: mon('c', 'c'), def: def('c') }]
    const sets = [
      { ...set('mon2', 'mon'), id: '1', exerciseId: 'x', ts: 1, setNo: 1, weightKg: 0, reps: 0, target: null, exp: 0, gold: 0 },
      { ...set('mon2', 'mon', { eligible: false }), id: '2', exerciseId: 'x', ts: 2, setNo: 2, weightKg: 0, reps: 0, target: null, exp: 0, gold: 0 },
    ] as SetRecord[]
    expect(questHits(quest, party, sets, [], () => 'x')).toHaveLength(1)
  })

  it('HPの目安は1週間ぶんの標準的なダメージ', () => {
    expect(standardWeekDamage()).toBeGreaterThan(1000)
  })
})
