import { FIRST_NODE_ID, getNode, getTemplate } from '../data/evolutionTemplates'
import { isHidden, type MonsterDef } from '../types'
import { rarityOf } from './gacha'

/** その形態の絵。覚醒ツリーは第1段階の1枚を使い回す */
export function imageOf(def: Pick<MonsterDef, 'images' | 'templateId'>, nodeId: string): string | undefined {
  if (def.images[nodeId]) return def.images[nodeId]
  return getTemplate(def.templateId).awaken ? def.images[FIRST_NODE_ID] : undefined
}

/** 覚醒の段階（0：通常、1：覚醒、2：真・覚醒）。覚醒ツリー以外は0 */
export function awakenOf(def: Pick<MonsterDef, 'templateId'>, nodeId: string): number {
  const template = getTemplate(def.templateId)
  return template.awaken ? getNode(template, nodeId).stage - 1 : 0
}

/** 激レア以上のうしろに出すエフェクト（激レアは虹色、ジョグレスは金と紫） */
export type Glow = 'superRare' | 'jogress'
export function glowOf(def: MonsterDef): Glow | undefined {
  if (isHidden(def)) return 'jogress'
  return rarityOf(def) === 'superRare' ? 'superRare' : undefined
}
