import { describe, expect, it } from 'vitest'
import { availableEvents, upcomingEvents } from './events'

describe('無料ガチャの日', () => {
  it('木曜は無料10連。引いたらその日はもう出ない', () => {
    // 2026-10-22 は木曜
    expect(availableEvents({ freeClaims: {} }, '2026-10-22').map((e) => e.id)).toEqual(['thursday'])
    expect(availableEvents({ freeClaims: { 'thursday:2026-10-22': true } }, '2026-10-22')).toEqual([])
    expect(availableEvents({ freeClaims: {} }, '2026-10-23')).toEqual([])
  })
  it('毎月1日は10連、15日は激レア確定', () => {
    expect(availableEvents({ freeClaims: {} }, '2026-11-01').map((e) => e.id)).toEqual(['monthStart'])
    expect(availableEvents({ freeClaims: {} }, '2026-11-15')[0]).toMatchObject({ id: 'monthMid', guaranteed: true })
  })
  it('次のイベントまでの日数（近い順）', () => {
    const next = upcomingEvents('2026-10-23')
    expect(next[0]).toMatchObject({ date: '2026-10-29', days: 6 }) // 次の木曜
    expect(next.find((n) => n.event.id === 'monthStart')).toMatchObject({ date: '2026-11-01', days: 9 })
  })
})
