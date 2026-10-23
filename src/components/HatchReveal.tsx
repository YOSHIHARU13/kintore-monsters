import { useEffect, useState } from 'react'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { starsOf } from '../lib/gacha'
import { MonsterImage } from './MonsterImage'
import { monsterName, type MonsterDef, type RarityKey } from '../types'

export interface Hatched {
  def: MonsterDef
  monsterId: string
  shiny: boolean
  pity: boolean
  rarity: RarityKey
}

// タマゴが揺れる → 割れる光の色でレア度が分かる → 星が1つずつ並ぶ → モンスター登場
type Phase = 'shake' | 'glow' | 'stars' | 'reveal'
const SHAKE_MS = 1100
const GLOW_MS = 800
const STAR_MS = 280

export function HatchReveal({ hatched, onClose, onMeet }: { hatched: Hatched; onClose: () => void; onMeet: () => void }) {
  const [phase, setPhase] = useState<Phase>('shake')
  const [shownStars, setShownStars] = useState(0)
  const stars = starsOf(hatched.def, FIRST_NODE_ID)
  const big = hatched.rarity === 'superRare'

  useEffect(() => {
    if (phase === 'shake') {
      const t = setTimeout(() => setPhase('glow'), SHAKE_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'glow') {
      navigator.vibrate?.(hatched.rarity === 'superRare' ? [60, 40, 60, 40, 200] : 60)
      const t = setTimeout(() => setPhase('stars'), GLOW_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'stars') {
      if (shownStars >= stars) {
        const t = setTimeout(() => setPhase('reveal'), STAR_MS * 2)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setShownStars(shownStars + 1), STAR_MS)
      return () => clearTimeout(t)
    }
  }, [phase, shownStars, stars, hatched.rarity])

  const skip = () => {
    setShownStars(stars)
    setPhase('reveal')
  }

  const starRow = (
    <div className="hatch-stars" aria-label={`星${stars}`}>
      {Array.from({ length: stars }, (_, i) => (
        <span key={i} className={i < shownStars ? 'on' : ''}>
          ★
        </span>
      ))}
    </div>
  )

  if (phase !== 'reveal') {
    return (
      <div className={`beat-overlay hatch-overlay glow-${hatched.rarity}`} onClick={skip}>
        <div className="beat-text">
          <div className={`hatch-egg${phase === 'shake' ? ' shaking' : ' cracked'}`}>🥚</div>
          {phase !== 'shake' && <div className="hatch-glow" />}
          {phase === 'stars' && starRow}
          <button
            className="btn small ghost"
            onClick={(e) => {
              e.stopPropagation()
              skip()
            }}
          >
            スキップ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`beat-overlay${big ? ' clear-overlay' : ''}`} onClick={onClose}>
      <div className="beat-burst" />
      {big && <div className="beat-burst reverse" />}
      {big && Array.from({ length: 42 }, (_, i) => <i key={i} className="spark" style={{ ['--i' as string]: i }} />)}
      <div className="beat-text">
        {hatched.pity && <div className="beat-sub">レア以上確定！</div>}
        {hatched.rarity !== 'normal' && (
          <div className={`beat-title rarity-${hatched.rarity}`}>
            {CONFIG.gacha.rarities[hatched.rarity].label}
            ！
          </div>
        )}
        {starRow}
        <MonsterImage imageId={imageOf(hatched.def, FIRST_NODE_ID)} awaken={awakenOf(hatched.def, FIRST_NODE_ID)} glow={glowOf(hatched.def)} size={180} shiny={hatched.shiny} />
        <div className="beat-title">{monsterName(hatched.def, FIRST_NODE_ID)}</div>
        <div className="beat-sub">が生まれた！</div>
        <button
          className="btn primary"
          onClick={(e) => {
            e.stopPropagation()
            onMeet()
          }}
        >
          会いに行く
        </button>
      </div>
    </div>
  )
}
