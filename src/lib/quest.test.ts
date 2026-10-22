import { describe, expect, it } from 'vitest'
import { advantageAttr, affinity, defaultHp, questGold, questHits, setHit, standardSessionDamage } from './quest'
import { isJogressReady, jogressNeed } from './stats'
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
    const chest = { mon: mon('c', 'c'), def: def('c') } // ノーマルの★4：攻撃力4,500（強さ1.5）
    const legs = { mon: mon('l', 'l'), def: def('l', { attr: 'legs' }) }
    const none = { mon: mon('n', 'n'), def: def('n', { attr: 'none' }) }
    const party = [chest, legs, none]
    // 胸腕のセット：胸腕 10×1.5×2（相性）+ 無 10×1.5×1 = 45
    expect(setHit(set('mon2', 'mon'), quest, party, new Set(), '').damage).toBe(45)
    // 脚のセット：脚 15 + 無 15 = 30
    expect(setHit(set('wed1', 'wed'), quest, party, new Set(), '').damage).toBe(30)
    // 攻撃できるモンスターがいなければ素手で 10
    expect(setHit(set('fri1', 'fri'), quest, [chest], new Set(), '')).toMatchObject({ damage: 10, notes: ['素手'] })
  })

  it('弱点種目×2、得意種目×1.5、特攻（やり方ができたとき）×2', () => {
    const fav = { mon: mon('c', 'c'), def: def('c', { favoriteSlot: 'mon4', skill: 'beat' }) }
    // 10 × 1.5（強さ）× 2（相性）× 2（弱点）× 1.5（得意）= 90、前回超えなら ×2 で 180
    expect(setHit(set('mon4', 'mon'), quest, [fav], new Set(), '').damage).toBe(90)
    const hit = setHit(set('mon4', 'mon', { judge: 'beat' }), quest, [fav], new Set(), '')
    expect(hit.damage).toBe(180)
    expect(hit.notes).toContain('cの前回超え特攻')
  })

  it('星と＋が多いほど攻撃力が上がる', () => {
    const weak = { mon: mon('a', 'a'), def: def('a') }
    const strong = { mon: mon('b', 'b', { nodeId: 'n3', plus: 5 }), def: def('b', { rarity: 'superRare' }) }
    const a = setHit(set('mon2', 'mon'), quest, [weak], new Set(), '').damage
    const b = setHit(set('mon2', 'mon'), quest, [strong], new Set(), '').damage
    // ノーマルの★4（4,500）と、激レアの★6＋5（3×3,000＋4,500＋5×1,500 = 21,000）
    expect(b / a).toBeCloseTo(21000 / 4500)
  })

  it('報酬の対象外のセットは数えない', () => {
    const party = [{ mon: mon('c', 'c'), def: def('c') }]
    const sets = [
      { ...set('mon2', 'mon'), id: '1', exerciseId: 'x', ts: 1, setNo: 1, weightKg: 0, reps: 0, target: null, exp: 0, gold: 0 },
      { ...set('mon2', 'mon', { eligible: false }), id: '2', exerciseId: 'x', ts: 2, setNo: 2, weightKg: 0, reps: 0, target: null, exp: 0, gold: 0 },
    ] as SetRecord[]
    expect(questHits(quest, party, sets, new Set(), () => 'x')).toHaveLength(1)
  })

  it('HPの目安は1回のトレーニングぶん：攻撃力9,000が各属性2体で、1部位15セット＋ローラー3セット', () => {
    expect(standardSessionDamage()).toBe(15 * 10 * 3 * 2 + 3 * 4 * 3 * 6)
  })

  it('連日特攻：前の日にもトレーニングしていれば効く', () => {
    const q2 = { ...quest, weakSkill: 'streak' }
    const m = { mon: mon('c', 'c'), def: def('c', { skill: 'streak' }) }
    const plain = setHit(set('mon2', 'mon'), q2, [m], new Set(), '').damage
    expect(setHit(set('mon2', 'mon'), q2, [m], new Set(['2026-10-04']), '').damage).toBe(plain * 2)
  })

  it('ボスの格で、初級〜上級のHPとGがまとめて変わる', () => {
    const weak = defaultHp(0)
    const strong = defaultHp(4)
    expect(strong.easy).toBeGreaterThan(weak.hard) // 極の初級は、雑魚の上級より硬い
    expect(weak.easy).toBeLessThan(weak.normal)
    expect(questGold({ rank: 4 }, 'easy')).toBeGreaterThan(questGold({ rank: 0 }, 'easy'))
    expect(questGold({}, 'normal')).toBe(120) // 格を決めていなければ「普通」
  })

  it('ジョグレス：途中の段階どうしでもOK（★5どうしで★6誕生）。＋の条件もレシピで決める', () => {
    const hidden = def('h', { recipe: ['a', 'b'], jogressBirthStars: 6, jogressPlus: 0 })
    expect(jogressNeed(hidden)).toEqual({ stars: 5, plus: 0 })
    const normal = def('a') // ★4 → ★5 → ★6
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n1' }), normal, hidden)).toBe(false)
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n2' }), normal, hidden)).toBe(true)
    const strict = def('h2', { recipe: ['a', 'b'], jogressBirthStars: 7, jogressPlus: 5 })
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n3', plus: 4 }), normal, strict)).toBe(false)
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n3', plus: 5 }), normal, strict)).toBe(true)
  })
})
