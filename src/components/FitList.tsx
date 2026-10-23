import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { FIT_MARK, fitMembers, fitQuests } from '../lib/fit'
import { gradeOf } from '../lib/quest'
import { awakenOf, glowOf, imageOf } from '../lib/art'
import { bannerNodeOf } from './GachaBanner'
import { MonsterImage } from './MonsterImage'
import type { Go } from '../nav'
import type { MonsterDef, Quest } from '../types'

/** その子が適正のクエスト（閉じた欄。タップで開く） */
export function FitQuests({ def, go, limit }: { def: MonsterDef; go?: Go; limit?: number }) {
  const { quests, castle } = useStore()
  const list = fitQuests(def, [...quests, ...castle.map((f) => f.quest)]).slice(0, limit ?? 99)
  if (list.length === 0) return null
  return (
    <details className="card fold fit-list">
      <summary>
        <h2>
          🎯 適正のクエスト <span className="small">◎{list.filter((x) => x.fit === 'best').length}・○{list.filter((x) => x.fit === 'good').length}</span>
        </h2>
      </summary>
      <ul className="mini-list">
        {list.map(({ quest, fit }) => (
          <li key={quest.id}>
            <button className="link-button" onClick={() => go?.({ name: 'quest', id: quest.id })}>
              {FIT_MARK[fit]} <span className={`grade-badge grade-${gradeOf(quest)}`}>{CONFIG.quest.grades[gradeOf(quest)].label}</span> {quest.name}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** 引いた直後などに出す、刺さるクエストの短い一覧（上位3つ） */
export function FitHint({ def }: { def: MonsterDef }) {
  const { quests, castle } = useStore()
  const list = fitQuests(def, [...quests, ...castle.map((f) => f.quest)]).slice(0, 3)
  if (list.length === 0) return null
  return (
    <div className="fit-hint small">
      🎯 刺さる：{list.map(({ quest, fit }) => `${FIT_MARK[fit]}${CONFIG.quest.grades[gradeOf(quest)].label}「${quest.name}」`).join('・')}
    </div>
  )
}

/** そのクエストの適正キャラ（上位5体。持っていない子はシルエット） */
export function FitMembers({ quest }: { quest: Quest }) {
  const { defs, owned } = useStore()
  const list = fitMembers(quest, defs).slice(0, 5)
  if (list.length === 0) return null
  // 持っていない子も名前は出す（ガチャで当てる目標になるように）。絵だけ黒くする
  const has = (d: MonsterDef) => owned.some((o) => o.defId === d.id)
  return (
    <details className="card fold fit-list">
      <summary>
        <h2>🎯 適正キャラ（上位{list.length}体）</h2>
      </summary>
      <div className="fit-members">
        {list.map(({ def, fit }) => (
          <span key={def.id} className="fit-member">
            <MonsterImage imageId={imageOf(def, bannerNodeOf(def))} awaken={awakenOf(def, bannerNodeOf(def))} glow={glowOf(def)} size={48} silhouette={!has(def)} />
            <span className="small">
              {FIT_MARK[fit]} {def.name}
              {!has(def) && <span className="muted">（未所持）</span>}
            </span>
          </span>
        ))}
      </div>
    </details>
  )
}

/** ガチャのピックアップに付ける、適正の数のバッジ */
export function FitBadge({ def }: { def: MonsterDef }) {
  const { quests, castle } = useStore()
  const n = fitQuests(def, [...quests, ...castle.map((f) => f.quest)]).filter((x) => x.fit === 'best').length
  return n > 0 ? <span className="fit-badge">適正{n}</span> : null
}
