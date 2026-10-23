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

describe('素材クエストの宝箱', () => {
  const always = () => 0
  const never = () => 0.99
  it('降臨と同じ数（運極1体で+3）。当たりの箱にその素材、はずれの箱にも進化コインかEXP', async () => {
    const { rollMaterialBoxes } = await import('./boxes')
    const hit = rollMaterialBoxes('stone', { attr: 'legs' }, 'normal', { luckMaxCount: 1, boosted: false, misses: 0 }, always)
    expect(hit.boxes).toHaveLength(8)
    expect(hit.boxes.every((b) => b.kind === 'stone')).toBe(true)
    const miss = rollMaterialBoxes('muscle', { attr: 'legs' }, 'normal', { luckMaxCount: 0, boosted: true, misses: 0 }, never)
    expect(miss.boxes).toHaveLength(5)
    expect(miss.boxes.every((b) => (b.kind === 'exp' || b.kind === 'coins') && b.count > 0)).toBe(true)
    expect(rollMaterialBoxes('muscle', { attr: 'legs' }, 'hard', { luckMaxCount: 0, boosted: false, misses: 0 }, always).boxes[0].kind).toBe('core')
  })
  it('筋肉玉は、5回続けて落ちなかったら最後の箱が確定', async () => {
    const { rollMaterialBoxes } = await import('./boxes')
    expect(rollMaterialBoxes('ball', { attr: 'none' }, 'easy', { luckMaxCount: 0, boosted: false, misses: 3 }, never).pity).toBe(false)
    const pity = rollMaterialBoxes('ball', { attr: 'none' }, 'easy', { luckMaxCount: 0, boosted: false, misses: 4 }, never)
    expect(pity.pity).toBe(true)
    expect(pity.boxes[4]).toEqual({ kind: 'ball', count: 1 })
  })
})
