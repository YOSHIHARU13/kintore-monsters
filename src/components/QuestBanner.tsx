import { CONFIG } from '../config/gameConfig'
import { FORM_ATTR_LABEL } from '../data/exercises'
import { MonsterImage } from './MonsterImage'
import { bannerNodeOf } from './GachaBanner'
import type { MonsterDef, Quest } from '../types'

/** クエストのバナー：テーマ色の背景に、ボスの最終形態と名前を出す */
export function QuestBanner({ quest, boss, onClick, selected = false }: {
  quest: Quest
  boss: MonsterDef | undefined
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <button type="button" className={`gacha-banner auto quest-banner theme-${quest.theme}${selected ? ' on' : ''}`} onClick={onClick}>
      <span className="auto-rays" aria-hidden="true" />
      <span className="auto-monsters">
        {boss && (
          <span className="auto-monster m0">
            <MonsterImage imageId={boss.images[bannerNodeOf(boss)]} size={110} />
          </span>
        )}
      </span>
      <span className="auto-text">
        <span className="auto-badge">⚔️ クエスト・{FORM_ATTR_LABEL[quest.attr]}属性</span>
        <strong className="auto-title">{quest.name}</strong>
        {quest.catchphrase && <span className="auto-catch">{quest.catchphrase}</span>}
        <span className="small">
          {CONFIG.quest.difficulties.easy.label}〜{CONFIG.quest.difficulties.hard.label}・ドロップ ＋0〜＋
          {CONFIG.quest.difficulties.hard.plus}
        </span>
      </span>
    </button>
  )
}
