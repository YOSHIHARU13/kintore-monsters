import { describe, expect, it } from 'vitest'
import { defaultBossHp, dropPlus, gradeOf, questHp, defaultHp, questGold, questHits, sessionEstimate, setHit, standardSessionDamage } from './quest'
import { isJogressReady, jogressNeed } from './stats'
import type { MonsterDef, OwnedMonster, Quest, SetRecord } from '../types'

// 零属性は×1.2になるので、ふだんは炎にしておく（零属性の確認は専用のテストで）。ノーマルの★1は攻撃力3,000（強さ1）
const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'chestArms', templateId: 'linear3', images: {}, createdAt: 0, element: 'fire', tier: 'normal', ...extra,
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
    const chest = { mon: mon('c', 'c'), def: def('c') } // ノーマルの★1：攻撃力3,000（強さ1）
    const legs = { mon: mon('l', 'l'), def: def('l', { attr: 'legs' }) }
    const none = { mon: mon('n', 'n'), def: def('n', { attr: 'none' }) }
    const party = [chest, legs, none]
    // 胸腕のセット：胸腕 2.5×1×2 + 脚 2.5 + 無 2.5 = 10
    expect(setHit(set('mon2', 'mon'), quest, party, '').damage).toBe(10)
    expect(setHit(set('mon2', 'mon'), quest, [chest], '').damage).toBe(5)
    // 脚のセット：胸腕の子は部位が違うので 2.5。ただしボス（脚）の部位なので×1.3 = 3.25（端数が出ないよう ×100 で比べる）
    expect(setHit(set('wed1', 'wed'), quest, [chest], '', 100).damage).toBe(325)
    expect(setHit(set('wed1', 'wed'), { ...quest, attr: 'chestArms' }, [chest], '', 100).damage).toBe(250)
    // 出撃メンバーがいなければ素手
    expect(setHit(set('fri1', 'fri'), quest, [], '')).toMatchObject({ notes: ['素手'] })
  })

  it('倒せる見込み：部位の日ごとに、基本セット＋ローラーを全部やったときのダメージ', () => {
    const chest = { mon: mon('c', 'c'), def: def('c') }
    const est = sessionEstimate({ ...quest, weakSlots: [], requirements: [] }, [chest])
    expect(est.map((e) => e.day)).toEqual(['mon', 'wed', 'fri'])
    // 胸腕の日は部位一致で×2になるぶん、ほかの日より多い
    expect(est[0].damage).toBeGreaterThan(est[1].damage)
    expect(est[0].damage).toBeGreaterThan(est[2].damage)
  })

  it('弱点種目×2、得意種目×1.5、最後に編成倍率', () => {
    const fav = { mon: mon('c', 'c'), def: def('c', { favoriteSlot: 'mon4' }) }
    // 2.5 × 1（強さ）× 2（部位一致）× 2（弱点）× 1.5（得意）= 15
    expect(setHit(set('mon4', 'mon'), quest, [fav], '').damage).toBe(15)
    expect(setHit(set('mon4', 'mon'), quest, [fav], '', 2).damage).toBe(30)
  })

  it('星とレア度で攻撃力が決まる', () => {
    const weak = { mon: mon('a', 'a'), def: def('a') }
    const strong = { mon: mon('b', 'b', { nodeId: 'n3' }), def: def('b', { tier: 'superRare' }) }
    // 端数の丸めで比がずれないよう、倍率を大きくして比べる
    const a = setHit(set('mon2', 'mon'), quest, [weak], '', 100).damage
    const b = setHit(set('mon2', 'mon'), quest, [strong], '', 100).damage
    // ノーマルの★1（3,000）と、激レアの★3（9,000＋6,000）
    expect(b / a).toBeCloseTo(15000 / 3000)
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


  it('ボスクエストは格（極・究極・超絶）でHPとオーブが決まる（＋はなくなった）', () => {
    expect(defaultBossHp('chozetsu')).toBeGreaterThan(defaultBossHp('kyukyoku'))
    expect(defaultBossHp('kyukyoku')).toBeGreaterThan(defaultBossHp('kiwami'))
    expect(questGold({ grade: 'chozetsu' }, 'normal')).toBe(40)
    expect(dropPlus({ grade: 'chozetsu' })).toBe(0)
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
    const normal = def('a', { tier: 'rare' }) // ★1 → ★2 → ★3（レアは★3まで）
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n2' }), normal, hidden)).toBe(false)
    expect(isJogressReady(mon('x', 'a', { nodeId: 'n3' }), normal, hidden)).toBe(true)
    const early = def('e', { templateId: 'early2' }) // ★1 → ★2で最終形態
    expect(isJogressReady(mon('x', 'e', { nodeId: 'n2' }), early, hidden)).toBe(false) // 最終形態でも星が足りない
  })
})

