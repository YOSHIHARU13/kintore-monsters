import { useEffect, useRef, useState } from 'react'
import { awakenOf, imageOf, glowOf, monArt } from '../lib/art'
import { useStore } from '../store'
import { SLOTS, exerciseOfSlot } from '../data/exercises'
import { battleOf } from '../lib/quest'
import { Gauge } from './Gauge'
import { MonsterImage } from './MonsterImage'
import { bannerNodeOf } from './GachaBanner'
import type { Go } from '../nav'

export function useBattle() {
  const { state, today, quests, tower, castle, defs, owned, weekSets, menu } = useStore()
  const exerciseName = (slotId: string) => {
    const slot = SLOTS.find((s) => s.id === slotId)
    return slot ? exerciseOfSlot(slot, menu).name : '？'
  }
  return battleOf(state.challenge, today, [...quests, ...tower.map((f) => f.quest), ...castle.map((f) => f.quest)], defs, owned, weekSets, exerciseName)
}

/** 出撃中に、トレーニング画面とセット入力画面の上に出すボスのHP。ダメージが入ると数字が飛ぶ */
export function BattleBar({ go }: { go: Go }) {
  const battle = useBattle()
  const prev = useRef(battle?.damage ?? 0)
  const [pop, setPop] = useState<{ id: number; amount: number; members: { id: string; d: number }[] } | null>(null)

  useEffect(() => {
    const damage = battle?.damage ?? 0
    if (damage > prev.current && battle) {
      // 今のセットで、誰がどれだけ削ったか（多い順に3体）
      const last = battle.hits[battle.hits.length - 1]
      const members = Object.entries(last?.byMember ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, d]) => ({ id, d }))
      setPop({ id: Date.now(), amount: damage - prev.current, members })
      navigator.vibrate?.(40)
    }
    prev.current = damage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.damage])

  if (!battle) return null
  const left = Math.max(0, battle.hp - battle.damage)
  return (
    <button className={`battle-bar${battle.defeated ? ' defeated' : ''}`} onClick={() => go({ name: 'quests' })}>
      {battle.boss && (
        <MonsterImage imageId={imageOf(battle.boss, bannerNodeOf(battle.boss))} awaken={awakenOf(battle.boss, bannerNodeOf(battle.boss))} glow={glowOf(battle.boss)} size={44} silhouette={!battle.defeated} />
      )}
      <span className="goal-body">
        <strong className="small">
          ⚔️ {battle.quest.name}
          {battle.defeated ? '　討伐！タップして報酬を受け取る' : `　のこりHP ${left.toLocaleString()}`}
        </strong>
        <Gauge value={left} max={battle.hp} color="#ef476f" />
      </span>
      {pop && (
        <span key={pop.id} className="battle-pop">
          -{pop.amount.toLocaleString()}
          {pop.members.map((m, i) => {
            const member = battle.party.find((p) => p.mon.id === m.id)
            return member ? (
              <span key={m.id} className={`pop-member${i === 0 ? ' top' : ''}`}>
                <MonsterImage {...monArt(member.def, member.mon)} size={i === 0 ? 36 : 26} />
                {Math.round(m.d).toLocaleString()}
              </span>
            ) : null
          })}
        </span>
      )}
    </button>
  )
}
