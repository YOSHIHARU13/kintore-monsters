import { ELEMENT_COLOR, elementInfo, elementName } from '../lib/element'
import type { MonsterDef } from '../types'

/** 属性のバッジ（炎・超炎・炎×水など） */
export function ElementBadge({ def }: { def: MonsterDef }) {
  const info = elementInfo(def)
  if (info.elements.length === 0) return null
  const colors = info.elements.map((e) => ELEMENT_COLOR[e])
  return (
    <span
      className={`element-badge${info.super ? ' super' : ''}`}
      style={{ background: colors.length > 1 ? `linear-gradient(90deg, ${colors.join(', ')})` : colors[0] }}
    >
      {elementName(info)}
    </span>
  )
}