describe('零属性', () => {
  it('どのクエストでも攻撃×1.2で、超絶でも半減されない', () => {
    const fire = { mon: mon('f', 'f'), def: def('f') }
    const zero = { mon: mon('z', 'z'), def: def('z', { element: undefined }) }
    const chozetsu = { ...quest, grade: 'chozetsu' as const }
    const hit = (m: typeof fire) => setHit(set('mon1', 'mon'), chozetsu, [m], '').damage
    // 胸腕のセット：2.5 × 強さ1 × 2（部位一致）= 5。木のボスに炎は有利なのでそのまま、零属性は×1.2
    expect(hit(fire)).toBe(5)
    expect(hit(zero)).toBe(6)
    // 水の子は半減、零属性は半減しない
    const water = { mon: mon('w', 'w'), def: def('w', { element: 'water' }) }
    expect(hit(water)).toBe(3) // 2.5
  })
})

describe('ボスの部位', () => {
  it('ボスと同じ部位の種目はどれでも×1.3、中でも弱点種目はさらに×2', () => {
    const legs = { mon: mon('l', 'l'), def: def('l', { attr: 'legs' }) }
    const q = { ...quest, attr: 'legs' as const, weakSlots: ['wed2'] }
    // 脚の子が脚のセット：2.5 × 1 × 2（部位一致）= 5
    expect(setHit(set('wed1', 'wed'), q, [legs], '')).toMatchObject({ damage: 7, notes: ['ボスの部位'] }) // ×1.3 = 6.5
    expect(setHit(set('wed2', 'wed'), q, [legs], '')).toMatchObject({ damage: 13, notes: ['弱点種目'] }) // ×1.3×2 = 13
    expect(setHit(set('mon1', 'mon'), q, [legs], '').damage).toBe(3) // 胸腕のセットは補正なし（2.5）
  })
})

describe('コラボ', () => {
  it('コラボの激レア・レアは、同じコラボのボスに×1.5（ノーマルと降臨、ほかのコラボには付かない）', () => {
    const q = { ...quest, bossSeries: '鬼' }
    const hit = (extra: Partial<MonsterDef>) => setHit(set('mon1', 'mon'), q, [{ mon: mon('a', 'a'), def: def('a', extra) }], '', 100).damage
    const base = hit({})
    expect(hit({ series: '鬼', tier: 'rare' })).toBe(Math.round(((base * 5500) / 3000) * 1.5)) // レア★1は攻撃力5,500
    expect(hit({ series: '鬼', tier: 'normal' })).toBe(base)
    expect(hit({ series: '桃', tier: 'rare' })).toBe(Math.round((base * 5500) / 3000))
  })
})

describe('活躍感', () => {
  it('条件に合うアビリティを持っている子は、その子のダメージも1つにつき×1.25（2つなら×1.5）', () => {
    const q = { ...quest, requirements: [{ tag: 'ab:バリア', count: 3 }, { tag: 'ab:シールド', count: 3 }] }
    const hit = (abilities: string[]) =>
      setHit(set('mon1', 'mon'), q, [{ mon: mon('a', 'a'), def: def('a', { tier: 'rare', abilities }) }], '', 100).damage
    const none = hit([])
    expect(hit(['バリア']) / none).toBeCloseTo(1.25, 2)
    expect(hit(['バリア', 'シールド']) / none).toBeCloseTo(1.5, 2)
  })
  it('子ごとのダメージを出し、いちばん削った子がMVP', () => {
    const a = { mon: mon('a', 'a'), def: def('a', { tier: 'superRare' }) }
    const b = { mon: mon('b', 'b'), def: def('b') }
    const h = setHit(set('mon1', 'mon'), quest, [a, b], '')
    expect(h.byMember.a).toBeGreaterThan(h.byMember.b)
    expect(Math.round(h.byMember.a + h.byMember.b)).toBe(h.damage)
  })
})
