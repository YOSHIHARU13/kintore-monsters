import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { QuestBanner } from '../components/QuestBanner'
import { bannerNodeOf } from '../components/GachaBanner'
import { useBattle } from '../components/BattleBar'
import { questGold } from '../lib/quest'
import { formationOf, requirementsOf } from '../lib/formation'
import { CORE_LABEL } from '../lib/cores'
import type { QuestReward } from '../store'
import type { Go } from '../nav'
import { plusName, type MonsterDef } from '../types'

/** クエストのタブ：今日の戦いと、クエストの一覧 */
export function Quests({ go }: { go: Go }) {
  const { state, quests, defs, today, quitChallenge, claimQuest } = useStore()
  const battle = useBattle()
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [got, setGot] = useState<(QuestReward & { boss: MonsterDef | undefined; plus: number }) | null>(null)
  // 出撃した日のうちに倒せなかった戦い
  const expired = state.challenge && state.challenge.date !== today ? quests.find((q) => q.id === state.challenge!.questId) : null

  return (
    <div className="page">
      <h1 className="title">クエスト</h1>

      {got && (
        <section className="card center">
          <h2>討伐成功！ +{got.gold}G</h2>
          {got.monsterId && got.boss && (
            <>
              <MonsterImage imageId={got.boss.images[bannerNodeOf(got.boss)]} size={140} plus={got.plus} />
              <p>
                {got.boss.name}
                {got.plus > 0 ? `＋${got.plus}` : ''} を手に入れた！
              </p>
            </>
          )}
          {got.cores > 0 ? (
            <p className="core-drop">
              💎 {CORE_LABEL[got.coreKey]} ×{got.cores} がドロップ！{got.corePity ? '（確定ドロップ）' : ''}
            </p>
          ) : (
            !got.monsterId && <p className="muted">今回は核が落ちなかった…（続けて落ちないと、そのうち確定で落ちます）</p>
          )}
          {got.monsterId && (
            <button className="btn primary wide" onClick={() => go({ name: 'monster', id: got.monsterId! })}>
              会いに行く
            </button>
          )}
        </section>
      )}

      {battle ? (
        <section className="card">
          <h2>
            戦闘中：{battle.quest.name}（{CONFIG.quest.difficulties[battle.challenge.difficulty].label}）
          </h2>
          <div className="monster-row">
            {battle.boss && (
              <MonsterImage imageId={battle.boss.images[bannerNodeOf(battle.boss)]} size={72} silhouette={!battle.defeated} />
            )}
            <div className="goal-body">
              <strong>
                {battle.defeated ? '討伐できる！' : `のこりHP ${(battle.hp - battle.damage).toLocaleString()}`}
              </strong>
              <Gauge value={Math.max(0, battle.hp - battle.damage)} max={battle.hp} color="#ef476f" />
              <span className="muted small">
                与えたダメージ {battle.damage.toLocaleString()} ／ HP {battle.hp.toLocaleString()}・編成倍率 ×
                {formationOf(
                  battle.party.map((m) => m.def),
                  requirementsOf(battle.quest),
                ).rate.toFixed(2)}
                ・今日中に倒そう
              </span>
            </div>
          </div>
          {battle.defeated ? (
            <button
              className="btn primary wide"
              onClick={() => {
                const reward = claimQuest()
                if (reward) {
                  setGot({ ...reward, boss: battle.boss, plus: CONFIG.quest.difficulties[battle.challenge.difficulty].plus })
                }
              }}
            >
              報酬を受け取る（
              {battle.quest.kind === 'material'
                ? `${CORE_LABEL[battle.quest.attr]}のチャンス`
                : `${battle.boss?.name}＋${CONFIG.quest.difficulties[battle.challenge.difficulty].plus}`}
              ・{questGold(battle.quest, battle.challenge.difficulty)}G）
            </button>
          ) : (
            <button className="btn primary wide" onClick={() => go({ name: 'training' })}>
              トレーニングで攻撃する
            </button>
          )}
          <div className="party-row">
            {battle.party.map((m) => (
              <span key={m.mon.id} title={plusName(m.def, m.mon)}>
                <MonsterImage imageId={m.def.images[m.mon.nodeId]} size={40} plus={m.mon.plus} shiny={m.mon.shiny} />
              </span>
            ))}
          </div>
          <details>
            <summary className="small">攻撃の記録（{battle.hits.length}回）</summary>
            <ul className="mini-list">
              {[...battle.hits].reverse().map((h, i) => (
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
            出撃してからの筋トレとローラーが、そのままダメージになります（報酬が出るセットだけ）。日付が変わると失敗です。
          </p>
          <button
            className="btn ghost wide"
            onClick={() => {
              if (!confirmQuit) return setConfirmQuit(true)
              quitChallenge()
              setConfirmQuit(false)
            }}
          >
            {confirmQuit ? '本当に撤退する' : '撤退する'}
          </button>
        </section>
      ) : (
        !got && (
          <p className="muted">
            {expired ? `「${expired.name}」は時間切れでした。` : ''}
            クエストを選んで出撃すると、そのあとのトレーニングがそのまま攻撃になります。何回でも挑戦できます。
          </p>
        )
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
              selected={q.id === battle?.quest.id}
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
