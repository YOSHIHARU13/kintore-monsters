import { CONFIG } from '../config/gameConfig'
import { awakenOf, imageOf } from '../lib/art'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { RARITY_KEYS, rarityOf } from '../lib/gacha'
import { MonsterImage } from './MonsterImage'
import { monsterName } from '../types'
import type { HatchResult } from '../store'

/** まとめて引いた結果。1体ずつポンと出て、いちばんレアなものが光る */
export function MultiReveal({ results, onClose, onMeet }: {
  results: HatchResult[]
  onClose: () => void
  onMeet: (monsterId: string) => void
}) {
  const best = Math.max(...results.map((r) => RARITY_KEYS.indexOf(rarityOf(r.def))))
  const big = best === RARITY_KEYS.indexOf('superRare') || results.some((r) => r.shiny)
  return (
    <div className={`beat-overlay${big ? ' clear-overlay' : ''}`} onClick={onClose}>
      <div className="beat-burst" />
      {big && <div className="beat-burst reverse" />}
      <div className="beat-text multi-reveal">
        <div className="beat-title">{results.length}連の結果</div>
        <div className="multi-grid">
          {results.map((r, i) => {
            const rarity = rarityOf(r.def)
            return (
              <button
                key={r.monsterId}
                className={`multi-cell rarity-${rarity}${r.shiny ? ' shiny-cell' : ''}`}
                style={{ animationDelay: `${i * 0.12}s` }}
                onClick={(e) => {
                  e.stopPropagation()
                  onMeet(r.monsterId)
                }}
              >
                <MonsterImage imageId={imageOf(r.def, FIRST_NODE_ID)} awaken={awakenOf(r.def, FIRST_NODE_ID)} size={56} shiny={r.shiny} />
                <span className="pickup-name">{monsterName(r.def, FIRST_NODE_ID)}</span>
                <span className={`small rarity-${rarity}`}>
                  {CONFIG.gacha.rarities[rarity].label}
                  {r.pity && '・確定'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="muted small">タップで閉じる・モンスターを押すと会いに行く</div>
      </div>
    </div>
  )
}
