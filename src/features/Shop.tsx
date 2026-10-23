import { useState } from 'react'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { useStore } from '../store'
import { CollabNews } from '../components/CollabNews'
import { gachaSeries, seriesStatus, statusLabel } from '../lib/series'
import { availableEvents, upcomingEvents } from '../lib/events'
import { ACTIVE_HINT, activeToday } from '../lib/missions'
import { ATTRS, ATTR_LABEL, type Attr } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { Stepper } from '../components/Stepper'
import { MonsterImage } from '../components/MonsterImage'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName } from '../types'
import { HatchReveal, type Hatched } from '../components/HatchReveal'
import { MultiReveal } from '../components/MultiReveal'
import type { HatchResult } from '../store'

const MULTI_MAX = 10
import { Stars } from '../components/Stars'
import { BoosterPanel } from '../components/BoosterPanel'
import { GachaBanner, featuredOf, pickupsOf } from '../components/GachaBanner'
import { isReady, percent, pickupCount, pullsAffordable, rarityOf, rateTable, tierRates, type Pay } from '../lib/gacha'


export function Shop({ go }: { go: Go }) {
  const { state, defs, owned, gachas, today, yesterday, todaySets, seriesPeriods, hatchEgg, hatchMany, freePull, buyExp } = useStore()
  const freeEvents = availableEvents(state, today)
  const active = activeToday(state, todaySets, today, yesterday)
  const upcoming = upcomingEvents(today).slice(0, 3)
  const [multi, setMulti] = useState<HatchResult[] | null>(null)
  const [attr, setAttr] = useState<Attr>('chestArms')
  const [amount, setAmount] = useState(CONFIG.shop.expBuyStep)
  const [hatched, setHatched] = useState<Hatched | null>(null)
  // 「いつものガチャ」は出さない（作ったガチャが1つもないときだけ出す）
  const statusOf = (gachaId: string) => seriesStatus(gachaSeries(rateTable(gachaId, defs)), seriesPeriods, today)
  const custom = gachas.filter((g) => !g.builtin && !['ended', 'upcoming'].includes(statusOf(g.id).kind))
  const shown = custom.length > 0 ? custom : gachas
  const [gachaId, setGachaId] = useState(() => {
    // 最初は、中身がいるガチャのうち、いちばん新しいものを選んでおく
    const withMembers = shown.filter((g) => isReady(g, rateTable(g.id, defs)))
    return (withMembers[withMembers.length - 1] ?? shown[0]).id
  })

  const gacha = shown.find((g) => g.id === gachaId) ?? shown[0]
  const table = rateTable(gacha.id, defs)
  const hasPityTier = table.some((t) => t.rarity === CONFIG.gacha.pity.rarity)
  const pityLeft = CONFIG.gacha.pity.pulls - (state.pity[gacha.id] ?? 0)
  const met = (defId: string) => owned.some((o) => o.defId === defId) || (state.dexFound[defId]?.length ?? 0) > 0
  const ready = isReady(gacha, table)
  const hatch = (pay: Pay) => {
    const result = hatchEgg(gacha.id, pay)
    if (result) setHatched({ ...result, rarity: rarityOf(result.def) })
  }
  // トク玉は持っているぶん（最大10連）、オーブは10連（足りなければ引けるぶん）
  const multiCount = (pay: Pay) => Math.min(pullsAffordable(state, pay), MULTI_MAX)
  const hatchMulti = (pay: Pay) => {
    const results = hatchMany(gacha.id, multiCount(pay), pay)
    if (results.length > 0) setMulti(results)
  }
  const price = CONFIG.shop.pullPrice
  const pullRow = (pay: Pay) => {
    const n = multiCount(pay)
    const cost = (k: number) => (pay === 'orbs' ? `🔮${k * price}` : `🟡トク玉×${k}`)
    return (
      <div className="pull-buttons" key={pay}>
        <button className="btn primary pull-1" disabled={!ready || n < 1} onClick={() => hatch(pay)}>
          1回引く
          <span className="small">{cost(1)}</span>
        </button>
        <button className="btn primary pull-many" disabled={!ready || n < 2} onClick={() => hatchMulti(pay)}>
          {n >= 2 ? `${n}連で引く` : 'まとめて引く'}
          <span className="small">{cost(Math.max(2, pay === 'orbs' ? (n >= 2 ? n : MULTI_MAX) : n))}</span>
        </button>
      </div>
    )
  }
  const expCost = amount * CONFIG.shop.coinsPerExp
  const maxAmount = Math.max(
    CONFIG.shop.expBuyStep,
    Math.floor((state.coins ?? 0) / CONFIG.shop.coinsPerExp / CONFIG.shop.expBuyStep) * CONFIG.shop.expBuyStep,
  )

  return (
    <div className="page">
      <h1 className="title">ショップ</h1>
      <p className="gold">所持 🔮{state.gold}・🟡{state.eggs}・🪙{state.coins ?? 0}</p>

      <CollabNews />
      <section className="card gacha-stage">
        <div className="gacha-tabs" role="tablist" aria-label="ガチャ">
          {shown.map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={g.id === gacha.id}
              className={`gacha-tab${g.id === gacha.id ? ' on' : ''}`}
              onClick={() => setGachaId(g.id)}
            >
              {g.name}
              {statusOf(g.id).kind === 'active' && <span className="tab-badge">⏳{statusLabel(statusOf(g.id))}</span>}
            </button>
          ))}
        </div>
        <GachaBanner
          gacha={gacha}
          count={table.length}
          featured={featuredOf(gacha, table, defs)}
          pickups={pickupsOf(table)}
          selected
        />
        <div className="egg-bar">
          <span>
            🟡 トク玉 <strong className="num">{state.eggs}</strong>個・🔮 オーブ <strong className="num">{state.gold}</strong>
          </span>
        </div>
        {!ready ? (
          <p className="warn small">
            {gacha.builtin
              ? 'このガチャにはまだモンスターがいません。図鑑でモンスターを登録してください。'
              : `準備中：ピックアップ（レア以上）があと${CONFIG.gacha.minPickups - pickupCount(table)}体そろうと引けます。「編集」から選べます。`}
          </p>
        ) : (
          <>
            {freeEvents.map((ev) => (
              <button
                key={ev.id}
                className="btn primary wide free-pull"
                disabled={!active}
                onClick={() => {
                  const results = freePull(ev.id, gacha.id)
                  if (results.length > 0) setMulti(results)
                }}
              >
                {active ? `🎁 ${ev.label}を「${gacha.name}」で引く（無料）` : `🔒 ${ev.label}`}
              </button>
            ))}
            {freeEvents.length > 0 && !active && <p className="muted small">{ACTIVE_HINT}</p>}
            {state.eggs > 0 && pullRow('eggs')}
            {pullRow('orbs')}
            <p className="muted small center">1回：トク玉1個 か オーブ{price}個</p>
            {hasPityTier && (
              <p className="small center bonus-reward">
                {CONFIG.gacha.rarities[CONFIG.gacha.pity.rarity].label}確定まで あと{pityLeft}回
              </p>
            )}
            <details>
              <summary className="small">提供割合を見る</summary>
            {[...tierRates(table)].reverse().map(({ rarity, rate, count }) => (
              <div key={rarity}>
                <h3 className={`small rarity-title rarity-${rarity}`}>
                  {CONFIG.gacha.rarities[rarity].label} 合計{percent(rate)}（{count}種）
                </h3>
                <ul className="mini-list">
                  {table
                    .filter((t) => t.rarity === rarity)
                    .map(({ def, rate: r }) => (
                      <li key={def.id}>
                        <span className="monster-row">
                          <MonsterImage imageId={imageOf(def, FIRST_NODE_ID)} awaken={awakenOf(def, FIRST_NODE_ID)} glow={glowOf(def)} silhouette={!met(def.id)} size={40} />
                          <span>
                            {met(def.id) ? monsterName(def, FIRST_NODE_ID) : '？？？'}
                            <br />
                            <Stars def={def} nodeId={FIRST_NODE_ID} />
                          </span>
                        </span>
                        <span className="tag">{percent(r)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            </details>
          </>
        )}
      </section>

      <section className="card">
        <h2>📅 無料ガチャの日</h2>
        <ul className="mini-list">
          {freeEvents.map((ev) => (
            <li key={ev.id}>
              <span>{ev.label}</span>
              <span className="tag keep">今日！</span>
            </li>
          ))}
          {upcoming.map(({ event, date, days }) => (
            <li key={event.id}>
              <span>
                {event.label}
                <span className="muted small"> {Number(date.slice(5, 7))}/{Number(date.slice(8))}</span>
              </span>
              <span className="tag">あと{days}日</span>
            </li>
          ))}
        </ul>
        <p className="muted small">その日のうちに、好きなガチャで引けます（トク玉もオーブも減りません）。</p>
      </section>

      <BoosterPanel />


      <section className="card">
        <h2>EXPを買う</h2>
        <p className="muted small">
          進化コイン🪙{CONFIG.shop.coinsPerExp}＝1EXP。購入EXPは、各進化に必要なEXPの
          {Math.round(CONFIG.shop.boughtExpMaxRatio * 100)}%までしか使えません。
        </p>
        <div className="chips">
          {ATTRS.map((a) => (
            <button
              key={a}
              className={`chip${a === attr ? ' on' : ''}`}
              style={a === attr ? { borderColor: ATTR_COLOR[a], color: ATTR_COLOR[a] } : undefined}
              onClick={() => setAttr(a)}
            >
              {ATTR_LABEL[a]}
            </button>
          ))}
        </div>
        <Stepper
          value={amount}
          onChange={setAmount}
          min={CONFIG.shop.expBuyStep}
          max={maxAmount}
          step={CONFIG.shop.expBuyStep}
          unit="EXP"
        />
        <button className="btn primary wide" disabled={(state.coins ?? 0) < expCost} onClick={() => buyExp(attr, amount)}>
          {ATTR_LABEL[attr]}EXP {amount} を買う（🪙{expCost}）
        </button>
        <p className="small muted">
          手持ちの購入EXP：{ATTRS.map((a) => `${ATTR_LABEL[a]} ${state.exp[a].bought}`).join('／')}
        </p>
      </section>

      {multi && (
        <MultiReveal results={multi} onClose={() => setMulti(null)} onMeet={(id) => go({ name: 'monster', id })} />
      )}
      {hatched && (
        <HatchReveal
          key={hatched.monsterId}
          hatched={hatched}
          onClose={() => setHatched(null)}
          onMeet={() => go({ name: 'monster', id: hatched.monsterId })}
        />
      )}
    </div>
  )
}
