import { useStore } from '../store'
import { customized, isFavorite } from '../lib/custom'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { SLOTS, exerciseOfSlot } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from '../components/MonsterImage'
import { Stars } from '../components/Stars'
import { partnerRate, rateText } from '../lib/partner'
import { attackOf } from '../lib/stats'
import type { Go } from '../nav'
import { plusName } from '../types'

/** 種目の枠に相棒をセットする画面。倍率の高い順に並べる */
export function PartnerPick({ slotId, go }: { slotId: string; go: Go }) {
  const { state, menu, owned, defs, setPartner } = useStore()
  const slot = SLOTS.find((s) => s.id === slotId)!
  const ex = exerciseOfSlot(slot, menu)
  const slotName = (id: string) => {
    const s = SLOTS.find((x) => x.id === id)
    return s ? exerciseOfSlot(s, menu).name : '？'
  }
  // そのモンスターが今どの枠の相棒か
  const slotOf = (monId: string) => Object.entries(state.partners).find(([, id]) => id === monId)?.[0]
  const list = owned
    .flatMap((mon) => {
      const def = defs.find((d) => d.id === mon.defId)
      return def ? [{ mon, def, rate: partnerRate(mon, def, slotId) }] : []
    })
    .sort((a, b) => b.rate - a.rate)
  const current = state.partners[slotId]

  const pick = (monId: string | null) => {
    setPartner(slotId, monId)
    go({ name: 'training' })
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'training' })}>
        ← メニューに戻る
      </button>
      <h1 className="title">{ex.name}の相棒</h1>
      <p className="muted small">
        相棒の攻撃力が高いほど、この種目のEXPが増えます（攻撃力3,000ごとに +
        {Math.round(CONFIG.partner.perAttack * 3000 * 100)}%）。この種目が得意なモンスターなら、さらに ×{CONFIG.partner.favorite}
        。1体が相棒になれるのは1つの種目だけです。
      </p>
      {current && (
        <button className="btn ghost wide" onClick={() => pick(null)}>
          相棒を外す
        </button>
      )}
      {list.length === 0 && <p className="muted">まだモンスターがいません。</p>}
      <ul className="choice-list">
        {list.map(({ mon, def, rate }) => {
          const other = slotOf(mon.id)
          return (
            <li key={mon.id}>
              <button className={`choice${current === mon.id ? ' on' : ''}`} onClick={() => pick(mon.id)}>
                <span className="monster-row">
                  <MonsterImage imageId={imageOf(def, mon.nodeId)} awaken={awakenOf(def, mon.nodeId)} glow={glowOf(def)} size={48} plus={mon.plus} shiny={mon.shiny} />
                  <span>
                    {plusName(def, mon)} <Stars def={def} nodeId={mon.nodeId} mon={mon} />
                    <br />
                    <span className="small">攻撃力 {attackOf(mon, def).toLocaleString()}　</span>
                    <strong className="bonus-reward">EXP{rateText(rate)}</strong>
                    {isFavorite(customized(def, mon), slotId) && <span className="tag keep"> 得意種目！</span>}
                    {other && other !== slotId && (
                      <span className="muted small">（いまは「{slotName(other)}」の相棒。選ぶとこちらに移ります）</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
