import { describe, expect, it } from 'vitest'
import { boxCount, boxPool, rollBoxes, sumBoxes } from './boxes'

const seq = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('降臨の宝箱', () => {
  it('5個＋運極1体ごとに3個', () => {
    expect(boxCount(0)).toBe(5)
    expect(boxCount(2)).toBe(11)
  })
  it('80%でボス（運1）、残りは均等。超絶以上だけ筋肉玉。零属性のボスは結晶なし', () => {
    expect(boxPool({ grade: 'kiwami', element: 'fire' })).toEqual(['stone', 'exp', 'coins'])
    expect(boxPool({ grade: 'chozetsu', element: 'fire' })).toEqual(['stone', 'exp', 'coins', 'ball'])
    expect(boxPool({ grade: 'bakuzetsu' })).toEqual(['exp', 'coins', 'ball'])
    const boxes = rollBoxes({ grade: 'chozetsu', element: 'fire' }, { luckMaxCount: 0, shinkaMaterial: false, boosted: false }, seq([0.1, 0.79, 0.85, 0.1, 0.5, 0.95, 0.99]))
    expect(boxes.map((b) => b.kind)).toEqual(['boss', 'boss', 'stone', 'boss', 'ball'])
    expect(boxes[0]).toEqual({ kind: 'boss', count: 1, luck: 1 })
    expect(boxes[2].count).toBe(3)
  })
  it('神化素材のボスは1〜3体・運1〜3。ブースターは中身の数が2倍（箱は増えない）', () => {
    const boxes = rollBoxes({ grade: 'chozetsu', element: 'fire' }, { luckMaxCount: 0, shinkaMaterial: true, boosted: true }, seq([0.1, 0.99, 0.99, 0.99, 0.0]))
    expect(boxes).toHaveLength(5)
    expect(boxes[0]).toEqual({ kind: 'boss', count: 6, luck: 14 }) // 3体（運3・3・1）× 2
    const plain = rollBoxes({ grade: 'kiwami', element: 'fire' }, { luckMaxCount: 0, shinkaMaterial: false, boosted: true }, seq([0.9, 0.5]))
    expect(plain[0]).toEqual({ kind: 'exp', count: 60 })
    expect(sumBoxes([{ kind: 'boss', count: 2, luck: 4 }, { kind: 'boss', count: 1, luck: 1 }, { kind: 'coins', count: 100 }])).toMatchObject({ boss: 3, luck: 5, coins: 100 })
  })
})
