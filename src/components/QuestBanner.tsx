import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from './MonsterImage'
import { bannerNodeOf } from './GachaBanner'
import { CORE_LABEL } from '../lib/cores'
import { requirementsOf, tagLabel } from '../lib/formation'
import { dropPlus, gradeOf } from '../lib/quest'
import { allGimmicks } from '../lib/gimmick'
import { useStore } from '../store'
import type { MonsterDef, Quest } from '../types'

/** バナーの色：求められる編成の最初の属性の色（属性の条件がなければ金） */
function questTone(quest: Quest): string {
  const el = requirementsOf(quest).find((r) => r.tag.startsWith('el:'))
  return el ? `tone-${el.tag.slice(3)}` : 'tone-gold'
}

/** クエストのバナー：求める属性の色の背景に、ボスの最終形態と名前を出す */
export function QuestBanner({ quest, boss, onClick, selected = false }: {
  quest: Quest
  boss: MonsterDef | undefined
  onClick?: () => void
  selected?: boolean
}) {
  const { quests } = useStore()
  const names = allGimmicks(quests)
  return (
    <button type="button" className={`gacha-banner auto quest-banner ${questTone(quest)}${selected ? ' on' : ''}`} onClick={onClick}>
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
          {quest.kind === 'material' ? `💎 素材・${CORE_LABEL[quest.attr]}` : `⚔️ ${CONFIG.quest.grades[gradeOf(quest)].label}`}
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
            : `ボス${dropPlus(quest) > 0 ? `＋${dropPlus(quest)}` : ''}がドロップ・${CONFIG.quest.grades[gradeOf(quest)].gold}G`}
        </span>
      </span>
    </button>
  )
}
