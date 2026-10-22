import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from './MonsterImage'
import { bannerNodeOf } from './GachaBanner'
import { CORE_LABEL } from '../lib/cores'
import { requirementsOf, tagLabel } from '../lib/formation'
import { allGimmicks } from '../lib/gimmick'
import { useStore } from '../store'
import type { MonsterDef, Quest } from '../types'

/** クエストのバナー：テーマ色の背景に、ボスの最終形態と名前を出す */
export function QuestBanner({ quest, boss, onClick, selected = false }: {
  quest: Quest
  boss: MonsterDef | undefined
  onClick?: () => void
  selected?: boolean
}) {
  const { quests } = useStore()
  const names = allGimmicks(quests)
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
        <span className="auto-badge">
          {quest.kind === 'material' ? `💎 素材・${CORE_LABEL[quest.attr]}` : '⚔️ クエスト'}
        </span>
        <strong className="auto-title">{quest.name}</strong>
        {quest.catchphrase && <span className="auto-catch">{quest.catchphrase}</span>}
        {requirementsOf(quest).length > 0 && (
          <span className="small">
            求む：{requirementsOf(quest).map((r) => `${tagLabel(r.tag, names)}${r.count}`).join(' ')}
          </span>
        )}
        <span className="small">
          {quest.kind === 'material'
            ? `${CONFIG.quest.difficulties.easy.label}〜${CONFIG.quest.difficulties.hard.label}・核が落ちる（毎回ではない）`
            : `${CONFIG.quest.difficulties.easy.label}〜${CONFIG.quest.difficulties.hard.label}・ドロップ ＋0〜＋${CONFIG.quest.difficulties.hard.plus}`}
        </span>
      </span>
    </button>
  )
}
