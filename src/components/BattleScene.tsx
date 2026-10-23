import { useEffect, useRef, useState } from 'react'
import { awakenOf, glowOf, imageOf, monArt } from '../lib/art'
import { CONFIG } from '../config/gameConfig'
import { battlesReached, stageHp, type Battle, type Hit } from '../lib/quest'
import { Gauge } from './Gauge'
import { MonsterImage } from './MonsterImage'
import { bannerNodeOf } from './GachaBanner'
import { useBattle } from './BattleBar'
import type { Go } from '../nav'

// 3バトルとも同じボス。バトルが進むほど背景が暗く・オーラが強くなって、ボスが本気になっていく
const STAGE_LABEL = ['様子見', '本気', '最終局面']

/**
 * 戦闘画面：今のバトルの敵とHP、出撃した6体。セットを記録すると、味方が順に攻撃して
 * 1体ずつのダメージと、効いた補正（部位一致・アビリティ・得意種目…）が飛ぶ。バトルを突破すると、同じボスが本気になる（背景とオーラが変わる）
 */
// paused：ほかの演出（前回超え・全消し）が上に出ている間は、攻撃の演出を待たせる（閉じてから見せる）
export function BattleScene({ go, compact = false, battle: given, paused = false }: { go?: Go; compact?: boolean; battle?: Battle | null; paused?: boolean }) {
  const live = useBattle()
  const battle = given === undefined ? live : given
  const prevHits = useRef(battle?.hits.length ?? 0)
  const [anim, setAnim] = useState<{ key: number; hit: Hit; cleared: number | null } | null>(null)

  useEffect(() => {
    if (!battle || paused) return
    const n = battle.hits.length
    if (n > prevHits.current) {
      const hit = battle.hits[n - 1]
      const before = battlesReached(battle.damage - hit.damage, battle.hp)
      setAnim({ key: Date.now(), hit, cleared: battle.reached > before ? battle.reached : null })
      navigator.vibrate?.(40)
    }
    prevHits.current = n
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.hits.length, paused])

  if (!battle) return null
  const total = CONFIG.quest.battles
  const shownStage = battle.defeated ? total : battle.stage
  const enemy = battle.boss
  const stage = stageHp(battle.damage, battle.hp)
  const left = battle.defeated ? 0 : stage.left
  const size = compact ? 84 : 120
  const order = battle.party.map((m) => m.mon.id)

  return (
    <div className={`battle-scene${compact ? ' compact' : ''}`} onClick={() => go?.({ name: 'quests' })}>
      <div className="bs-head">
        <span className="bs-stage">
          BATTLE {shownStage}/{total}
          <span className="bs-pips">
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i < battle.reached ? 'done' : i === shownStage - 1 ? 'now' : ''} />
            ))}
          </span>
        </span>
        <span className="small">{battle.quest.name}</span>
      </div>
      <div className={`bs-field stage-${shownStage}`}>
        <div key={`${shownStage}-${anim?.key ?? 0}`} className={`bs-enemy${anim ? ' hit' : ''}${battle.defeated ? ' down' : ''}`}>
          {enemy && (
            <MonsterImage imageId={imageOf(enemy, bannerNodeOf(enemy))} awaken={awakenOf(enemy, bannerNodeOf(enemy))} glow={glowOf(enemy)} size={size} />
          )}
          {anim && (
            <>
              <span className="bs-slash" />
              <span className="bs-damage">-{anim.hit.damage.toLocaleString()}</span>
            </>
          )}
        </div>
        <div className="bs-enemy-info">
          <span className="small">
            {enemy?.name ?? '？'}・{STAGE_LABEL[shownStage - 1]}
          </span>
          <Gauge value={left} max={stage.max} color="#ef476f" />
          <span className="muted small">
            {battle.defeated ? '討伐！報酬を受け取ろう' : `のこりHP ${Math.ceil(left).toLocaleString()}`}
            {!compact && `（全体 ${Math.max(0, battle.hp - battle.damage).toLocaleString()} / ${battle.hp.toLocaleString()}）`}
          </span>
        </div>
        {anim?.cleared && !battle.defeated && (
          <div key={anim.key} className="bs-clear">
            BATTLE {anim.cleared} CLEAR!
            <span className="small">{enemy?.name ?? 'ボス'}が{STAGE_LABEL[anim.cleared]}に…！</span>
          </div>
        )}
      </div>
      <div className="bs-party">
        {battle.party.map((m, i) => {
          const dealt = anim?.hit.byMember[m.mon.id]
          const skills = anim?.hit.skills?.[m.mon.id] ?? []
          const mvp = battle.mvpId === m.mon.id && (battle.byMember[m.mon.id] ?? 0) > 0
          return (
            <div key={`${m.mon.id}-${anim?.key ?? 0}`} className={`bs-member${anim ? ' attack' : ''}`} style={{ animationDelay: `${i * 0.12}s` }}>
              {mvp && <span className="bs-mvp">👑</span>}
              <MonsterImage {...monArt(m.def, m.mon)} size={compact ? 38 : 48} />
              {anim && dealt !== undefined ? (
                <span className="bs-dealt" style={{ animationDelay: `${i * 0.12 + 0.15}s` }}>
                  {Math.round(dealt).toLocaleString()}
                </span>
              ) : (
                <span className="bs-sum small">{Math.round(battle.byMember[m.mon.id] ?? 0).toLocaleString()}</span>
              )}
              {anim &&
                skills.slice(0, 2).map((s) => (
                  <span key={s} className={`bs-skill${/×1\/|1\/3/.test(s) ? ' bad' : ''}`} style={{ animationDelay: `${i * 0.12 + 0.25}s` }}>
                    {s}
                  </span>
                ))}
            </div>
          )
        })}
        {Array.from({ length: Math.max(0, CONFIG.quest.partySize - order.length) }, (_, i) => (
          <div key={`empty-${i}`} className="bs-member empty" />
        ))}
      </div>
      {anim && <p className="small bs-label">{anim.hit.label}{anim.hit.notes.length > 0 ? `・${anim.hit.notes.slice(0, 2).join('・')}` : ''}</p>}
    </div>
  )
}
