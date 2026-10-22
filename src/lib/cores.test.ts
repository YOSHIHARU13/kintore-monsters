import { describe, expect, it } from 'vitest'
import { rollBonusCore, rollCoreDrop } from './cores'

const seq = (...values: number[]) => () => values.shift() ?? 0

describe('核のドロップ', () => {
  it('難易度ごとの確率で落ちる（初級50%・中級65%・上級80%）', () => {
    expect(rollCoreDrop('easy', 0, seq(0.49, 0.9)).count).toBe(1)
    expect(rollCoreDrop('easy', 0, seq(0.5)).count).toBe(0)
    expect(rollCoreDrop('normal', 0, seq(0.64, 0.9)).count).toBe(1)
    expect(rollCoreDrop('hard', 0, seq(0.79, 0.9)).count).toBe(1)
  })

  it('上級は25%で2個', () => {
    expect(rollCoreDrop('hard', 0, seq(0.1, 0.2)).count).toBe(2)
    expect(rollCoreDrop('normal', 0, seq(0.1, 0.0)).count).toBe(1) // 中級は2個にならない
  })

  it('3回続けて落ちなかったら、次は必ず落ちる', () => {
    expect(rollCoreDrop('easy', 2, seq(0.99)).count).toBe(0)
    expect(rollCoreDrop('easy', 3, seq(0.99, 0.99))).toEqual({ count: 1, pity: true })
  })

  it('ボスクエストのおまけは15%', () => {
    expect(rollBonusCore(seq(0.14))).toBe(1)
    expect(rollBonusCore(seq(0.15))).toBe(0)
  })
})
