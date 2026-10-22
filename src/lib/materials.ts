import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { CORE_KEYS, CORE_LABEL } from './cores'
import { elementInfo } from './element'
import { rarityOf } from './gacha'
import { defaultHp } from './quest'
import { autoQuestSetup } from './questAuto'
import { isHidden, nodeAttr, type MonsterDef, type Quest } from '../types'

export const MATERIAL_PREFIX = 'mat-'

/**
 * いつでも遊べる素材クエスト：核の種類ごとに1つ、最初から用意しておく（作らなくていい）。
 * 敵はハズレのモンスターから日替わり（その部位のハズレを優先）。敵の属性が変わるので、求められる編成も毎日変わる。
 */
export function builtinMaterialQuests(defs: MonsterDef[], today: string): Quest[] {
  const looks = defs.filter((d) => !isHidden(d) && !d.questOnly)
  const hazure = looks.filter((d) => rarityOf(d) === 'hazure')
  const day = Math.floor(Date.parse(`${today}T12:00:00Z`) / 86400000)
  const quests = CORE_KEYS.map((attr, i) => {
    const samePart = hazure.filter((d) => nodeAttr(d, FIRST_NODE_ID) === attr)
    const pool = samePart.length > 0 ? samePart : hazure.length > 0 ? hazure : looks
    // 核の種類ごとにずらして、同じ日に同じ敵が並ばないように
    const enemy = pool.length > 0 ? pool[(day + i) % pool.length] : undefined
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
  // コインの金庫：核の代わりに進化コイン。敵は核の採掘場とずらしたハズレ
  const pool = hazure.length > 0 ? hazure : looks
  const enemy = pool.length > 0 ? pool[(day + CORE_KEYS.length) % pool.length] : undefined
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
