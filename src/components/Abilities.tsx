import { useStore } from '../store'
import { abilityName, abilitySlots, allGimmicks } from '../lib/gimmick'
import type { MonsterDef } from '../types'

/** アビリティのバッジ。持てる数がレア度の格なので、空き枠も薄く出す */
export function Abilities({ def }: { def: MonsterDef }) {
  const { quests } = useStore()
  const names = allGimmicks(quests)
  const slots = abilitySlots(def)
  if (slots === 0) return null
  const own = (def.abilities ?? []).slice(0, slots)
  return (
    <span className="abilities" aria-label="アビリティ">
      {own.map((g) => (
        <span key={g} className="ability">
          {abilityName(g, names)}
        </span>
      ))}
      {Array.from({ length: slots - own.length }, (_, i) => (
        <span key={`empty${i}`} className="ability empty">
          ー
        </span>
      ))}
    </span>
  )
}
