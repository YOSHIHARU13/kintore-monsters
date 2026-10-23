import { describe, expect, it } from 'vitest'
import { gachaOpen } from './gachaSchedule'

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
