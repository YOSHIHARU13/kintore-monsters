import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { SLOTS, exerciseOfSlot } from '../data/exercises'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { QuestBanner } from '../components/QuestBanner'
import { bannerNodeOf } from '../components/GachaBanner'
import { questHits, type Member } from '../lib/quest'
import type { Go } from '../nav'
import { plusName } from '../types'

/** クエストのタブ：今週の挑戦と、クエストの一覧 */
export function Quests({ go }: { go: Go }) {
  const { state, quests, defs, owned, menu, week, weekSets, weekCheckins, quitChallenge, claimQuest } = useStore()
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [got, setGot] = useState<string | null>(null)

  const c = state.challenge?.week === week ? state.challenge : null
  const quest = c && quests.find((q) => q.id === c.questId)
  const boss = quest && defs.find((d) => d.id === quest.bossDefId)
  const party: Member[] = (c?.party ?? []).flatMap((id) => {
    const mon = owned.find((o) => o.id === id)
    const def = mon && defs.find((d) => d.id === mon.defId)
    return mon && def ? [{ mon, def }] : []
  })
  const exerciseName = (slotId: string) => {
    const slot = SLOTS.find((s) => s.id === slotId)
    return slot ? exerciseOfSlot(slot, menu).name : '？'
  }
  const hits =
    c && quest
      ? questHits(
          quest,
          party,
          weekSets.filter((s) => s.ts >= c.startTs),
          weekCheckins.filter((k) => k.ts >= c.startTs),
          exerciseName,
        )
      : []
  const damage = hits.reduce((sum, h) => sum + h.damage, 0)
  const hp = c && quest ? quest.hp[c.difficulty] : 0
  const defeated = !!quest && damage >= hp

  return (
    <div className="page">
      <h1 className="title">クエスト</h1>

      {c && quest ? (
        <section className="card">
          <h2>
            今週の挑戦：{quest.name}（{CONFIG.quest.difficulties[c.difficulty].label}）
          </h2>
          {boss && (
            <div className="monster-row">
              <MonsterImage imageId={boss.images[bannerNodeOf(boss)]} size={72} silhouette={!defeated && !c.cleared} />
              <div className="goal-body">
                <strong>{c.cleared ? '討伐済み！' : defeated ? '討伐できる！' : `のこりHP ${(hp - damage).toLocaleString()}`}</strong>
                <Gauge value={Math.max(0, hp - damage)} max={hp} color="#ef476f" />
                <span className="muted small">
                  与えたダメージ {damage.toLocaleString()} ／ HP {hp.toLocaleString()}
                </span>
              </div>
            </div>
          )}
          {!c.cleared && defeated && (
            <button
              className="btn primary wide"
              onClick={() => {
                const id = claimQuest()
                if (id) setGot(id)
              }}
            >
              報酬を受け取る（{boss?.name}＋{CONFIG.quest.difficulties[c.difficulty].plus}・
              {CONFIG.quest.difficulties[c.difficulty].gold}G）
            </button>
          )}
          {got && (
            <button className="btn wide" onClick={() => go({ name: 'monster', id: got })}>
              手に入れた{boss?.name}に会いに行く
            </button>
          )}
          <div className="party-row">
            {party.map((m) => (
              <span key={m.mon.id} title={plusName(m.def, m.mon)}>
                <MonsterImage imageId={m.def.images[m.mon.nodeId]} size={40} plus={m.mon.plus} shiny={m.mon.shiny} />
              </span>
            ))}
          </div>
          <details>
            <summary className="small">攻撃の記録（{hits.length}回）</summary>
            <ul className="mini-list">
              {[...hits].reverse().map((h, i) => (
                <li key={i}>
                  <span>
                    {h.label}
                    {h.notes.length > 0 && <span className="muted small">（{h.notes.join('・')}）</span>}
                  </span>
                  <span className="tag beat">{h.damage.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </details>
          <p className="muted small">
            挑戦を始めてからの筋トレ・ローラー・朝の記録（歩数・習慣）が、そのままダメージになります。月曜にリセット。
          </p>
          {!c.cleared && (
            <button
              className="btn ghost wide"
              onClick={() => {
                if (!confirmQuit) return setConfirmQuit(true)
                quitChallenge()
                setConfirmQuit(false)
              }}
            >
              {confirmQuit ? '本当にやめる（与えたダメージは消えます）' : 'この挑戦をやめる'}
            </button>
          )}
        </section>
      ) : (
        <p className="muted">今週はまだ挑戦していません。下のクエストから選んでください。</p>
      )}

      <section className="card">
        <h2>クエスト一覧</h2>
        {quests.length === 0 && <p className="muted small">まだクエストがありません。</p>}
        <div className="gacha-list">
          {quests.map((q) => (
            <QuestBanner
              key={q.id}
              quest={q}
              boss={defs.find((d) => d.id === q.bossDefId)}
              selected={q.id === c?.questId}
              onClick={() => go({ name: 'quest', id: q.id })}
            />
          ))}
        </div>
        <button className="btn small" onClick={() => go({ name: 'questForm' })}>
          ＋ クエストを作る
        </button>
      </section>
    </div>
  )
}

