import { CONFIG } from '../config/gameConfig'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { MonsterImage } from './MonsterImage'
import { bannerNodeOf } from './GachaBanner'
import { DROP_ICON, dropLabel, dropOf } from '../lib/cores'
import { requirementsOf, tagLabel } from '../lib/formation'
import { difficultyLabel, dropPlus, gradeOf, levelsOf } from '../lib/quest'
import { allGimmicks } from '../lib/gimmick'
import { useStore } from '../store'
import type { MonsterDef, Quest } from '../types'

/** バナーの色：求められる編成の最初の属性の色（属性の条件がなければ金） */
function questTone(quest: Quest): string {
  if (quest.element) return `tone-${quest.element}`
  const el = requirementsOf(quest).find((r) => r.tag.startsWith('el:'))
  return el ? `tone-${el.tag.slice(3)}` : 'tone-gold'
}

/** クエストのバナー：求める属性の色の背景に、ボスの最終形態と名前を出す */
export function QuestBanner({ quest, boss, onClick, selected = false, reward }: {
  quest: Quest
  boss: MonsterDef | undefined
  onClick?: () => void
  selected?: boolean
  reward?: string // 高難度の階の報酬（ふつうのクエストの「ボスがドロップ・🔮」の代わりに出す）
}) {
  const { quests } = useStore()
  const names = allGimmicks(quests)
  return (
    <button
      type="button"
      className={`gacha-banner auto quest-banner ${questTone(quest)} frame-${quest.kind === 'material' ? 'material' : gradeOf(quest)}${selected ? ' on' : ''}`}
      onClick={onClick}
    >
      <span className="grade-ribbon">{quest.kind === 'material' ? '素材' : CONFIG.quest.grades[gradeOf(quest)].label}</span>
      <span className="auto-rays" aria-hidden="true" />
      <span className="auto-monsters">
        {boss && (
          <span className="auto-monster m0">
            <MonsterImage imageId={imageOf(boss, bannerNodeOf(boss))} awaken={awakenOf(boss, bannerNodeOf(boss))} glow={glowOf(boss)} size={110} />
          </span>
        )}
      </span>
      <span className="auto-text">
        <span className="auto-badge">
          {quest.kind === 'material' ? `${DROP_ICON[dropOf(quest)]} 素材・${dropLabel(quest)}` : `⚔️ ${CONFIG.quest.grades[gradeOf(quest)].label}`}
        </span>
        <strong className="auto-title">{quest.name}</strong>
        {quest.catchphrase && <span className="auto-catch">{quest.catchphrase}</span>}
        {requirementsOf(quest).length > 0 && (
          <span className="small">
            求む：{requirementsOf(quest).map((r) => `${tagLabel(r.tag, names)}${r.count}`).join(' ')}
          </span>
        )}
        <span className="small">
          {reward
            ? `報酬：${reward}`
            : quest.kind === 'material'
            ? `${levelsOf(quest).map((d) => difficultyLabel(quest, d)).join('・')}・${dropLabel(quest)}が落ちる（数はくじで決まる）`
            : `ボス${dropPlus(quest) > 0 ? `＋${dropPlus(quest)}` : ''}がドロップ・🔮${CONFIG.quest.grades[gradeOf(quest)].gold}`}
        </span>
      </span>
    </button>
  )
}
