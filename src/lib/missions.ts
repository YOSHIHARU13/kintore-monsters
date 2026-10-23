import { CONFIG } from '../config/gameConfig'
import { getTemplate, pathTo } from '../data/evolutionTemplates'
import type { BoosterKey, GameState, MonsterDef, OwnedMonster, SetRecord } from '../types'

/** 報酬（卵・G・ブースター） */
export interface Reward {
  eggs?: number
  gold?: number
  coins?: number
  booster?: BoosterKey
}

export function rewardText(r: Reward): string {
  const parts: string[] = []
  if (r.eggs) parts.push(`🥚卵×${r.eggs}`)
  if (r.gold) parts.push(`${r.gold}オーブ`)
  if (r.coins) parts.push(`🪙${r.coins}`)
  if (r.booster) parts.push(`${CONFIG.boosters[r.booster].icon}${CONFIG.boosters[r.booster].label}`)
  return parts.join('・')
}

/** 今日・今週の記録（ミッション用）。日付や週が変わったら0から */
export interface Stats {
  date: string
  week: string
  dayQuestClears: number
  weekQuestClears: number
  weekStrictClears: number // 超絶・超究極
  weekHabitMinutes: number
}

export function currentStats(state: Pick<GameState, 'stats'>, today: string, week: string): Stats {
  const s = state.stats
  return {
    date: today,
    week,
    dayQuestClears: s?.date === today ? s.dayQuestClears : 0,
    weekQuestClears: s?.week === week ? s.weekQuestClears : 0,
    weekStrictClears: s?.week === week ? s.weekStrictClears : 0,
    weekHabitMinutes: s?.week === week ? s.weekHabitMinutes : 0,
  }
}

export interface Mission {
  id: string
  label: string
  have: number
  need: number
  reward: Reward
  key: string // 受け取り済みの記録に使うキー（日・週ごと）
}

interface Context {
  state: GameState
  today: string
  week: string
  todaySets: SetRecord[]
  weekSets: SetRecord[]
}

/** デイリーミッション（最後の1つは「全部達成」） */
export function dailyMissions({ state, today, week, todaySets }: Context): Mission[] {
  const d = CONFIG.missions.daily
  const st = currentStats(state, today, week)
  const habitToday = state.habitDate === today
  const habitDone = state.habitMode === 'minutes' ? (habitToday ? state.habitMinutesToday : 0) : habitToday ? d.habitMinutes : 0
  const list: Mission[] = [
    { id: 'set', label: '筋トレを1セット記録する', have: todaySets.length, need: 1, reward: d.reward, key: '' },
    {
      id: 'habit',
      label: `習慣を${state.habitMode === 'minutes' ? `${d.habitMinutes}分` : '記録'}する`,
      have: habitDone,
      need: d.habitMinutes,
      reward: d.reward,
      key: '',
    },
    { id: 'quest', label: 'クエストを1回クリアする', have: st.dayQuestClears, need: 1, reward: d.reward, key: '' },
  ]
  const done = list.filter((m) => m.have >= m.need).length
  list.push({ id: 'all', label: '今日のミッションを全部達成', have: done, need: 3, reward: d.allReward, key: '' })
  return list.map((m) => ({ ...m, key: `daily:${m.id}:${today}` }))
}

/** ウィークリーミッション */
export function weeklyMissions({ state, today, week, weekSets }: Context): Mission[] {
  const w = CONFIG.missions.weekly
  const st = currentStats(state, today, week)
  const days = new Set(weekSets.filter((s) => s.day !== 'bonus').map((s) => s.date)).size
  const sets = weekSets.filter((s) => s.eligible).length
  const list: Mission[] = [
    { id: 'days', label: `${w.days}日トレーニングする`, have: days, need: w.days, reward: w.reward, key: '' },
    { id: 'sets', label: `${w.sets}セット記録する`, have: sets, need: w.sets, reward: w.reward, key: '' },
    { id: 'strict', label: '超絶か超究極を1回クリアする', have: st.weekStrictClears, need: 1, reward: w.reward, key: '' },
    { id: 'habit', label: `習慣を合計${w.habitMinutes}分`, have: st.weekHabitMinutes, need: w.habitMinutes, reward: w.reward, key: '' },
  ]
  return list.map((m) => ({ ...m, key: `weekly:${m.id}:${week}` }))
}

/** ログインボーナス：ログインした日数で7日周期（休んでもリセットされない） */
export function loginReward(state: Pick<GameState, 'loginDays'>): { day: number; reward: Reward } {
  const cycle = CONFIG.missions.login
  const n = state.loginDays ?? 0
  return { day: (n % cycle.length) + 1, reward: cycle[n % cycle.length] }
}

/** 図鑑の発見数（形態ごと） */
export function dexProgress(defs: MonsterDef[], owned: OwnedMonster[], state: Pick<GameState, 'dexFound'>) {
  let total = 0
  let found = 0
  for (const def of defs) {
    const template = getTemplate(def.templateId)
    const mons = owned.filter((o) => o.defId === def.id)
    const seen = new Set([...mons.flatMap((m) => pathTo(template, m.nodeId)), ...(state.dexFound[def.id] ?? [])])
    total += template.nodes.length
    found += template.nodes.filter((n) => seen.has(n.id)).length
  }
  return { found, total, rate: total ? found / total : 0 }
}

/** 図鑑の達成報酬 */
export function dexMissions(defs: MonsterDef[], owned: OwnedMonster[], state: GameState): Mission[] {
  const p = dexProgress(defs, owned, state)
  return CONFIG.missions.dex.map((m) => ({
    id: `dex${m.percent}`,
    label: `図鑑を${m.percent}%発見`,
    have: Math.floor(p.rate * 100),
    need: m.percent,
    reward: m.reward,
    key: `dex:${m.percent}`,
  }))
}

export const isClaimed = (state: Pick<GameState, 'claims'>, key: string) => state.claims?.[key] === true
export const canClaim = (state: Pick<GameState, 'claims'>, m: Mission) => m.have >= m.need && !isClaimed(state, m.key)

/**
 * 今日なにか1つやったか（筋トレ1セット・習慣・朝の歩数の記録）。
 * ログインボーナスと無料ガチャは、これをやってから受け取れる（開くだけではもらえない）
 */
export function activeToday(
  state: Pick<GameState, 'habitDate' | 'lastCheckinDate'>,
  todaySets: unknown[],
  today: string,
  yesterday: string,
): boolean {
  return todaySets.length > 0 || state.habitDate === today || state.lastCheckinDate === yesterday
}

export const ACTIVE_HINT = '今日、筋トレ1セット・習慣・朝の歩数の記録のどれか1つをやると受け取れます'

/** ログインボーナスは、昨日の歩数を記録してから受け取れる（開くだけではもらえない） */
export function loginReady(state: Pick<GameState, 'lastCheckinDate'>, yesterday: string): boolean {
  return state.lastCheckinDate === yesterday
}
export const LOGIN_HINT = '昨日の歩数を記録すると受け取れます（ホームの「朝の記録」から）'
