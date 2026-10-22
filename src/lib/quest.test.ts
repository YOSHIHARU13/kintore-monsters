import { describe, expect, it } from 'vitest'
import { defaultBossHp, dropPlus, gradeOf, questHp, defaultHp, questGold, questHits, setHit, standardSessionDamage } from './quest'
import { isJogressReady, jogressNeed } from './stats'
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
  it('セットでは全員が攻撃し、セットの部位と一致するモンスターは×2', () => {
    const chest = { mon: mon('c', 'c'), def: def('c') } // ノーマルの★1：攻撃力4,500（強さ1.5）
    const legs = { mon: mon('l', 'l'), def: def('l', { attr: 'legs' }) }
    const none = { mon: mon('n', 'n'), def: def('n', { attr: 'none' }) }
    const party = [chest, legs, none]
    // 胸腕のセット：胸腕 2.5×1.5×2 + 脚 2.5×1.5 + 無 2.5×1.5 = 15
    expect(setHit(set('mon2', 'mon'), quest, party, '').damage).toBe(15)
    expect(setHit(set('mon2', 'mon'), quest, [chest], '').damage).toBe(8) // 7.5
    expect(setHit(set('wed1', 'wed'), quest, [chest], '').damage).toBe(4) // 部位が違うと 3.75
    // 出撃メンバーがいなければ素手
    expect(setHit(set('fri1', 'fri'), quest, [], '')).toMatchObject({ notes: ['素手'] })
  })

  it('弱点種目×2、得意種目×1.5、最後に編成倍率', () => {
    const fav = { mon: mon('c', 'c'), def: def('c', { favoriteSlot: 'mon4' }) }
    // 2.5 × 1.5（強さ）× 2（部位一致）× 2（弱点）× 1.5（得意）= 22.5
    expect(setHit(set('mon4', 'mon'), quest, [fav], '').damage).toBe(23)
    expect(setHit(set('mon4', 'mon'), quest, [fav], '', 2).damage).toBe(45)
  })

  it('星とレア度で攻撃力が決まる', () => {
    const weak = { mon: mon('a', 'a'), def: def('a') }
    const strong = { mon: mon('b', 'b', { nodeId: 'n3' }), def: def('b', { rarity: 'superRare' }) }
    // 端数の丸めで比がずれないよう、倍率を大きくして比べる
    const a = setHit(set('mon2', 'mon'), quest, [weak], '', 100).damage
    const b = setHit(set('mon2', 'mon'), quest, [strong], '', 100).damage
    // ノーマルの★1（3,000＋1,500）と、激レアの★3（9,000＋4,500）
    expect(b / a).toBeCloseTo(13500 / 4500)
  })

  it('超絶は、ボスの属性に有利な属性を持たないモンスターの攻撃が半減', () => {
    const boss: Quest = { ...quest, weakSlots: [], grade: 'chozetsu', element: 'dark' }
    const light = { mon: mon('l', 'l'), def: def('l', { element: 'light' }) }
    const fire = { mon: mon('f', 'f'), def: def('f', { element: 'fire' }) }
    const hit = (m: typeof light, q: Quest = boss) => setHit(set('mon2', 'mon'), q, [m], '', 100).damage
    expect(hit(fire)).toBe(hit(light) / 2)
    expect(setHit(set('mon2', 'mon'), boss, [fire], '').notes).toContain('fは属性が合わず半減')
    expect(hit(fire, { ...boss, grade: 'kyukyoku' })).toBe(hit(light, { ...boss, grade: 'kyukyoku' })) // 究極では半減しない
  })

  it('報酬の対象外のセットは数えない', () => {
    const party = [{ mon: mon('c', 'c'), def: def('c') }]
    const sets = [
      { ...set('mon2', 'mon'), id: '1', exerciseId: 'x', ts: 1, setNo: 1, weightKg: 0, reps: 0, target: null, exp: 0, gold: 0 },
      { ...set('mon2', 'mon', { eligible: false }), id: '2', exerciseId: 'x', ts: 2, setNo: 2, weightKg: 0, reps: 0, target: null, exp: 0, gold: 0 },
    ] as SetRecord[]
    expect(questHits(quest, party, sets, () => 'x')).toHaveLength(1)
  })

  it('HPの目安は1回のトレーニングぶん：攻撃力9,000が6体（部位一致2体）で、1部位15セット＋ローラー3セット', () => {
    expect(standardSessionDamage()).toBe(15 * 2.5 * 3 * (2 * 2 + 4) + 3 * 4 * 3 * 6)
  })


  it('ボスクエストは格（極・究極・超絶）でHP・G・ドロップの＋が決まる', () => {
    expect(defaultBossHp('chozetsu')).toBeGreaterThan(defaultBossHp('kyukyoku'))
    expect(defaultBossHp('kyukyoku')).toBeGreaterThan(defaultBossHp('kiwami'))
    expect(questGold({ grade: 'chozetsu' }, 'normal')).toBe(300)
    expect(dropPlus({ grade: 'chozetsu' })).toBe(1)
    expect(dropPlus({ grade: 'kyukyoku' })).toBe(0)
    // 格を決める前のクエストは、以前の「雑魚〜極」から読み替える
    expect(gradeOf({ rank: 4 })).toBe('chozetsu')
    expect(gradeOf({})).toBe('kiwami')
    // ボスクエストのHPは1つだけ
    expect(questHp({ hp: { easy: 1, normal: 2, hard: 3 } }, 'hard')).toBe(2)
  })

  it('素材クエストは初級〜上級と格（雑魚〜極）のまま', () => {
    const weak = defaultHp(0, 'material')
    const strong = defaultHp(4, 'material')
    expect(strong.easy).toBeGreaterThan(weak.hard)
    expect(questGold({ kind: 'material', rank: 4 }, 'easy')).toBeGreaterThan(questGold({ kind: 'material', rank: 0 }, 'easy'))
    expect(questHp({ kind: 'material', hp: { easy: 1, normal: 2, hard: 3 } }, 'hard')).toBe(3)
  })

  it('ジョグレス：素材は2体とも最終形態で、生まれる星の1つ下以上', () => {
    const hidden = def('h', { recipe: ['a', 'b'], jogressBirthStars: 4 })
    expect(jogressNeed(hidden)).toEqual({ stars: 3 })
    const normal = def('a') // ★1 → ★2 → ★3
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n2' }), normal, hidden)).toBe(false)
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n3' }), normal, hidden)).toBe(true)
    const early = def('e', { templateId: 'early2' }) // ★1 → ★2で最終形態
    expect(isJogressReady(mon('x', 'e', { nodeId: 'n2' }), early, hidden)).toBe(false) // 最終形態でも星が足りない
  })
})
