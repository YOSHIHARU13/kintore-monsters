import { describe, expect, it } from 'vitest'
import { dropLabel, dropOf, expectedDrop, rollBonusStones, rollLots, rollMaterialDrop } from './cores'

const seq = (...values: number[]) => () => values.shift() ?? 0.99

describe('素材のくじ', () => {
  it('くじの回数だけ引き、当たった数だけ落ちる（毎回ばらつく）', () => {
    const lots = { rolls: 3, rate: 0.5, amount: 1 }
    expect(rollLots(lots, 0, seq(0.1, 0.9, 0.2))).toBe(2)
    expect(rollLots(lots, 0, seq(0.9, 0.9, 0.9))).toBe(0)
    expect(rollLots({ ...lots, amount: 30 }, 0, seq(0.1, 0.1, 0.1))).toBe(90)
  })

  it('運極1体につき、くじが1回増える', () => {
    // 究極の結晶：7回 + 運極2体で9回
    const all = () => 0
    expect(rollMaterialDrop('stone', 'hard', 0, 0, all).count).toBe(7)
    expect(rollMaterialDrop('stone', 'hard', 2, 0, all).count).toBe(9)
  })

  it('難易度が上がるほど、平均でたくさん落ちる', () => {
    for (const kind of ['stone', 'muscle', 'ball', 'coins'] as const) {
      expect(expectedDrop(kind, 'normal', 0)).toBeGreaterThan(expectedDrop(kind, 'easy', 0))
      expect(expectedDrop(kind, 'hard', 0)).toBeGreaterThan(expectedDrop(kind, 'normal', 0))
    }
  })

  it('筋肉玉は、5回続けて落ちなかったら次は必ず1個', () => {
    expect(rollMaterialDrop('ball', 'easy', 0, 3, seq(0.99)).count).toBe(0)
    expect(rollMaterialDrop('ball', 'easy', 0, 4, seq(0.99))).toEqual({ count: 1, pity: true })
    // 結晶には天井がない
    expect(rollMaterialDrop('stone', 'easy', 0, 10, seq(0.99, 0.99, 0.99)).count).toBe(0)
  })

  it('ボスクエストのおまけの結晶', () => {
    expect(rollBonusStones(seq(0.1, 0.1))).toBe(2)
    expect(rollBonusStones(seq(0.9, 0.9))).toBe(0)
  })

  it('落ちるものの名前', () => {
    expect(dropLabel({ drop: 'stone', attr: 'none', element: 'fire' })).toBe('炎の結晶')
    expect(dropLabel({ drop: 'muscle', attr: 'legs' })).toBe('健脚の核')
    expect(dropLabel({ drop: 'ball', attr: 'none' })).toBe('筋肉玉')
    // 自作の素材クエスト：部位の核（部位がなければ筋肉玉）
    expect(dropOf({ attr: 'chestArms' })).toBe('muscle')
    expect(dropOf({ attr: 'none' })).toBe('ball')
  })
})
