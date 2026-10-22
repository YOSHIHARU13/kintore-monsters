/** 端末の現地時間での YYYY-MM-DD */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** YYYY-MM-DD の前日 */
export function prevDateKey(key: string): string {
  const d = new Date(`${key}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return dateKey(d)
}

/** その日を含む週の月曜日（週のはじまり）の YYYY-MM-DD */
export function weekStartKey(d: Date = new Date()): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  return dateKey(monday)
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
