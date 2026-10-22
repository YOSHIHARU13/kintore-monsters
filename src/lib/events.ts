import { CONFIG } from '../config/gameConfig'
import type { GameState } from '../types'

/** 無料ガチャのイベント（毎週木曜の10連、毎月1日の10連、毎月15日の激レア確定…） */
export interface FreePullEvent {
  id: string
  label: string
  pulls: number
  weekday?: number // 0=日曜 … 6=土曜
  monthDay?: number // 毎月この日
  guaranteed?: boolean // 激レア確定
}

const dateOf = (key: string) => new Date(`${key}T12:00:00`)
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function isEventDay(ev: FreePullEvent, date: string): boolean {
  const d = dateOf(date)
  if (ev.weekday !== undefined) return d.getDay() === ev.weekday
  if (ev.monthDay !== undefined) return d.getDate() === ev.monthDay
  return false
}

export const claimKey = (ev: FreePullEvent, date: string) => `${ev.id}:${date}`

/** 今日もらえる（まだ引いていない）無料ガチャ */
export function availableEvents(state: Pick<GameState, 'freeClaims'>, today: string): FreePullEvent[] {
  return CONFIG.events.freePulls.filter((ev) => isEventDay(ev, today) && !state.freeClaims?.[claimKey(ev, today)])
}

/** 次のイベントの日（今日を含まない）と、あと何日か。近い順 */
export function upcomingEvents(today: string): { event: FreePullEvent; date: string; days: number }[] {
  const start = dateOf(today)
  return CONFIG.events.freePulls
    .map((event) => {
      for (let days = 1; days <= 62; days++) {
        const d = new Date(start)
        d.setDate(start.getDate() + days)
        const date = keyOf(d)
        if (isEventDay(event, date)) return { event, date, days }
      }
      return null
    })
    .filter((x) => x !== null)
    .sort((a, b) => a.days - b.days)
}
