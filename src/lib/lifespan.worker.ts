import { castleFloors } from './castle'
import { lifespansOf } from './lifespan'
import type { MonsterDef, OwnedMonster, Quest } from '../types'

/** 寿命の計算は重い（数秒）ので、画面を止めないように別の流れで計算する */
self.onmessage = (
  e: MessageEvent<{ month: string; defs: MonsterDef[]; owned: OwnedMonster[]; gimmicks: string[]; quests: Quest[]; order?: string[] }>,
) => {
  const { month, defs, owned, gimmicks, quests, order } = e.data
  const result = lifespansOf(defs, owned, (list) => castleFloors(month, list, gimmicks, quests, order).map((f) => f.quest), gimmicks)
  self.postMessage(result)
}
