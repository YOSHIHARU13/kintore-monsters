import { castleFloors } from './castle'
import { lifespanOf } from './lifespan'
import type { MonsterDef, Quest } from '../types'

/** 寿命の計算は重い（数秒）ので、画面を止めないように別の流れで計算する */
self.onmessage = (e: MessageEvent<{ month: string; defs: MonsterDef[]; gimmicks: string[]; quests: Quest[] }>) => {
  const { month, defs, gimmicks, quests } = e.data
  const result = lifespanOf(defs, (list) => castleFloors(month, list, gimmicks, quests).map((f) => f.quest), gimmicks)
  self.postMessage(result)
}
