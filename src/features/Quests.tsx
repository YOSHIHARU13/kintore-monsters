import { useState } from 'react'
import { patternTag } from '../lib/pattern'
import { ATTRS, ATTR_LABEL, type Attr } from '../data/exercises'
import { ATTR_COLOR } from '../nav'
import { awakenOf, imageOf, glowOf, monArt } from '../lib/art'
import { useStore } from '../store'
import { SeriesChips } from '../components/SeriesChips'
import { allSeries, inSeries, questSeries, seriesStatus, statusLabel, type SeriesFilter } from '../lib/series'
import { MonsterImage } from '../components/MonsterImage'
import { QuestBanner } from '../components/QuestBanner'
import { bannerNodeOf } from '../components/GachaBanner'
import { useBattle } from '../components/BattleBar'
import { dropPlus, gradeOf, isTemple, questGold, questLevelLabel } from '../lib/quest'

const VIEW_KEY = 'questListView'

/** クエスト一覧の見出し：格の高い順、最後に素材 */
const QUEST_GROUPS = [
  { key: 'bakuzetsu', label: '爆絶' },
  { key: 'chokyukyoku', label: '超究極' },
  { key: 'chozetsu', label: '超絶' },
  { key: 'kyukyoku', label: '究極' },
  { key: 'kiwami', label: '極' },
  { key: 'jokyu', label: '上級' },
  { key: 'temple', label: '🏛 神殿（カスタマイズアイテム）' },
  { key: 'material', label: '素材' },
  { key: 'archive', label: '📚 書庫（開催が終わったコラボ）' },
] as const

/** 入口ごとに出す見出し */
const CATEGORY_GROUPS: Record<QuestCategory, string[]> = {
  boss: ['bakuzetsu', 'chokyukyoku', 'chozetsu', 'kyukyoku', 'kiwami', 'jokyu'],
  material: ['material'],
  temple: ['temple'],
  archive: ['archive'],
}
const CATEGORY_TITLE: Record<QuestCategory, string> = {
  boss: '⚔️ クエスト',
  material: '💎 素材クエスト',
  temple: '🏛 神殿',
  archive: '📚 書庫',
}

/** そのクエストが入る見出し（書庫・神殿・素材・ボスの格） */
export function questPlace(q: Quest, defs: MonsterDef[], periods: Periods, today: string): string {
  const st = seriesStatus(questSeries(q, defs), periods, today).kind
  return st === 'ended' ? 'archive' : isTemple(q) ? 'temple' : q.kind === 'material' ? 'material' : gradeOf(q)
}

/** そのクエストが入る入口（クエスト詳細の「戻る」に使う） */
export function questCategoryOf(q: Quest, defs: MonsterDef[], periods: Periods, today: string): QuestCategory {
  const place = questPlace(q, defs, periods, today)
  return place === 'archive' || place === 'temple' || place === 'material' ? place : 'boss'
}
import { formationOf, requirementsOf } from '../lib/formation'
import { isLuckMax, luckBonus, luckOf } from '../lib/fusion'
import { ELEMENT_COLOR } from '../lib/element'
import { CONFIG } from '../config/gameConfig'
import { dropLabel } from '../lib/cores'
import { towerCleared, towerMonth, towerOpen } from '../lib/tower'
import { battlesReached, castleBest, castleCleared, castleOpen } from '../lib/castle'
import { kinkinCleared, kinkinOpen } from '../lib/kinkin'
import { towerRewardText } from './Tower'
import { boosterName } from '../lib/boosters'
import type { QuestReward } from '../store'
import { TreasureBoxes } from '../components/TreasureBoxes'
import { BattleScene } from '../components/BattleScene'
import type { Go, QuestCategory } from '../nav'
import type { Periods } from '../lib/series'
import { BattleBar } from '../components/BattleBar'
import { DamageShare } from '../components/DamageShare'
import { SetsEstimate } from '../components/SetsEstimate'
import { plusName, type MonsterDef, type Quest } from '../types'

