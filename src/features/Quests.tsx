import { useState } from 'react'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { useStore } from '../store'
import { SeriesChips } from '../components/SeriesChips'
import { allSeries, inSeries, questSeries, seriesStatus, statusLabel, type SeriesFilter } from '../lib/series'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { QuestBanner } from '../components/QuestBanner'
import { bannerNodeOf } from '../components/GachaBanner'
import { useBattle } from '../components/BattleBar'
import { defaultBossHp, dropPlus, gradeOf, questGold, questLevelLabel } from '../lib/quest'

const VIEW_KEY = 'questListView'

/** クエスト一覧の見出し：格の高い順、最後に素材 */
const QUEST_GROUPS = [
  { key: 'chokyukyoku', label: '超究極' },
  { key: 'chozetsu', label: '超絶' },
  { key: 'kyukyoku', label: '究極' },
  { key: 'kiwami', label: '極' },
  { key: 'jokyu', label: '上級' },
  { key: 'material', label: '素材' },
  { key: 'archive', label: '📚 書庫（開催が終わったコラボ）' },
] as const
import { formationOf, requirementsOf } from '../lib/formation'
import { luckBonus } from '../lib/fusion'
import { ELEMENT_COLOR, elementInfo } from '../lib/element'
import { CONFIG } from '../config/gameConfig'
import { CORE_LABEL } from '../lib/cores'
import { towerCleared, towerMonth } from '../lib/tower'
import { autoGradeOf, autoQuestSetup } from '../lib/questAuto'
import { selectableGimmicks } from '../lib/gimmick'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { towerRewardText } from './Tower'
import { boosterName } from '../lib/boosters'
import type { QuestReward } from '../store'
import type { Go } from '../nav'
import { nodeAttr, plusName, type MonsterDef, type Quest } from '../types'

