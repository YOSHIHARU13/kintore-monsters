import { describe, expect, it } from 'vitest'
import { calcTarget, judgeSet, latestSession, suggestProgression } from './target'
import { calcSetReward, cardioGold } from './rewards'
import { boughtCap, evolutionCost, isExpFull, planPour } from './evolution'
import { CONFIG } from '../config/gameConfig'
import { EXERCISES, SLOTS } from '../data/exercises'
import { TEMPLATES } from '../data/evolutionTemplates'

const rec = (setNo: number, weightKg: number, reps: number, ts: number, date = `d${ts}`) => ({
  setNo,
  weightKg,
  reps,
  ts,
  date,
})

describe('目標回数', () => {
  it('記録がなければ目標なし', () => {
    expect(calcTarget([], 1, 5)).toBeNull()
  })
  it('直近3回の平均（四捨五入）＋1', () => {
    const h = [rec(1, 5, 20, 1), rec(1, 5, 10, 2), rec(1, 5, 11, 3), rec(1, 5, 12, 4)]
    expect(calcTarget(h, 1, 5)).toBe(12) // (10+11+12)/3=11 → +1
  })
  it('3回未満ならある分の平均', () => {
    expect(calcTarget([rec(1, 5, 10, 1), rec(1, 5, 11, 2)], 1, 5)).toBe(12) // 10.5→11 → +1
  })
  it('セット番号や重量が違う記録は使わない', () => {
    const h = [rec(2, 5, 15, 1), rec(1, 6, 15, 2), rec(1, 5, 8, 3)]
    expect(calcTarget(h, 1, 5)).toBe(9)
  })
})

describe('判定', () => {
  it('目標以上は前回超え、目標−1はキープ、それ未満は通常', () => {
    expect(judgeSet(12, 12)).toBe('beat')
    expect(judgeSet(11, 12)).toBe('keep')
    expect(judgeSet(10, 12)).toBe('normal')
    expect(judgeSet(10, null)).toBe('normal')
  })
})

describe('セット報酬', () => {
  it('通常10・キープ12・前回超え15', () => {
    const base = { isBonus: false, setNo: 1, intervalOk: true }
    expect(calcSetReward({ ...base, judge: 'normal' }).exp).toBe(10)
    expect(calcSetReward({ ...base, judge: 'keep' }).exp).toBe(12)
    expect(calcSetReward({ ...base, judge: 'beat' })).toEqual({ eligible: true, exp: 15, gold: 0, countsBeat: true })
  })
  it('4セット目以降と30秒未満は対象外', () => {
    expect(calcSetReward({ isBonus: false, setNo: 4, judge: 'beat', intervalOk: true })).toEqual({
      eligible: false,
      exp: 0,
      gold: 0,
      countsBeat: false,
    })
    expect(calcSetReward({ isBonus: false, setNo: 2, judge: 'beat', intervalOk: false }).exp).toBe(0)
  })
  it('腹筋ローラーは5G', () => {
    expect(calcSetReward({ isBonus: true, setNo: 3, judge: 'normal', intervalOk: true })).toMatchObject({
      exp: 0,
      gold: 5,
    })
    expect(calcSetReward({ isBonus: true, setNo: 4, judge: 'normal', intervalOk: true }).gold).toBe(0)
  })
  it('有酸素は1分1G', () => {
    expect(cardioGold(10)).toBe(10)
  })
})

describe('次の一手の提案', () => {
  const curl = EXERCISES.curl
  const session = (kg: number, reps: number[]) => reps.map((r, i) => rec(i + 1, kg, r, i, 'day'))
  it('3セットとも上限なら+1kg', () => {
    expect(suggestProgression(session(5, [15, 15, 16]), curl, 15)).toEqual({ kind: 'addWeight', fromKg: 5, toKg: 6 })
  })
  it('1セットでも届かなければ提案なし', () => {
    expect(suggestProgression(session(5, [15, 15, 14]), curl, 15)).toBeNull()
    expect(suggestProgression(session(5, [15, 15]), curl, 15)).toBeNull()
  })
  it('10kgなら上位種目を提案', () => {
    expect(suggestProgression(session(10, [15, 15, 15]), curl, 15)).toEqual({
      kind: 'upgrade',
      toExerciseId: 'curlSlow',
    })
  })
  it('自重種目は上限回数で上位種目を提案', () => {
    expect(suggestProgression(session(0, [20, 20, 20]), EXERCISES.pushup, 20)).toEqual({
      kind: 'upgrade',
      toExerciseId: 'pushupBar',
    })
  })
  it('一番新しい日の記録だけを取り出す', () => {
    const h = [rec(1, 5, 10, 1, 'a'), rec(1, 5, 11, 5, 'b'), rec(2, 5, 9, 6, 'b')]
    expect(latestSession(h)).toHaveLength(2)
  })
})

describe('進化', () => {
  const cost = evolutionCost(1)!
  it('初期コスト', () => {
    expect(cost).toEqual({ exp: 150, gold: 30 })
    expect(evolutionCost(4)).toEqual({ exp: 2500, gold: 500 })
    expect(evolutionCost(5)).toBeNull()
  })
  it('購入EXPは必要EXPの半分まで', () => {
    expect(boughtCap(cost)).toBe(75)
    expect(planPour(cost, { trained: 0, bought: 0 }, { trained: 0, bought: 500 })).toEqual({ trained: 0, bought: 75 })
    expect(planPour(cost, { trained: 0, bought: 75 }, { trained: 40, bought: 500 })).toEqual({
      trained: 40,
      bought: 0,
    })
  })
  it('必要量を超えては注がない', () => {
    expect(planPour(cost, { trained: 100, bought: 0 }, { trained: 300, bought: 300 })).toEqual({
      trained: 0,
      bought: 50,
    })
    expect(isExpFull(cost, { trained: 100, bought: 50 })).toBe(true)
    expect(isExpFull(cost, { trained: 100, bought: 49 })).toBe(false)
  })
})

describe('初期データの整合性', () => {
  it('すべての種目に回数範囲があり、上位種目が実在する', () => {
    for (const ex of Object.values(EXERCISES)) {
      expect(CONFIG.repRanges[ex.id], ex.id).toBeDefined()
      if (ex.next) expect(EXERCISES[ex.next], ex.next).toBeDefined()
    }
  })
  it('枠の候補がすべて実在し、上位種目も同じ枠の候補に入っている', () => {
    for (const slot of SLOTS) {
      for (const id of slot.candidates) {
        expect(EXERCISES[id], id).toBeDefined()
        const next = EXERCISES[id].next
        if (next) expect(slot.candidates, `${slot.id}:${next}`).toContain(next)
      }
    }
  })
  it('進化ツリーの行き先がすべて実在し、進化コストが定義されている', () => {
    for (const t of TEMPLATES) {
      for (const node of t.nodes) {
        for (const next of node.next) expect(t.nodes.some((n) => n.id === next)).toBe(true)
        if (node.next.length > 0) expect(evolutionCost(node.stage)).not.toBeNull()
      }
    }
  })
})
