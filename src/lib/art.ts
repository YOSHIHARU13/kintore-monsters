import { FIRST_NODE_ID, getNode, getTemplate } from '../data/evolutionTemplates'
import { isHidden, type MonsterDef, type OwnedMonster } from '../types'
import { rarityOf } from './gacha'
import { GOLD_IMAGE, SHINKA_IMAGE, shinkaTierOf } from './shinka'

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

/**
 * 持っている個体の絵：獣神化していれば、金は合体の絵、銀は獣神化の絵（なければ今の絵に後光）。
 * MonsterImage にそのまま渡せる形で返す
 */
export function monArt(
  def: MonsterDef,
  mon: Pick<OwnedMonster, 'nodeId' | 'shinka' | 'shinkaGold'>,
): { imageId: string | undefined; awaken: number; glow: Glow | undefined } {
  const tier = shinkaTierOf(mon, def)
  const base = imageOf(def, mon.nodeId)
  if (tier === 'gold' && !isHidden(def)) return { imageId: def.images[GOLD_IMAGE] ?? base, awaken: def.images[GOLD_IMAGE] ? 0 : 2, glow: 'jogress' }
  if (tier === 'silver') return { imageId: def.images[SHINKA_IMAGE], awaken: 0, glow: glowOf(def) }
  if (tier === 'bronze') return { imageId: base, awaken: 2, glow: glowOf(def) }
  return { imageId: base, awaken: awakenOf(def, mon.nodeId), glow: glowOf(def) }
}