/** クエストのタブ：入口（クエスト・零の孤城・試練の塔・素材・神殿・書庫）と、今日の戦い。入口を選ぶと一覧 */
export function Quests({ go, category }: { go: Go; category?: QuestCategory }) {
  const { state, quests, tower, castle, kinkin, defs, owned, today, seriesPeriods, quitChallenge, claimQuest, feedLuck } = useStore()
  const [fedLuck, setFedLuck] = useState<{ msg: string; keeperId: string } | null>(null) // 落ちた子を運に食べさせた
  const [series, setSeries] = useState<SeriesFilter>('all')
  const [part, setPart] = useState<Attr | 'all'>('all') // ボスの部位で絞り込む（「今日は胸」と決めてから選べる）
  const towerDone = towerCleared(state, towerMonth(today))
  const towerTotal = Math.max(1, ...tower.map((f) => (f.tower ?? 0) + 1))
  const battle = useBattle()
  const towerFloor = battle
    ? (tower.find((f) => f.quest.id === battle.quest.id) ??
      castle.find((f) => f.quest.id === battle.quest.id) ??
      kinkin.find((f) => f.quest.id === battle.quest.id))
    : undefined
  const castleDone = castleCleared(state, towerMonth(today))
  // 孤城の挑戦中なら、何バトル目まで突破したか
  const castleNow = battle ? castle.find((f) => f.quest.id === battle.quest.id) : undefined
  const castleInfo =
    battle && castleNow
      ? { reached: battlesReached(battle.damage, battle.hp), best: castleBest(state, towerMonth(today), castleNow.floor) }
      : null
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
  const [got, setGot] = useState<(QuestReward & { boss: MonsterDef | undefined; plus: number; quest?: Quest }) | null>(null)
  // 出撃した日のうちに倒せなかった戦い
  const expired =
    state.challenge && state.challenge.date !== today
      ? [...quests, ...tower.map((f) => f.quest), ...castle.map((f) => f.quest), ...kinkin.map((f) => f.quest)].find(
          (q) => q.id === state.challenge!.questId,
        )
      : null

  // 入口の一覧（クエスト・零の孤城・試練の塔・素材・神殿・書庫）
  const count = (c: QuestCategory) => quests.filter((q) => questCategoryOf(q, defs, seriesPeriods, today) === c)
  const clearedOf = (list: Quest[]) => list.filter((q) => (state.clearedQuests[q.id] ?? 0) > 0).length
  const CATEGORY_MENU = [
    { key: 'boss', icon: '⚔️', label: 'クエスト', hint: `爆絶〜上級・コラボ（${clearedOf(count('boss'))}/${count('boss').length}クリア）`, open: () => go({ name: 'quests', category: 'boss' }) },
    {
      key: 'tower',
      icon: '🗼',
      label: `試練の塔${patternTag(towerMonth(today))}`,
      hint: !towerOpen(today)
        ? `毎月${CONFIG.tower.openDays[0]}〜${CONFIG.tower.openDays[1]}日に開催`
        : towerDone >= CONFIG.tower.floors
          ? '今月は踏破！'
          : `開催中 ${towerDone}／${CONFIG.tower.floors}階${towerTotal > 1 ? `（塔は${towerTotal}つ）` : ''}`,
      open: () => go({ name: 'tower' }),
      hidden: !towerOpen(today),
    },
    {
      key: 'kinkin',
      icon: '⛓',
      label: `禁筋の獄${patternTag(towerMonth(today))}`,
      hint: !kinkinOpen(today)
        ? `毎月${CONFIG.kinkin.openDays[0]}〜${CONFIG.kinkin.openDays[1]}日に開催・全${CONFIG.kinkin.floors}階・オーブ多め`
        : `開催中 ${kinkinCleared(state, towerMonth(today))}／${CONFIG.kinkin.floors}階`,
      open: () => go({ name: 'kinkin' }),
      hidden: !kinkinOpen(today),
    },
    {
      key: 'castle',
      icon: '🏯',
      label: `零の孤城${patternTag(towerMonth(today))}`,
      hint: !castleOpen(today)
        ? `毎月${CONFIG.castle.openDays[0]}日〜月末に開催・全階爆絶・最上階は零属性の城主`
        : castleDone >= CONFIG.castle.floors
          ? '今月は踏破！'
          : `開催中 ${castleDone}／${CONFIG.castle.floors}階・全階爆絶・最上階は零属性の城主`,
      open: () => go({ name: 'castle' }),
      hidden: !castleOpen(today),
    },
    { key: 'material', icon: '💎', label: '素材クエスト', hint: '結晶・核・筋肉玉・進化コイン（初級・上級・究極）', open: () => go({ name: 'quests', category: 'material' }) },
    { key: 'temple', icon: '🏛', label: '神殿', hint: 'カスタマイズアイテム（時の間・修羅場）', open: () => go({ name: 'quests', category: 'temple' }) },
    { key: 'archive', icon: '📚', label: '書庫', hint: '開催が終わったコラボのクエスト', open: () => go({ name: 'quests', category: 'archive' }), hidden: count('archive').length === 0 },
  ]

  if (!category) {
  return (
    <div className="page">
      <h1 className="title">クエスト</h1>

      {got && (
        <section className="card center">
          <h2>
            {got.towerFloor
              ? `${got.castle ? '零の孤城' : got.kinkin ? '禁筋の獄' : '試練の塔'} ${got.towerFloor}階 ${got.battles ? `バトル${got.battles.to}まで突破！` : '突破！'}`
              : '討伐成功！'} 🔮+{got.gold}・🪙+
            {got.coins ?? 0}
          </h2>
          {got.byMember && <DamageShare byMember={got.byMember} mvpId={got.mvpId} />}
          {got.boosted && <p className="tag keep">⚔️ 討伐ブースターで中身2倍！</p>}
          {got.boxes && <TreasureBoxes boxes={got.boxes} quest={got.quest ?? { attr: 'none' }} boss={got.boss} main={got.mainBox} />}
          {got.eggs > 0 && <p>🟡 トク玉 ×{got.eggs} を手に入れた！</p>}
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
          {got.drops.some((d) => d.count > 0) && (
            <div className="drop-cards">
              {got.drops
                .filter((d) => d.count > 0)
                .map((d, i) => (
                  // 1枚ずつめくれて出てくる。金のアイテム・筋肉玉・ステッキは光る
                  <span
                    key={i}
                    className={`drop-card${/🥇|筋肉玉|ステッキ/.test(d.label) ? ' shine' : ''}`}
                    style={{ animationDelay: `${i * 0.35}s` }}
                  >
                    <span className="drop-icon">{d.icon || d.label.slice(0, 2)}</span>
                    <span className="small">{d.icon ? d.label : d.label.slice(2).trim()}</span>
                    <strong>×{d.count}</strong>
                    {d.pity && <span className="small">確定</span>}
                  </span>
                ))}
            </div>
          )}
          {got.drops.map((d, i) =>
            d.count > 0 ? null : (
              <p key={i} className="muted">
                今回は{d.label}が落ちなかった…{d.label === '筋肉玉' ? `（${CONFIG.materials.ballPityMisses}回続けて落ちないと確定）` : ''}
              </p>
            ),
          )}
          {got.monsterId && got.luck !== undefined && <p className="small">運 {got.luck} で手に入った</p>}
          {got.monsterId && (() => {
            // すでに持っている同じ子（運極でない、いちばん運が高い子）に、その場で食べさせられる
            const keeper = owned
              .filter((o) => o.defId === got.defId && o.id !== got.monsterId && !isLuckMax(o))
              .sort((a, b) => luckOf(b) - luckOf(a))[0]
            const def = defs.find((d) => d.id === got.defId)
            if (fedLuck) return <div className="result keep">{fedLuck.msg}</div>
            if (!keeper || !def || !owned.some((o) => o.id === got.monsterId)) return null
            return (
              <button
                className="btn wide"
                onClick={() => {
                  const eggs = feedLuck(keeper.id, [got.monsterId!])
                  const luck = Math.min(CONFIG.luck.max, luckOf(keeper) + (got.luck ?? 1))
                  setFedLuck({
                    keeperId: keeper.id,
                    msg:
                      luck >= CONFIG.luck.max
                        ? `運極達成！！${eggs > 0 ? ` 🟡トク玉×${eggs}` : ''}`
                        : `持っている${def.name}の運が ${luckOf(keeper)} → ${luck} になった`,
                  })
                }}
              >
                🍖 持っている{def.name}（運{luckOf(keeper)}）に食べさせる
              </button>
            )
          })()}
          {got.monsterId && (
            <button className="btn primary wide" onClick={() => go({ name: 'monster', id: fedLuck?.keeperId ?? got.monsterId! })}>
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
          <BattleScene battle={battle} />
          <p className="muted small">
            与えたダメージ {battle.damage.toLocaleString()} ／ HP {battle.hp.toLocaleString()}・編成倍率 ×
            {formationOf(
              battle.party.map((m) => m.def),
              requirementsOf(battle.quest),
            ).rate.toFixed(2)}
            {luckBonus(battle.party.map((m) => m.mon)).count > 0 &&
              `・運極ボーナス オーブ×${luckBonus(battle.party.map((m) => m.mon)).goldRate.toFixed(1)}・宝箱+${luckBonus(battle.party.map((m) => m.mon)).count * CONFIG.boxes.perLuckMax}`}
            ・今日中に倒そう
          </p>
          {castleInfo && (
            <p className="small castle-battles">
              {'⚔️'.repeat(castleInfo.reached)}
              {'・'.repeat(CONFIG.quest.battles - castleInfo.reached)} バトル {castleInfo.reached}/{CONFIG.quest.battles} 突破
              （今月の最高 {castleInfo.best}）。出撃は1回なので、受け取るとこの挑戦は終わります
            </p>
          )}
          {battle.defeated || (castleInfo && castleInfo.reached > castleInfo.best) ? (
            <button
              className="btn primary wide"
              onClick={() => {
                const reward = claimQuest()
                if (reward) {
                  const def = defs.find((d) => d.id === reward.defId)
                  setFedLuck(null)
                  setGot({
                    ...reward,
                    boss: def,
                    quest: battle.quest,
                    plus: reward.towerFloor ? 0 : dropPlus(battle.quest),
                  })
                }
              }}
            >
              報酬を受け取る（
              {castleInfo
                ? `バトル${castleInfo.best + 1}〜${castleInfo.reached}突破のぶん`
                : towerFloor
                ? towerRewardText(towerFloor, defs, state)
                : battle.quest.kind === 'material'
                  ? `${dropLabel(battle.quest)}のくじ`
                  : `${battle.boss?.name}${dropPlus(battle.quest) > 0 ? `＋${dropPlus(battle.quest)}` : ''}`}
              {!towerFloor && `・🔮${questGold(battle.quest, battle.challenge.difficulty)}`}）
            </button>
          ) : (
            <button className="btn primary wide" onClick={() => go({ name: 'training' })}>
              トレーニングで攻撃する
            </button>
          )}
          <div className="party-row">
            {battle.party.map((m) => (
              <span key={m.mon.id} title={plusName(m.def, m.mon)}>
                <MonsterImage {...monArt(m.def, m.mon)} size={40} plus={m.mon.plus} shiny={m.mon.shiny} />
              </span>
            ))}
          </div>
          <DamageShare byMember={battle.byMember} mvpId={battle.mvpId} />
          {!battle.defeated && <SetsEstimate quest={battle.quest} party={battle.party} hpLeft={battle.hp - battle.damage} />}
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
            出撃してからの筋トレと全身枠のセットが、そのままダメージになります（休憩30秒未満のセットは除く）。日付が変わると失敗です。
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

      {/* 高難度は開催中のものだけ。ほかは次の開催日だけ出す */}
      {(() => {
        const d = Number(today.slice(8, 10))
        const next = [
          { name: '試練の塔', open: towerOpen(today), from: CONFIG.tower.openDays[0] },
          { name: '禁筋の獄', open: kinkinOpen(today), from: CONFIG.kinkin.openDays[0] },
          { name: '零の孤城', open: castleOpen(today), from: CONFIG.castle.openDays[0] },
        ]
          .filter((x) => !x.open)
          .map((x) => `${x.name}は${x.from > d ? '' : '来月'}${x.from}日から`)
        return next.length > 0 ? <p className="muted small">次の高難度：{next.join('・')}</p> : null
      })()}
      {CATEGORY_MENU.map((c) =>
        c.hidden ? null : (
          <button key={c.key} className={`card tower-entry quest-entry entry-${c.key}`} onClick={c.open}>
            <span style={{ fontSize: '2rem' }}>{c.icon}</span>
            <span className="tower-body">
              <strong>{c.label}</strong>
              <span className="small muted">{c.hint}</span>
            </span>
            <span>›</span>
          </button>
        ),
      )}
    </div>
  )
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'quests' })}>
        ← クエストに戻る
      </button>
      <h1 className="title">{CATEGORY_TITLE[category]}</h1>
      <BattleBar go={go} />
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
        {category === 'boss' && (
          <div className="chips" role="group" aria-label="ボスの部位で絞り込み">
            {(['all', ...ATTRS] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={`chip small${part === a ? ' on' : ''}`}
                style={a !== 'all' ? { color: part === a ? undefined : ATTR_COLOR[a] } : undefined}
                onClick={() => setPart(a)}
              >
                {a === 'all' ? '全部の部位' : `${ATTR_LABEL[a]}のボス`}
              </button>
            ))}
          </div>
        )}
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
          if (!category || !CATEGORY_GROUPS[category].includes(key)) return null
          const group = quests.filter((q) => {
            const st = seriesStatus(questSeries(q, defs), seriesPeriods, today).kind
            return (
              st !== 'upcoming' &&
              questPlace(q, defs, seriesPeriods, today) === key &&
              inSeries(series, questSeries(q, defs)) &&
              (part === 'all' || q.attr === part)
            )
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
      </section>
    </div>
  )
}
