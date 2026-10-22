import { describe, expect, it } from 'vitest'
import { activeToday, canClaim, currentStats, dailyMissions, dexMissions, loginReward, weeklyMissions } from './missions'
import type { GameState, MonsterDef, SetRecord } from '../types'

const state = (extra: Partial<GameState> = {}) =>
  ({ habitMode: 'minutes', habitDate: null, habitMinutesToday: 0, claims: {}, stats: null, dexFound: {}, loginDays: 0, ...extra }) as GameState
const set = (date: string, day: SetRecord['day'] = 'mon') => ({ date, day, eligible: true }) as SetRecord
const today = '2026-10-23'
const week = '2026-10-19'

describe('ミッション', () => {
  it('デイリー：3つ達成すると「全部達成」も受け取れる。受け取ったらもう押せない', () => {
    const st = state({
      habitDate: today,
      habitMinutesToday: 5,
      stats: { date: today, week, dayQuestClears: 1, weekQuestClears: 1, weekStrictClears: 0, weekHabitMinutes: 5 },
    })
    const ms = dailyMissions({ state: st, today, week, todaySets: [set(today)], weekSets: [] })
    expect(ms.map((m) => canClaim(st, m))).toEqual([true, true, true, true])
    const claimed = { ...st, claims: { [ms[0].key]: true } }
    expect(canClaim(claimed, ms[0])).toBe(false)
    expect(ms[0].key).toBe('daily:set:2026-10-23')
  })
  it('今日・今週の記録は、日付や週が変わると0から', () => {
    const st = state({ stats: { date: '2026-10-22', week, dayQuestClears: 3, weekQuestClears: 5, weekStrictClears: 1, weekHabitMinutes: 40 } })
    expect(currentStats(st, today, week)).toMatchObject({ dayQuestClears: 0, weekQuestClears: 5 })
    expect(currentStats(st, '2026-10-26', '2026-10-26')).toMatchObject({ weekQuestClears: 0, weekHabitMinutes: 0 })
  })
  it('ウィークリー：トレーニングした日数とセット数', () => {
    const sets = [set('2026-10-19'), set('2026-10-21', 'wed'), set('2026-10-23', 'fri'), set('2026-10-23', 'bonus')]
    const ms = weeklyMissions({ state: state(), today, week, todaySets: [], weekSets: sets })
    expect(ms.find((m) => m.id === 'days')).toMatchObject({ have: 3, need: 3 })
    expect(ms.find((m) => m.id === 'sets')?.have).toBe(4)
  })
  it('ログインボーナスは7日周期（休んでもリセットされない）', () => {
    expect(loginReward(state({ loginDays: 0 })).day).toBe(1)
    expect(loginReward(state({ loginDays: 6 }))).toMatchObject({ day: 7, reward: { eggs: 2 } })
    expect(loginReward(state({ loginDays: 7 })).day).toBe(1)
  })
  it('図鑑の達成報酬', () => {
    const defs = [{ id: 'a', templateId: 'single', images: {} }, { id: 'b', templateId: 'single', images: {} }] as unknown as MonsterDef[]
    const ms = dexMissions(defs, [{ id: 'o', defId: 'a', nodeId: 'n1', obtainedAt: 0 }], state())
    expect(ms.find((m) => m.need === 50)?.have).toBe(50)
    expect(ms.filter((m) => canClaim(state(), m)).map((m) => m.need)).toEqual([10, 25, 50])
  })
  it('ログインボーナスと無料ガチャは、今日なにか1つやってから', () => {
    const st = state({ lastCheckinDate: '2026-10-21' })
    expect(activeToday(st, [], today, '2026-10-22')).toBe(false) // 開いただけ
    expect(activeToday(st, [set(today)], today, '2026-10-22')).toBe(true) // 筋トレ1セット
    expect(activeToday(state({ habitDate: today }), [], today, '2026-10-22')).toBe(true) // 習慣
    expect(activeToday(state({ lastCheckinDate: '2026-10-22' }), [], today, '2026-10-22')).toBe(true) // 朝の記録
  })
})
