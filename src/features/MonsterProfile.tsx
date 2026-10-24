import { useMemo } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from '../components/MonsterImage'
import { ElementBadge } from '../components/ElementBadge'
import { Abilities } from '../components/Abilities'
import { Stars } from '../components/Stars'
import { bannerNodeOf } from '../components/GachaBanner'
import { awakenOf, glowOf, imageOf } from '../lib/art'
import { fitMembers, isStandIn } from '../lib/fit'
import { grown } from '../lib/lifespan'
import { gradeOf } from '../lib/quest'
import { rarityOf } from '../lib/gacha'
import type { Go } from '../nav'
import type { Quest } from '../types'

const HARD = ['chozetsu', 'chokyukyoku', 'bakuzetsu']

/**
 * モンスターのプロフィール（ガチャのピックアップから）：育ちきった姿と、どのクエストでどれだけ活躍できるか。
 * 超絶以上と高難度（塔・禁筋・孤城）の、適正度と順位（登録しているモンスターの中で何位か）を高い順に
 */
export function MonsterProfile({ defId, go }: { defId: string; go: Go }) {
  const { defs, owned, quests, tower, kinkin, castle } = useStore()
  const def = defs.find((d) => d.id === defId)
  const rows = useMemo(() => {
    if (!def) return []
    const targets: Quest[] = [...quests.filter((q) => q.kind !== 'material' && HARD.includes(gradeOf(q))), ...[...tower, ...kinkin, ...castle].map((f) => f.quest)]
    // 代役以上（属性が合って、アビリティが2つ以上合う）の階だけ。育ちきった姿（金の獣神化なら2体ぶんのアビリティ）で見る
    const top = grown(def, def.attr).def
    return targets
      .filter((quest) => isStandIn(grown(def, quest.attr).def, quest) || isStandIn(top, quest))
      .flatMap((quest) => {
        const list = fitMembers(quest, defs)
        const i = list.findIndex((x) => x.def.id === defId)
        return i < 0 ? [] : [{ quest, percent: list[i].percent, rank: i + 1 }]
      })
      .sort((a, b) => b.percent - a.percent || a.rank - b.rank)
  }, [def, defs, defId, quests, tower, kinkin, castle])
  if (!def) return null
  const node = bannerNodeOf(def)
  const has = owned.some((o) => o.defId === def.id)
  const top = grown(def, def.attr).def
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'shop' })}>
        ← ガチャに戻る
      </button>
      <section className="card center">
        <MonsterImage imageId={imageOf(def, node)} awaken={awakenOf(def, node)} glow={glowOf(def)} size={180} />
        <h1 className="title">{def.name}</h1>
        <Stars def={def} nodeId={node} />
        <span className="row wrap center">
          <ElementBadge def={def} />
          <span className="small">{CONFIG.gacha.rarities[rarityOf(def)].label}</span>
          {!has && <span className="small muted">未所持</span>}
        </span>
        <Abilities def={top} />
      </section>
      <section className="card">
        <h2>🎯 活躍できるクエスト（{rows.length}）</h2>
        <p className="muted small">
          育ちきったときの適正度（このクエストのためにいるような激レアを100%）と、登録しているモンスターの中での順位。超絶以上と高難度で、代役以上（属性が合って、アビリティが2つ以上合う）のところだけ。90%以上はド適正。
        </p>
        {rows.length === 0 ? (
          <p className="muted small">今は、ド適正のクエストはありません。</p>
        ) : (
          <ul className="mini-list">
            {rows.map((r) => (
              <li key={r.quest.id}>
                <button className="link-button" onClick={() => go({ name: 'quest', id: r.quest.id })}>
                  <span className={`grade-badge grade-${gradeOf(r.quest)}`}>{CONFIG.quest.grades[gradeOf(r.quest)].label}</span> {r.quest.name}
                </button>
                <span className={`tag${r.percent >= 90 ? ' keep' : ''}`}>
                  {r.percent}%・{r.rank}位
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
