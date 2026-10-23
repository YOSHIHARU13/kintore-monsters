import { describe, expect, it } from 'vitest'
import { addDays, gachaOpen, openPeriods, periodText, thinDays } from './gachaSchedule'

describe('ガチャの開催', () => {
  it('日付で決める：その日を含む。終わっても日付を入れ直せば復刻', () => {
    const g = { builtin: false, schedule: { kind: 'range' as const, start: '2026-11-01', end: '2026-11-14' } }
    expect(gachaOpen(g, '2026-10-31')).toEqual({ open: false, label: '11/1から' })
    expect(gachaOpen(g, '2026-11-14')).toEqual({ open: true, label: 'あと1日' })
    expect(gachaOpen(g, '2026-11-15').open).toBe(false)
  })
  it('毎月◯日〜◯日（超筋肉祭など）', () => {
    const g = { builtin: false, schedule: { kind: 'monthly' as const, from: 10, to: 20 } }
    expect(gachaOpen(g, '2026-10-09').open).toBe(false)
    expect(gachaOpen(g, '2026-10-10')).toMatchObject({ open: true })
    expect(gachaOpen(g, '2026-12-20').open).toBe(true)
  })
  it('決めていなければ、コラボはコラボの期間、それ以外はいつでも', () => {
    expect(gachaOpen({ builtin: false }, '2026-10-10').open).toBe(true)
    expect(gachaOpen({ builtin: false }, '2026-10-10', { kind: 'ended' }).open).toBe(false)
  })
})

describe('開催予定', () => {
  it('開いている日を期間にまとめる。月をまたいでも続く', () => {
    const g = { builtin: false, schedule: { kind: 'monthly' as const, from: 10, to: 20 } }
    const periods = openPeriods((day) => gachaOpen(g, day).open, '2026-10-15', 35)
    expect(periods.map(periodText)).toEqual(['10/15〜10/20', '11/10〜11/18'])
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })
  it('期間限定が2種類に足りない日を知らせる', () => {
    const a = { builtin: false, schedule: { kind: 'monthly' as const, from: 1, to: 20 } }
    const b = { builtin: false, schedule: { kind: 'monthly' as const, from: 15, to: 31 } }
    const count = (day: string) => [a, b].filter((g) => gachaOpen(g, day).open).length
    const gaps = thinDays(count, '2026-11-01', 30, 2)
    expect(gaps.map((p) => `${periodText(p)}:${p.count}`)).toEqual(['11/1〜11/14:1', '11/21〜11/30:1'])
  })
})
