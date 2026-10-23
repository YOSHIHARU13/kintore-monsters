import { describe, expect, it } from 'vitest'
import { boostActive } from './boosters'
import { habitGoldNow } from './rewards'
import type { GameState } from '../types'

describe('ブースター', () => {
  it('習慣ブースター中は、分数のオーブが2倍で1日の上限もない', () => {
    const st = { habitMode: 'minutes', habitDate: '2026-10-05', habitMinutesToday: 25, boosts: { habit: true } } as GameState
    expect(habitGoldNow(st, '2026-10-05', 20)).toBe(40) // 20分 × 1オーブ × 2（上限なし）
    expect(habitGoldNow({ ...st, habitMode: 'check' }, '2026-10-06', 0)).toBe(10)
  })
  it('使用中かどうか（筋トレは残りセットがあるあいだ）', () => {
    expect(boostActive({ boosts: { expSets: 3 } }, 'exp')).toBe(true)
    expect(boostActive({ boosts: { expSets: 0 } }, 'exp')).toBe(false)
    expect(boostActive({ boosts: { quest: true } }, 'quest')).toBe(true)
    expect(boostActive({ boosts: {} }, 'habit')).toBe(false)
  })
})
