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
 * 敵の見た目はハズレのモンスターから（その部位のハズレがいなければノーマル、それもいなければ誰か）。
 */
export function builtinMaterialQuests(defs: MonsterDef[]): Quest[] {
  const looks = defs.filter((d) => !isHidden(d) && !d.questOnly)
  return CORE_KEYS.map((attr) => {
    const samePart = looks.filter((d) => nodeAttr(d, FIRST_NODE_ID) === attr)
    const enemy =
      samePart.find((d) => rarityOf(d) === 'hazure') ??
      samePart.find((d) => rarityOf(d) === 'normal') ??
      looks.find((d) => rarityOf(d) === 'hazure') ??
      looks[0]
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
    }
  })
}
