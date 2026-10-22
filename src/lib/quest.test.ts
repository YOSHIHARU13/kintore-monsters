import { describe, expect, it } from 'vitest'
import { defaultHp, questGold, questHits, setHit, standardSessionDamage } from './quest'
import { isJogressReady, jogressNeed } from './stats'
import { advantageElements, elementRate } from './element'
import type { MonsterDef, OwnedMonster, Quest, SetRecord } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'chestArms', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})
const mon = (id: string, defId: string, extra: Partial<OwnedMonster> = {}): OwnedMonster => ({
  id, defId, nodeId: 'n1', obtainedAt: 0, ...extra,
})
const quest: Quest = {
  id: 'q', name: 'q', bossDefId: 'b', attr: 'legs', element: 'wood', weakSlots: ['mon4'], gimmicks: [],
  hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: 'flame', createdAt: 0,
}
const set = (slotId: string, day: SetRecord['day'], extra: Partial<SetRecord> = {}) =>
  ({ slotId, day, date: '2026-10-05', judge: 'normal', eligible: true, ...extra }) as const

describe('クエスト', () => {
  it('属性の相性：炎→木→水→炎、光⇔闇。無属性は等倍', () => {
    const one = (e: 'fire' | 'water' | 'wood' | 'light' | 'dark') => ({ elements: [e], super: false })
    expect(elementRate(one('fire'), 'wood')).toBe(2)
    expect(elementRate(one('wood'), 'fire')).toBe(0.5)
    expect(elementRate(one('light'), 'dark')).toBe(2)
    expect(elementRate(one('dark'), 'light')).toBe(2)
    expect(elementRate({ elements: [], super: false }, 'wood')).toBe(1)
    expect(elementRate(one('fire'), undefined)).toBe(1)
    expect(advantageElements('wood')).toEqual(['fire'])
  })

  it('超属性は有利な相手に×3、複合属性はどちらかで有利なら×2・片方の不利は打ち消し', () => {
    expect(elementRate({ elements: ['fire'], super: true }, 'wood')).toBe(3)
    expect(elementRate({ elements: ['fire', 'water'], super: false }, 'wood')).toBe(2) // 炎が有利
    expect(elementRate({ elements: ['fire', 'light'], super: false }, 'water')).toBe(1) // 炎の不利を光が打ち消す
    expect(elementRate({ elements: ['fire', 'wood'], super: false }, 'water')).toBe(2) // 木が有利
  })

  it('セットでは、その部位の属性のモンスターと無属性だけが攻撃する', () => {
    const chest = { mon: mon('c', 'c'), def: def('c', { element: 'fire' }) } // 炎・ノーマルの★1：攻撃力4,500（強さ1.5）
    const legs = { mon: mon('l', 'l'), def: def('l', { attr: 'legs' }) }
    const none = { mon: mon('n', 'n'), def: def('n', { attr: 'none' }) }
    const party = [chest, legs, none]
    // 胸腕のセット：胸腕 10×1.5×2（相性）+ 無 10×1.5×1 = 45
    expect(setHit(set('mon2', 'mon'), quest, party, '').damage).toBe(45)
    // 脚のセット：脚 15 + 無 15 = 30
    expect(setHit(set('wed1', 'wed'), quest, party, '').damage).toBe(30)
    // 攻撃できるモンスターがいなければ素手で 10
    expect(setHit(set('fri1', 'fri'), quest, [chest], '')).toMatchObject({ damage: 10, notes: ['素手'] })
  })

  it('弱点種目×2、得意種目×1.5', () => {
    const fav = { mon: mon('c', 'c'), def: def('c', { favoriteSlot: 'mon4', element: 'fire' }) }
    // 10 × 1.5（強さ）× 2（相性）× 2（弱点）× 1.5（得意）= 90
    expect(setHit(set('mon4', 'mon'), quest, [fav], '').damage).toBe(90)
  })

  it('ギミック：対応するアビリティがないと、1つにつき攻撃が25%減る（2つで半分）', () => {
    const boss = { ...quest, weakSlots: [], gimmicks: ['バリア', 'リジェネ'] }
    const none = { mon: mon('a', 'a'), def: def('a', { rarity: 'superRare' }) } // アビリティなし
    const one = { mon: mon('b', 'b'), def: def('b', { rarity: 'superRare', abilities: ['バリア'] }) }
    const both = { mon: mon('c', 'c'), def: def('c', { rarity: 'superRare', abilities: ['バリア', 'リジェネ'] }) }
    const full = setHit(set('mon2', 'mon'), { ...boss, gimmicks: [] }, [none], '').damage
    expect(setHit(set('mon2', 'mon'), boss, [none], '').damage).toBe(Math.round(full * 0.5))
    expect(setHit(set('mon2', 'mon'), boss, [one], '').damage).toBe(Math.round(full * 0.75))
    expect(setHit(set('mon2', 'mon'), boss, [both], '').damage).toBe(full)
    expect(setHit(set('mon2', 'mon'), boss, [one], '').notes).toContain('bはリジェネで弱体')
  })

  it('持てるアビリティの数はレア度で決まる（ハズレは0個なので持たせても効かない）', () => {
    const boss = { ...quest, weakSlots: [], gimmicks: ['バリア'] }
    const hazure = { mon: mon('h', 'h'), def: def('h', { rarity: 'hazure', abilities: ['バリア'], element: 'fire' }) }
    const normal = { mon: mon('n', 'n'), def: def('n', { abilities: ['バリア'] }) }
    const rate = (m: typeof normal) => setHit(set('mon2', 'mon'), boss, [m], '').damage / setHit(set('mon2', 'mon'), { ...boss, gimmicks: [] }, [m], '').damage
    expect(rate(hazure)).toBeCloseTo(0.75, 1)
    expect(rate(normal)).toBe(1)
  })

  it('星と＋が多いほど攻撃力が上がる', () => {
    const weak = { mon: mon('a', 'a'), def: def('a') }
    const strong = { mon: mon('b', 'b', { nodeId: 'n3', plus: 5 }), def: def('b', { rarity: 'superRare' }) }
    const a = setHit(set('mon2', 'mon'), quest, [weak], '').damage
    const b = setHit(set('mon2', 'mon'), quest, [strong], '').damage
    // ノーマルの★4（4,500）と、激レアの★6＋5（3×3,000＋4,500＋5×1,500 = 21,000）
    expect(b / a).toBeCloseTo(21000 / 4500)
  })

  it('報酬の対象外のセットは数えない', () => {
    const party = [{ mon: mon('c', 'c'), def: def('c') }]
    const sets = [
      { ...set('mon2', 'mon'), id: '1', exerciseId: 'x', ts: 1, setNo: 1, weightKg: 0, reps: 0, target: null, exp: 0, gold: 0 },
      { ...set('mon2', 'mon', { eligible: false }), id: '2', exerciseId: 'x', ts: 2, setNo: 2, weightKg: 0, reps: 0, target: null, exp: 0, gold: 0 },
    ] as SetRecord[]
    expect(questHits(quest, party, sets, () => 'x')).toHaveLength(1)
  })

  it('HPの目安は1回のトレーニングぶん：攻撃力9,000が各属性2体で、1部位15セット＋ローラー3セット', () => {
    expect(standardSessionDamage()).toBe(15 * 10 * 3 * 2 + 3 * 4 * 3 * 6)
  })


  it('ボスの格で、初級〜上級のHPとGがまとめて変わる', () => {
    const weak = defaultHp(0)
    const strong = defaultHp(4)
    expect(strong.easy).toBeGreaterThan(weak.hard) // 極の初級は、雑魚の上級より硬い
    expect(weak.easy).toBeLessThan(weak.normal)
    expect(questGold({ rank: 4 }, 'easy')).toBeGreaterThan(questGold({ rank: 0 }, 'easy'))
    expect(questGold({}, 'normal')).toBe(120) // 格を決めていなければ「普通」
  })

  it('ジョグレス：途中の段階どうしでもOK（★2どうしで★3誕生）。＋の条件もレシピで決める', () => {
    const hidden = def('h', { recipe: ['a', 'b'], jogressBirthStars: 3, jogressPlus: 0 })
    expect(jogressNeed(hidden)).toEqual({ stars: 2, plus: 0 })
    const normal = def('a') // ★1 → ★2 → ★3
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n1' }), normal, hidden)).toBe(false)
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n2' }), normal, hidden)).toBe(true)
    const strict = def('h2', { recipe: ['a', 'b'], jogressBirthStars: 4, jogressPlus: 5 })
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n3', plus: 4 }), normal, strict)).toBe(false)
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n3', plus: 5 }), normal, strict)).toBe(true)
  })
})
