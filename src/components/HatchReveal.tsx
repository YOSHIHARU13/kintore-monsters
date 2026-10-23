import { useEffect, useState } from 'react'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { starsOf } from '../lib/gacha'
import { MonsterImage } from './MonsterImage'
import { FitHint } from './FitList'
import { monsterName, type MonsterDef, type RarityKey } from '../types'

export interface Hatched {
  def: MonsterDef
  monsterId: string
  shiny: boolean
  pity: boolean
  rarity: RarityKey
}

// タマゴが落ちてくる → 揺れる → 光が昇格（青→金→虹。レア度で止まる）→ 画面が白く光って割れる → 星が1つずつ → モンスター登場
type Phase = 'drop' | 'shake' | 'promote' | 'flash' | 'stars' | 'reveal'
const DROP_MS = 550
const SHAKE_MS = 1100
const PROMOTE_STEP_MS = 650
const FLASH_MS = 380
const STAR_MS = 280
// 昇格の段：ノーマルは青のまま、レアは金まで、激レアは虹まで
const STEPS: Record<RarityKey, string[]> = { normal: ['normal'], rare: ['normal', 'rare'], superRare: ['normal', 'rare', 'superRare'] }

export function HatchReveal({ hatched, onClose, onMeet }: { hatched: Hatched; onClose: () => void; onMeet: () => void }) {
  const [phase, setPhase] = useState<Phase>('drop')
  const [shownStars, setShownStars] = useState(0)
  const [step, setStep] = useState(0)
  const stars = starsOf(hatched.def, FIRST_NODE_ID)
  const big = hatched.rarity === 'superRare'
  const steps = STEPS[hatched.rarity] ?? ['normal']
  const glow = steps[Math.min(step, steps.length - 1)]

  useEffect(() => {
    if (phase === 'drop') {
      const t = setTimeout(() => setPhase('shake'), DROP_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'shake') {
      const t = setTimeout(() => setPhase('promote'), SHAKE_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'promote') {
      // 1段ずつ色が上がる。上がるたびに震える
      if (step < steps.length - 1) {
        const t = setTimeout(() => {
          setStep(step + 1)
          navigator.vibrate?.(step + 1 === 2 ? [80, 40, 80, 40, 240] : 90)
        }, PROMOTE_STEP_MS)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setPhase('flash'), PROMOTE_STEP_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'flash') {
      navigator.vibrate?.(big ? [60, 40, 60, 40, 200] : 60)
      const t = setTimeout(() => setPhase('stars'), FLASH_MS)
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
  }, [phase, shownStars, stars, step, steps.length, big])

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
      <div className={`beat-overlay hatch-overlay glow-${glow} phase-${phase}`} onClick={skip}>
        {(phase === 'promote' || phase === 'flash' || phase === 'stars') && <div className="hatch-rays" />}
        <div className="beat-text">
          {phase === 'promote' && step > 0 && (
            <div key={step} className={`hatch-cutin step-${step}`}>
              {step === 1 ? 'チャンス！' : '激アツ！！'}
            </div>
          )}
          <div className={`hatch-egg${phase === 'drop' ? ' dropping' : phase === 'shake' ? ' shaking' : phase === 'promote' ? ' charging' : ' cracked'}`}>🥚</div>
          {phase !== 'drop' && phase !== 'shake' && <div key={glow} className="hatch-glow" />}
          {phase === 'flash' && <div className="hatch-flash" />}
          {phase === 'flash' && <div className="hatch-ring" />}
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
    <div className={`beat-overlay hatch-done glow-${hatched.rarity}${big ? ' clear-overlay' : ''}`} onClick={onClose}>
      <div className="beat-burst" />
      {hatched.rarity !== 'normal' && Array.from({ length: big ? 30 : 16 }, (_, i) => <i key={`c${i}`} className="confetti" style={{ ['--i' as string]: i }} />)}
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
        <div className="hatch-monster">
          <MonsterImage imageId={imageOf(hatched.def, FIRST_NODE_ID)} awaken={awakenOf(hatched.def, FIRST_NODE_ID)} glow={glowOf(hatched.def)} size={180} shiny={hatched.shiny} />
        </div>
        <div className="beat-title">{monsterName(hatched.def, FIRST_NODE_ID)}</div>
        <div className="beat-sub">が生まれた！</div>
        {hatched.rarity !== 'normal' && <FitHint def={hatched.def} />}
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
