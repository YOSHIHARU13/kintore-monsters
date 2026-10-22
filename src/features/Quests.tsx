import { useState } from 'react'
import { useStore } from '../store'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { QuestBanner } from '../components/QuestBanner'
import { bannerNodeOf } from '../components/GachaBanner'
import { useBattle } from '../components/BattleBar'
import { dropPlus, gradeOf, questGold, questLevelLabel } from '../lib/quest'

const VIEW_KEY = 'questListView'

/** クエスト一覧の見出し：格の高い順、最後に素材 */
const QUEST_GROUPS = [
  { key: 'chozetsu', label: '超絶' },
  { key: 'kyukyoku', label: '究極' },
  { key: 'kiwami', label: '極' },
  { key: 'material', label: '素材' },
] as const
import { formationOf, requirementsOf } from '../lib/formation'
import { luckBonus } from '../lib/fusion'
import { ELEMENT_COLOR } from '../lib/element'
import { CONFIG } from '../config/gameConfig'
import { CORE_LABEL } from '../lib/cores'
import { towerCleared, towerMonth } from '../lib/tower'
import { towerRewardText } from './Tower'
import { boosterName } from '../lib/boosters'
import type { QuestReward } from '../store'
import type { Go } from '../nav'
import { plusName, type MonsterDef } from '../types'

/** クエストのタブ：今日の戦いと、クエストの一覧 */
export function Quests({ go }: { go: Go }) {
  const { state, quests, tower, defs, today, quitChallenge, claimQuest } = useStore()
  const towerDone = towerCleared(state, towerMonth(today))
  const battle = useBattle()
  const towerFloor = battle ? tower.find((f) => f.quest.id === battle.quest.id) : undefined
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [view, setView] = useState<'icon' | 'banner'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'banner' ? 'banner' : 'icon'
    } catch {
      return 'icon'
    }
  })
  const changeView = (v: 'icon' | 'banner') => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // 保存できなくても切り替えはできる
    }
  }
  const [got, setGot] = useState<(QuestReward & { boss: MonsterDef | undefined; plus: number }) | null>(null)
  // 出撃した日のうちに倒せなかった戦い
  const expired =
    state.challenge && state.challenge.date !== today
      ? [...quests, ...tower.map((f) => f.quest)].find((q) => q.id === state.challenge!.questId)
      : null

  return (
    <div className="page">
      <h1 className="title">クエスト</h1>

      {got && (
        <section className="card center">
          <h2>
            {got.towerFloor ? `試練の塔 ${got.towerFloor}階 突破！` : '討伐成功！'} +{got.gold}G
          </h2>
          {got.boosted && <p className="tag keep">⚔️ 討伐ブースターで報酬2倍！</p>}
          {got.eggs > 0 && <p>🥚 卵 ×{got.eggs} を手に入れた！</p>}
          {got.booster && (
            <p>{boosterName(state, got.booster)} を手に入れた！</p>
          )}
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
            !got.monsterId &&
            !got.towerFloor && (
              <p className="muted">今回は核が落ちなかった…（続けて落ちないと、そのうち確定で落ちます）</p>
            )
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
            戦闘中：{battle.quest.name}（{questLevelLabel(battle.quest, battle.challenge.difficulty)}）
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
                {luckBonus(battle.party.map((m) => m.mon)).count > 0 &&
                  `・運極ボーナス 報酬G×${luckBonus(battle.party.map((m) => m.mon)).goldRate.toFixed(1)}`}
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
                  const def = defs.find((d) => d.id === reward.defId)
                  setGot({
                    ...reward,
                    boss: def,
                    plus: reward.towerFloor ? 0 : dropPlus(battle.quest),
                  })
                }
              }}
            >
              報酬を受け取る（
              {towerFloor
                ? towerRewardText(towerFloor, defs, state)
                : battle.quest.kind === 'material'
                  ? `${CORE_LABEL[battle.quest.attr]}のチャンス`
                  : `${battle.boss?.name}${dropPlus(battle.quest) > 0 ? `＋${dropPlus(battle.quest)}` : ''}`}
              {!towerFloor && `・${questGold(battle.quest, battle.challenge.difficulty)}G`}）
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

      <button className="card tower-entry" onClick={() => go({ name: 'tower' })}>
        <span style={{ fontSize: '2rem' }}>🗼</span>
        <span className="tower-body">
          <strong>試練の塔</strong>
          <span className="small muted">
            {towerDone >= CONFIG.tower.floors
              ? '今月は踏破！来月また新しい塔が出ます'
              : `${towerDone}／${CONFIG.tower.floors}階・次は${towerDone + 1}階（5階・10階で塔限定モンスター）`}
          </span>
        </span>
        <span>›</span>
      </button>

      <section className="card">
        <div className="part-head">
          <h2>クエスト一覧</h2>
          <div className="segmented small-seg" role="tablist" aria-label="表示">
            <button className={view === 'icon' ? 'on' : ''} onClick={() => changeView('icon')}>
              アイコン
            </button>
            <button className={view === 'banner' ? 'on' : ''} onClick={() => changeView('banner')}>
              バナー
            </button>
          </div>
        </div>
        {quests.length === 0 && <p className="muted small">まだクエストがありません。</p>}
        {QUEST_GROUPS.map(({ key, label }) => {
          const group = quests.filter((q) => (q.kind === 'material' ? 'material' : gradeOf(q)) === key)
          if (group.length === 0) return null
          return (
            <div key={key} className="quest-group">
              <h3 className={`quest-group-head head-${key}`}>
                {label}
                <span className="small">
                  {' '}
                  {group.filter((q) => (state.clearedQuests[q.id] ?? 0) > 0).length}/{group.length}
                </span>
              </h3>
              {view === 'icon' ? (
                <div className="quest-icons">
                  {group.map((q) => {
                    const boss = defs.find((d) => d.id === q.bossDefId)
                    const cleared = (state.clearedQuests[q.id] ?? 0) > 0
                    return (
                      <button
                        key={q.id}
                        className={`quest-icon frame-${key}${q.id === battle?.quest.id ? ' on' : ''}`}
                        onClick={() => go({ name: 'quest', id: q.id })}
                        aria-label={q.name}
                      >
                        {boss && <MonsterImage imageId={boss.images[bannerNodeOf(boss)]} size={56} />}
                        {cleared && <span className="quest-cleared">✓</span>}
                        {q.element && (
                          <span className="quest-element" style={{ background: ELEMENT_COLOR[q.element] }}>
                            {CONFIG.formation.elementIcon[q.element]}
                          </span>
                        )}
                        <span className="quest-icon-name">{q.name}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="gacha-list">
                  {group.map((q) => (
                    <QuestBanner
                      key={q.id}
                      quest={q}
                      boss={defs.find((d) => d.id === q.bossDefId)}
                      selected={q.id === battle?.quest.id}
                      onClick={() => go({ name: 'quest', id: q.id })}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <button className="btn small" onClick={() => go({ name: 'questForm' })}>
          ＋ クエストを作る
        </button>
      </section>
    </div>
  )
}
