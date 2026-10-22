import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { CORE_KEYS, CORE_LABEL } from './cores'
import { ELEMENTS, elementInfo } from './element'
import { rarityOf } from './gacha'
import { defaultHp } from './quest'
import { autoQuestSetup } from './questAuto'
import { isHidden, nodeAttr, type MonsterDef, type Quest } from '../types'

export const MATERIAL_PREFIX = 'mat-'

/**
 * いつでも遊べる素材クエスト：核の種類ごとに1つ、最初から用意しておく（作らなくていい）。
 * 敵はハズレのモンスターから日替わり。5つのクエストに毎日5属性を1つずつ割り振るので、どの属性のハズレも出番がある。
 */
export function builtinMaterialQuests(defs: MonsterDef[], today: string): Quest[] {
  const looks = defs.filter((d) => !isHidden(d) && !d.questOnly)
  const hazure = looks.filter((d) => rarityOf(d) === 'hazure')
  const day = Math.floor(Date.parse(`${today}T12:00:00Z`) / 86400000)
  // 5つのクエスト（核4種＋コイン）に、毎日5属性を1つずつ割り振る（日ごとにずらす）。
  // その属性のハズレの中から敵を選ぶ（核のクエストは、その部位のハズレを優先）。同じ日に同じ属性の敵は並ばない
  const slotElement = (k: number) => ELEMENTS[(k + day) % ELEMENTS.length]
  const enemyFor = (k: number, attr?: string) => {
    const e = slotElement(k)
    const sameEl = hazure.filter((d) => elementInfo(d).elements.includes(e))
    const samePart = attr ? sameEl.filter((d) => nodeAttr(d, FIRST_NODE_ID) === attr) : []
    const pool = samePart.length > 0 ? samePart : sameEl.length > 0 ? sameEl : hazure.length > 0 ? hazure : looks
    return pool.length > 0 ? pool[Math.floor(day / ELEMENTS.length) % pool.length] : undefined
  }
  const quests = CORE_KEYS.map((attr, i) => {
    const enemy = enemyFor(i, attr)
    const setup = enemy ? autoQuestSetup(enemy, 'kiwami', 'material', [], []) : { requirements: [], weakSlots: [] }
    return {
      id: `${MATERIAL_PREFIX}${attr}`,
      name: `${CORE_LABEL[attr]}の採掘場`,
      kind: 'material',
      builtin: true,
      bossDefId: enemy?.id ?? '',
      attr,
      element: enemy ? elementInfo(enemy).elements[0] : undefined,
      weakSlots: setup.weakSlots,
      requirements: setup.requirements,
      hp: defaultHp(1, 'material'),
      rank: 1,
      catchphrase: CONFIG.cores.builtinCatchphrase,
      theme: 'flame',
      createdAt: 0,
    } as Quest
  })
  // コインの金庫：核の代わりに進化コイン。残りの1属性のハズレ
  const enemy = enemyFor(CORE_KEYS.length)
  const setup = enemy ? autoQuestSetup(enemy, 'kiwami', 'material', [], []) : { requirements: [], weakSlots: [] }
  quests.push({
    id: `${MATERIAL_PREFIX}coins`,
    name: '🪙 コインの金庫',
    kind: 'material',
    builtin: true,
    drop: 'coins',
    bossDefId: enemy?.id ?? '',
    attr: 'none',
    element: enemy ? elementInfo(enemy).elements[0] : undefined,
    weakSlots: setup.weakSlots,
    requirements: setup.requirements,
    hp: defaultHp(1, 'material'),
    rank: 1,
    catchphrase: '進化コインがざくざく',
    theme: 'flame',
    createdAt: 0,
  })
  return quests
}