/** クエストのタブ：今日の戦いと、クエストの一覧 */
export function Quests({ go }: { go: Go }) {
  const { state, quests, tower, defs, today, seriesPeriods, quitChallenge, claimQuest, saveQuest } = useStore()
  const [made, setMade] = useState<number | null>(null)
  const [series, setSeries] = useState<SeriesFilter>('all')
  // まだボスクエストがない降臨モンスター（塔限定は塔でもらえるので除く）
  const pending = defs.filter(
    (d) => d.questOnly && !d.tower && !quests.some((q) => q.kind !== 'material' && q.bossDefId === d.id),
  )
  /** 降臨モンスター1体につき1つ、おまかせでボスクエストを作る（名前はボスの名前・格はレア度から） */
  const makeAll = () => {
    const gimmicks = selectableGimmicks(quests)
    const sofar: Pick<Quest, 'id' | 'requirements' | 'gimmicks'>[] = [...quests]
    for (const d of pending) {
      const grade = autoGradeOf(d)
      const r = autoQuestSetup(d, grade, 'boss', sofar, gimmicks, undefined, defs)
      const hp = defaultBossHp(grade)
      saveQuest({
        name: '',
        kind: 'boss',
        bossDefId: d.id,
        attr: nodeAttr(d, FIRST_NODE_ID),
        element: elementInfo(d).elements[0],
        weakSlots: r.weakSlots,
        requirements: r.requirements,
        customGimmicks: {},
        hp: { easy: hp, normal: hp, hard: hp },
        rank: 1,
        grade,
        catchphrase: '',
        theme: 'flame',
      })
      sofar.push({ id: `new-${d.id}`, requirements: r.requirements })
    }
    setMade(pending.length)
  }
  // ボスクエストの条件を、新しいおまかせ（タグの仲間・刺さるキャラ）で作り直す
  const [confirmRedo, setConfirmRedo] = useState(false)
  const topQuests = quests.filter((q) => !q.builtin && q.kind !== 'material')
  const redoTop = () => {
    const gimmicks = selectableGimmicks(quests)
    const sofar: Pick<Quest, 'id' | 'requirements' | 'gimmicks'>[] = quests.filter((q) => !topQuests.includes(q))
    for (const q of topQuests) {
      const boss = defs.find((d) => d.id === q.bossDefId)
      if (!boss) continue
      const r = autoQuestSetup(boss, gradeOf(q), 'boss', sofar, gimmicks, q.id, defs)
      const { id, createdAt: _c, autoName, builtin: _b, ...rest } = q
      saveQuest({ ...rest, id, name: autoName ? '' : q.name, requirements: r.requirements, weakSlots: r.weakSlots })
      sofar.push({ id, requirements: r.requirements })
    }
    setConfirmRedo(false)
    setMade(topQuests.length)
  }
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
            {got.towerFloor ? `試練の塔 ${got.towerFloor}階 突破！` : '討伐成功！'} +{got.gold}G・🪙{got.coins ?? 0}
          </h2>
          {got.boosted && <p className="tag keep">⚔️ 討伐ブースターで報酬2倍！</p>}
          {got.eggs > 0 && <p>🥚 卵 ×{got.eggs} を手に入れた！</p>}
          {got.booster && (
            <p>{boosterName(state, got.booster)} を手に入れた！</p>
          )}
          {got.monsterId && got.boss && (
            <>
              <MonsterImage imageId={imageOf(got.boss, bannerNodeOf(got.boss))} awaken={awakenOf(got.boss, bannerNodeOf(got.boss))} glow={glowOf(got.boss)} size={140} plus={got.plus} />
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
              <MonsterImage imageId={imageOf(battle.boss, bannerNodeOf(battle.boss))} awaken={awakenOf(battle.boss, bannerNodeOf(battle.boss))} glow={glowOf(battle.boss)} size={72} silhouette={!battle.defeated} />
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
                : battle.quest.drop === 'coins'
                  ? `🪙${CONFIG.coins.quest[battle.challenge.difficulty]}`
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
                <MonsterImage imageId={imageOf(m.def, m.mon.nodeId)} awaken={awakenOf(m.def, m.mon.nodeId)} glow={glowOf(m.def)} size={40} plus={m.mon.plus} shiny={m.mon.shiny} />
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
        <SeriesChips value={series} onChange={setSeries} />
        {allSeries(defs)
          .map((name) => ({ name, st: seriesStatus(name, seriesPeriods, today) }))
          .filter(({ st }) => st.kind === 'active' || st.kind === 'upcoming')
          .map(({ name, st }) => (
            <button key={name} className={`collab-now${st.kind === 'active' ? ' on' : ''}`} onClick={() => setSeries(name)}>
              ⏳ {name}：{statusLabel(st)}
            </button>
          ))}
        {quests.length === 0 && <p className="muted small">まだクエストがありません。</p>}
        {QUEST_GROUPS.map(({ key, label }) => {
          const group = quests.filter((q) => {
            const st = seriesStatus(questSeries(q, defs), seriesPeriods, today).kind
            const place = st === 'ended' ? 'archive' : q.kind === 'material' ? 'material' : gradeOf(q)
            return st !== 'upcoming' && place === key && inSeries(series, questSeries(q, defs))
          })
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
                        {boss && <MonsterImage imageId={imageOf(boss, bannerNodeOf(boss))} awaken={awakenOf(boss, bannerNodeOf(boss))} glow={glowOf(boss)} size={56} />}
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
        <div className="row wrap">
          <button className="btn small" onClick={() => go({ name: 'questForm' })}>
            ＋ クエストを作る
          </button>
          {pending.length > 0 && (
            <button className="btn small primary" onClick={makeAll}>
              ✨ 降臨モンスター{pending.length}体ぶん、まとめて作る
            </button>
          )}
        </div>
        {pending.length > 0 && (
          <p className="muted small">
            クエストがまだない降臨モンスターごとに、ボスの名前・属性で作ります。格はレア度から（コラボの激レア→超究極・激レア→超絶・ノーマル→究極・ハズレ→上級）、編成の条件と弱点はおまかせ。あとから1つずつ編集できます。
          </p>
        )}
        {topQuests.length > 0 && (
          <button className={`btn small${confirmRedo ? ' primary' : ' ghost'}`} onClick={() => (confirmRedo ? redoTop() : setConfirmRedo(true))}>
            {confirmRedo
              ? `本当にボスクエスト${topQuests.length}個の条件を作り直す（手で変えた条件は消えます）`
              : '🎯 ボスクエストの条件を、タグの仲間・刺さるキャラから作り直す'}
          </button>
        )}
        {made !== null && <div className="result keep">{made}個のクエストを作りました・作り直しました</div>}
      </section>
    </div>
  )
}
