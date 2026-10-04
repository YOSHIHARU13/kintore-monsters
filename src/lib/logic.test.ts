import { describe, expect, it } from 'vitest'
import { calcTarget, judgeSet, recentSessions, suggestProgression } from './target'
import { calcSetReward, cardioGold } from './rewards'
import { boughtCap, evolutionCost, isExpFull, planPour } from './evolution'
import { CONFIG } from '../config/gameConfig'
import { EXERCISES, SLOTS, TASK_SLOTS } from '../data/exercises'
import { weekStartKey } from './date'
import { isWeekCleared, partProgress, slotDone } from './week'
import { TEMPLATES, canChangeTemplate, getTemplate, pathTo } from '../data/evolutionTemplates'

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
  // 1回分（同じ日）の3セット。week が大きいほど新しい
  const session = (week: number, kg: number, reps: number[]) =>
    reps.map((r, i) => rec(i + 1, kg, r, week * 10 + i, `w${week}`))
  it('2回連続で3セットとも上限なら+1kg', () => {
    expect(suggestProgression([session(2, 5, [15, 15, 16]), session(1, 5, [15, 15, 15])], curl, 15)).toEqual({
      kind: 'addWeight',
      fromKg: 5,
      toKg: 6,
    })
  })
  it('たまたま1回だけ上限に届いても提案しない', () => {
    expect(suggestProgression([session(2, 5, [15, 15, 15])], curl, 15)).toBeNull()
    expect(suggestProgression([session(2, 5, [15, 15, 15]), session(1, 5, [15, 15, 12])], curl, 15)).toBeNull()
  })
  it('1セットでも届かない・3セットに足りない回があれば提案なし', () => {
    expect(suggestProgression([session(2, 5, [15, 15, 14]), session(1, 5, [15, 15, 15])], curl, 15)).toBeNull()
    expect(suggestProgression([session(2, 5, [15, 15]), session(1, 5, [15, 15, 15])], curl, 15)).toBeNull()
  })
  it('重量を上げた直後は、その重量で連続達成するまで提案しない', () => {
    expect(suggestProgression([session(2, 6, [15, 15, 15]), session(1, 5, [15, 15, 15])], curl, 15)).toBeNull()
  })
  it('10kgなら上位種目を提案', () => {
    expect(suggestProgression([session(2, 10, [15, 15, 15]), session(1, 10, [15, 15, 15])], curl, 15)).toEqual({
      kind: 'upgrade',
      toExerciseId: 'curlSlow',
    })
  })
  it('自重種目は上限回数で上位種目を提案', () => {
    const sessions = [session(2, 0, [20, 20, 20]), session(1, 0, [20, 21, 20])]
    expect(suggestProgression(sessions, EXERCISES.pushup, 20)).toEqual({ kind: 'upgrade', toExerciseId: 'pushupBar' })
  })
  it('履歴を日付ごとにまとめて新しい順に取り出す', () => {
    const h = [rec(1, 5, 10, 1, 'a'), rec(1, 5, 11, 5, 'b'), rec(2, 5, 9, 6, 'b'), rec(1, 5, 9, 9, 'c')]
    const sessions = recentSessions(h, 2)
    expect(sessions.map((s) => s[0].date)).toEqual(['c', 'b'])
    expect(sessions[1]).toHaveLength(2)
  })
})

describe('今週のタスク', () => {
  const sets = (slotId: string, count: number) => Array.from({ length: count }, () => ({ slotId }))
  it('週は月曜はじまり', () => {
    expect(weekStartKey(new Date(2026, 9, 5))).toBe('2026-10-05') // 月曜
    expect(weekStartKey(new Date(2026, 9, 7))).toBe('2026-10-05') // 水曜
    expect(weekStartKey(new Date(2026, 9, 4))).toBe('2026-09-28') // 日曜は前の週
  })
  it('全種目×3セットがタスクで、腹筋ローラーは含まない', () => {
    expect(TASK_SLOTS).toHaveLength(14)
    const progress = partProgress([])
    expect(progress.mon.total + progress.wed.total + progress.fri.total).toBe(42)
  })
  it('1枠で数えるのは3セットまで。別の日に分けても同じ枠に積み上がる', () => {
    const week = [...sets('mon1', 5), ...sets('wed1', 2), ...sets('bonus', 3)]
    expect(slotDone(week, 'mon1')).toBe(3)
    expect(partProgress(week)).toMatchObject({ mon: { done: 3, total: 15 }, wed: { done: 2, total: 12 }, fri: { done: 0 } })
  })
  it('全枠が3セットに届いたら全消し', () => {
    const all = TASK_SLOTS.flatMap((slot) => sets(slot.id, 3))
    expect(isWeekCleared(all)).toBe(true)
    expect(isWeekCleared(all.slice(1))).toBe(false)
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

describe('進化ツリー', () => {
  it('分岐は最大3種類で、5段階は新規登録の対象外', () => {
    const maxBranch = Math.max(...TEMPLATES.flatMap((t) => t.nodes.map((n) => n.next.length)))
    expect(maxBranch).toBe(3)
    expect(TEMPLATES.filter((t) => !t.retired).every((t) => t.nodes.every((n) => n.stage <= 3))).toBe(true)
  })
  it('2種→3種への変更だけ許可し、元ツリーの形態はすべて引き継がれる', () => {
    expect(canChangeTemplate('lateBranch', 'lateBranch3')).toBe(true)
    expect(canChangeTemplate('lateBranch3', 'lateBranch')).toBe(false)
    expect(canChangeTemplate('linear3', 'lateBranch3')).toBe(false)
    for (const t of TEMPLATES.filter((x) => x.extends)) {
      for (const node of getTemplate(t.extends!).nodes) {
        const same = t.nodes.find((n) => n.id === node.id)
        expect(same?.stage).toBe(node.stage)
        for (const next of node.next) expect(same?.next).toContain(next)
      }
    }
  })
})

describe('図鑑', () => {
  it('今の姿までにたどった形態が発見済みになる', () => {
    expect(pathTo(getTemplate('earlyBranch3'), 'n3b')).toEqual(['n1', 'n2b', 'n3b'])
    expect(pathTo(getTemplate('linear3'), 'n1')).toEqual(['n1'])
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
