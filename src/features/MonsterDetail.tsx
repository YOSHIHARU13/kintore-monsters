import { useState } from 'react'
import { awakenOf, imageOf, glowOf, monArt } from '../lib/art'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, FORM_ATTR_LABEL, SLOTS, exerciseOfSlot, type Attr } from '../data/exercises'
import { FIRST_NODE_ID, getNode, getTemplate } from '../data/evolutionTemplates'
import { CONFIG } from '../config/gameConfig'
import { boughtCap, isExpFull, jogressStones, materialKeys, missingMaterials, nextCost, planPour, type EvoCost } from '../lib/evolution'
import { Gauge } from '../components/Gauge'
import { Stars } from '../components/Stars'
import { Abilities } from '../components/Abilities'
import { isLuckMax, luckOf } from '../lib/fusion'
import { ElementBadge } from '../components/ElementBadge'
import { BALL_LABEL, CORE_LABEL, STONE_LABEL, ballsOf, coresOf, stonesOf } from '../lib/cores'
import { attackOf, isJogressReady, jogressNeed } from '../lib/stats'
import { MonsterImage } from '../components/MonsterImage'
import { CustomSlot } from '../components/CustomSlot'
import { ShinkaPanel } from '../components/ShinkaPanel'
import { FitQuests } from '../components/FitList'
import { ATTR_COLOR, type Go } from '../nav'
import { investedFor, isHidden, monsterName, nodeAttr, plusName, type MonsterDef } from '../types'

export function MonsterDetail({ id, go }: { id: string; go: Go }) {
  const { owned, defs, state, menu, pourExp, evolve, feedLuck, jogress, toggleLock } = useStore()
  const [shinkaNow, setShinkaNow] = useState(false)
  const [evolved, setEvolved] = useState(0)
  const [confirmAllLuck, setConfirmAllLuck] = useState(false)
  const [partnerKey, setPartnerKey] = useState<string | null>(null)
  const [born, setBorn] = useState<{ def: MonsterDef; id: string } | null>(null)
  const [luckMaxNow, setLuckMaxNow] = useState<number | null>(null) // 運極になったときの報酬のトク玉
  const mon = owned.find((o) => o.id === id)
  const def = mon && defs.find((d) => d.id === mon.defId)

  // ジョグレスで生まれた直後は、元の2体がいなくなるので先に演出を出す
  if (born) {
    return (
      <div className="beat-overlay clear-overlay">
        <div className="beat-burst" />
        <div className="beat-burst reverse" />
        {Array.from({ length: 42 }, (_, i) => (
          <i key={i} className="spark" style={{ ['--i' as string]: i }} />
        ))}
        <div className="beat-text">
          <div className="beat-title">ジョグレス進化！！</div>
          <MonsterImage imageId={imageOf(born.def, FIRST_NODE_ID)} awaken={awakenOf(born.def, FIRST_NODE_ID)} glow={glowOf(born.def)} size={180} />
          <div className="beat-title">{monsterName(born.def, FIRST_NODE_ID)}</div>
          <Stars def={born.def} nodeId={FIRST_NODE_ID} />
          <div className="beat-sub">が生まれた！</div>
          <button className="btn primary" onClick={() => go({ name: 'monster', id: born.id })}>
            会いに行く
          </button>
        </div>
      </div>
    )
  }

  if (!mon || !def) {
    return (
      <div className="page">
        <button className="back" onClick={() => go({ name: 'box' })}>
          ← BOXに戻る
        </button>
        <p className="muted">モンスターが見つかりません。</p>
      </div>
    )
  }

  // ジョグレスの素材：コイン・筋肉玉・2体それぞれの属性の結晶
  const jogressNeeds = (partnerDefId: string) => {
    const partnerDef = defs.find((d) => d.id === partnerDefId)
    const els = partnerDef ? jogressStones(def, partnerDef) : []
    return [...new Set(els)].map((e) => ({ e, n: CONFIG.jogress.stones * els.filter((x) => x === e).length }))
  }
  const jogressAffordable = (partnerDefId: string) =>
    (state.coins ?? 0) >= CONFIG.jogress.coins &&
    ballsOf(state) >= CONFIG.jogress.balls &&
    jogressNeeds(partnerDefId).every(({ e, n }) => stonesOf(state, e) >= n)
  const jogressCostText = (partnerDefId: string) =>
    [
      `🪙${CONFIG.jogress.coins}`,
      `${BALL_LABEL}×${CONFIG.jogress.balls}`,
      ...jogressNeeds(partnerDefId).map(({ e, n }) => `${STONE_LABEL(e)}×${n}`),
    ].join('・')

  const template = getTemplate(def.templateId)
  const node = getNode(template, mon.nodeId)
  const cost = nextCost(template, node)
  const attr = nodeAttr(def, mon.nodeId)
  const branching = node.next.length > 1
  // 運の素材：同じモンスターの別の個体（運が低い順。運が高い個体を残せるように）
  const luckFoods = owned
    .filter((o) => o.defId === mon.defId && o.id !== mon.id && !o.locked) // ロックした子は食べさせない
    .sort((a, b) => luckOf(a) - luckOf(b))
  // 運99に届くまでの分だけ食べさせる
  let luckTotal = luckOf(mon)
  const luckPicked = luckFoods.filter((f) => {
    if (luckTotal >= CONFIG.luck.max) return false
    luckTotal += luckOf(f)
    return true
  })
  const luckGain = Math.min(CONFIG.luck.max, luckTotal) - luckOf(mon)
  // このモンスターがレシピに入っている隠しモンスターと、その相手になれる個体
  const recipes = defs
    .filter((d) => isHidden(d) && d.recipe!.includes(mon.defId))
    .map((hidden) => {
      const [r0, r1] = hidden.recipe!
      const partnerDefId = r0 === mon.defId ? r1 : r0
      const met = owned.some((o) => o.defId === hidden.id) || (state.dexFound[hidden.id]?.length ?? 0) > 0
      return {
        hidden,
        met,
        partnerDef: defs.find((d) => d.id === partnerDefId),
        need: jogressNeed(hidden),
        ready: isJogressReady(mon, def, hidden),
        partners: owned.filter((o) => {
          const d = defs.find((x) => x.id === o.defId)
          return o.defId === partnerDefId && o.id !== mon.id && !!d && isJogressReady(o, d, hidden)
        }),
      }
    })
  const slotName = (slotId: string) => {
    const slot = SLOTS.find((s) => s.id === slotId)
    return slot ? exerciseOfSlot(slot, menu).name : '？'
  }
  const favoriteName = def.favoriteSlot ? slotName(def.favoriteSlot) : null
  const partnerSlot = Object.entries(state.partners).find(([, monId]) => monId === id)?.[0]

  const doEvolve = (toNodeId: string) => {
    evolve(id, toNodeId)
    setEvolved(Date.now())
    navigator.vibrate?.([60, 40, 60, 40, 200])
  }

  return (
    <div className="page">
      {shinkaNow && (
        <div className="beat-overlay clear-overlay" onClick={() => setShinkaNow(false)}>
          <div className="beat-burst" />
          <div className="beat-burst reverse" />
          {Array.from({ length: 42 }, (_, i) => (
            <i key={i} className="spark" style={{ ['--i' as string]: i }} />
          ))}
          <div className="beat-text">
            <div className="beat-title">神化！！</div>
            <MonsterImage imageId={imageOf(def, mon.nodeId)} glow="jogress" size={180} />
            <div className="beat-title">{plusName(def, mon)}</div>
            <Stars def={def} nodeId={mon.nodeId} mon={{ shinka: true }} />
            <div className="beat-sub">★4になった！</div>
          </div>
        </div>
      )}
      {luckMaxNow !== null && (
        <div className="beat-overlay clear-overlay" onClick={() => setLuckMaxNow(null)}>
          <div className="beat-burst" />
          <div className="beat-burst reverse" />
          {Array.from({ length: 42 }, (_, i) => (
            <i key={i} className="spark" style={{ ['--i' as string]: i }} />
          ))}
          <div className="beat-text">
            <div className="beat-title">運極達成！！</div>
            <MonsterImage {...monArt(def, mon)} size={180} shiny={mon.shiny} />
            <div className="beat-title">{plusName(def, mon)}</div>
            <div className="beat-sub">
              クエストのオーブ＋{Math.round(CONFIG.luck.goldBonus * 100)}%・素材のくじ＋{CONFIG.materials.luckRolls}回
            </div>
            {luckMaxNow > 0 && <div className="beat-sub">🟡 トク玉 ×{luckMaxNow} を手に入れた！</div>}
            <span className="luck-max">運極</span>
          </div>
        </div>
      )}
      <button className="back" onClick={() => go({ name: 'box' })}>
        ← BOXに戻る
      </button>

      <section className="card center">
        <div className={evolved ? 'evolve-flash' : ''} key={evolved}>
          <MonsterImage {...monArt(def, mon)} size={200} plus={mon.plus} shiny={mon.shiny} />
        </div>
        <h1 className="title">{plusName(def, mon)}</h1>
        <button className={`btn small${mon.locked ? ' primary' : ' ghost'}`} onClick={() => toggleLock(mon.id)}>
          {mon.locked ? '🔒 ロック中（タップで外す）' : '🔓 ロックする（まとめて合成・素材に使わない）'}
        </button>
        <Stars def={def} nodeId={mon.nodeId} mon={mon} />
        <p className="small">
          攻撃力 <strong>{attackOf(mon, def).toLocaleString()}</strong>　
          {isLuckMax(mon) ? <span className="luck-max">運極</span> : <span>運 {luckOf(mon)}</span>}
        </p>
        <Abilities def={def} />
        <ElementBadge def={def} />
        <p style={{ color: ATTR_COLOR[attr] }}>
          {FORM_ATTR_LABEL[attr]}属性
        </p>
        <p className="muted small">{template.name}</p>
        <p className="small">
          得意種目：{favoriteName ?? '未設定'}
          {mon.custom === 'fav' && mon.customSlot && mon.customSlot !== def.favoriteSlot && `・${slotName(mon.customSlot)}（カスタマイズ）`}

        </p>
        {partnerSlot && <span className="badge">「{slotName(partnerSlot)}」の相棒</span>}
      </section>

      {mon.record && mon.record.quests > 0 && (
        <section className="card">
          <h2>📊 記録</h2>
          <ul className="mini-list">
            <li>
              <span>倒したクエスト</span>
              <strong className="num">{mon.record.quests}回</strong>
            </li>
            <li>
              <span>👑 MVP</span>
              <strong className="num">{mon.record.mvp}回</strong>
            </li>
            <li>
              <span>1回の平均ダメージ</span>
              <strong className="num">{Math.round(mon.record.damage / mon.record.quests).toLocaleString()}</strong>
            </li>
            <li>
              <span>1回の最大ダメージ</span>
              <strong className="num">{mon.record.best.toLocaleString()}</strong>
            </li>
            <li>
              <span>通算ダメージ</span>
              <strong className="num">{mon.record.damage.toLocaleString()}</strong>
            </li>
          </ul>
        </section>
      )}

      <FitQuests def={def} go={go} />

      <CustomSlot mon={mon} def={def} />

      {cost ? (
        <section className="card">
          <h2>{branching ? '次の進化（注いだEXPの種類で進化先が決まる）' : '次の進化'}</h2>
          <div className="routes">
            {node.next.map((nextId) => {
              const nextAttr = nodeAttr(def, nextId)
              // 無属性の進化先には、どの属性のEXPでも注げる
              const sources: Attr[] = nextAttr === 'none' ? ATTRS : [nextAttr]
              const invested = investedFor(mon, nextId, node.next[0])
              const total = invested.trained + invested.bought
              const full = isExpFull(cost, invested)
              return (
                <div key={nextId} className="route">
                  <MonsterImage imageId={imageOf(def, nextId)} awaken={awakenOf(def, nextId)} glow={glowOf(def)} silhouette size={72} />
                  <div className="route-body">
                    <strong style={{ color: ATTR_COLOR[nextAttr] }}>
                      {nextAttr === 'none' ? '無属性：どのEXPでも進化' : `${ATTR_LABEL[nextAttr]}EXPで進化`}
                    </strong>
                    <div className="gauge-row">
                      <Gauge value={total} max={cost.exp} color={ATTR_COLOR[nextAttr]} />
                      <span className="num">
                        {total}/{cost.exp}
                      </span>
                    </div>
                    <span className="small muted">
                      購入EXP {invested.bought}/{boughtCap(cost)} まで
                    </span>
                    {full ? (
                      <>
                        <button
                          className="btn primary small"
                          disabled={missingMaterials(cost, def, nextId, state).length > 0}
                          onClick={() => doEvolve(nextId)}
                        >
                          進化する
                        </button>
                        <EvoMaterials cost={cost} def={def} toNodeId={nextId} />
                      </>
                    ) : (
                      <>
                      {sources.map((src) => {
                        const wallet = state.exp[src]
                        const pour = planPour(cost, invested, wallet)
                        const pourTotal = pour.trained + pour.bought
                        const prefix = nextAttr === 'none' ? `${ATTR_LABEL[src]}の` : ''
                        return (
                          <div key={src} className="pour">
                            <button
                              className="btn small"
                              disabled={pourTotal <= 0}
                              onClick={() => pourExp(id, nextId, src)}
                            >
                              {pourTotal > 0
                                ? `${prefix}EXPを注ぐ（+${pourTotal}${pour.bought > 0 ? `・うち購入 ${pour.bought}` : ''}）`
                                : wallet.bought > 0
                                  ? `${prefix}残りは筋トレEXPが必要`
                                  : `${prefix}注げるEXPがありません`}
                            </button>
                            <span className="small muted">
                              手持ち：筋トレ {wallet.trained}／購入 {wallet.bought}
                            </span>
                          </div>
                        )
                      })}
                      {(() => {
                        const pour = planPour(cost, invested, { trained: state.anyExp, bought: 0 })
                        return (
                          <div className="pour">
                            <button
                              className="btn small"
                              disabled={pour.trained <= 0}
                              onClick={() => pourExp(id, nextId, 'any')}
                            >
                              {pour.trained > 0 ? `万能EXPを注ぐ（+${pour.trained}）` : '万能EXPがありません'}
                            </button>
                            <span className="small muted">手持ち：万能 {state.anyExp}（全身枠で貯まる）</span>
                          </div>
                        )
                      })()}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="muted small">
            所持 🪙{state.coins ?? 0}。購入EXPで埋められるのは必要EXPの{Math.round(CONFIG.shop.boughtExpMaxRatio * 100)}
            %までです。
            {branching && '選ばなかった進化先に注いだEXPは、進化したときに戻ってきます。'}
          </p>
        </section>
      ) : null}

      <ShinkaPanel mon={mon} def={def} onDone={() => setShinkaNow(true)} />

      <details className="card fold" open={luckFoods.length > 0 && !isLuckMax(mon)}>
        <summary>
          <h2>
            運（{luckOf(mon)}／{CONFIG.luck.max}）{isLuckMax(mon) && <span className="luck-max">運極</span>}
          </h2>
        </summary>
        <div className="gauge-row">
          <Gauge value={luckOf(mon)} max={CONFIG.luck.max} color="#ffd166" />
          <span className="num">{luckOf(mon)}</span>
        </div>
        <p className="muted small">
          同じモンスターを食べさせると運が上がります（タダ。食べさせた側の運もそのまま足されます）。運{CONFIG.luck.max}で「運極」。運極を出撃させると、1体につきクエスト報酬のG＋
          {Math.round(CONFIG.luck.goldBonus * 100)}%、素材クエストのくじ＋{CONFIG.materials.luckRolls}回（たくさん落ちやすくなる）。
          クエストのボスは運{CONFIG.luck.questDrop}で落ち、出撃した運極1体ごとに＋{CONFIG.luck.perLuckMax}（最大＋
          {CONFIG.luck.perLuckMaxCap}）。運極になると🟡トク玉（降臨{CONFIG.luck.maxReward.quest}個・ガチャの子
          {CONFIG.luck.maxReward.gacha}個）。
        </p>
        {isLuckMax(mon) ? (
          <p>運極！ クエストで報酬ボーナスがつきます。</p>
        ) : luckFoods.length === 0 ? (
          <p className="muted small">同じモンスターがいません。ガチャやクエストでダブりを集めよう。</p>
        ) : (
          <>
            <button
              className={`btn${confirmAllLuck ? ' primary' : ''} wide`}
              onClick={() => {
                if (!confirmAllLuck) return setConfirmAllLuck(true)
                const eggs = feedLuck(
                  id,
                  luckPicked.map((f) => f.id),
                )
                setConfirmAllLuck(false)
                // この食べさせで運極になったら、お祝いの演出（トク玉の報酬つき）
                if (luckOf(mon) + luckGain >= CONFIG.luck.max) setLuckMaxNow(eggs)
                navigator.vibrate?.([60, 40, 200])
              }}
            >
              {confirmAllLuck
                ? `本当に${luckPicked.length}体まとめて食べさせる`
                : `同じモンスター${luckPicked.length}体をまとめて食べさせる（運＋${luckGain}）`}
            </button>
            <p className="muted small">食べさせた側はいなくなりますが、注いでいたEXPは財布に戻り、図鑑の発見も消えません。</p>
          </>
        )}
      </details>

      {recipes.length > 0 && (
        <details className="card fold" open={recipes.some((r) => r.ready)}>
          <summary>
            <h2>ジョグレス</h2>
          </summary>
          <p className="muted small">
            レシピの2体が条件を満たしたら、合わせて隠しモンスターを生めます（🪙{CONFIG.jogress.coins}・{BALL_LABEL}×
            {CONFIG.jogress.balls}・2体それぞれの属性の結晶×{CONFIG.jogress.stones}。2体はいなくなります。図鑑の発見は残ります）。
          </p>
          <ul className="mini-list">
            {recipes.map(({ hidden, met, partnerDef, partners, need, ready }) => (
              <li key={hidden.id} className="jogress">
                <span>
                  {met ? hidden.name : '？？？'}（★{need.stars + 1}で誕生）← {def.name} ＆ {partnerDef?.name ?? '？？？'}
                  ：どちらも最終形態（★{need.stars}以上）
                </span>
                {!ready ? (
                  <span className="muted small">
                    このモンスターを最終形態（★{need.stars}以上）まで育てよう
                  </span>
                ) : partners.length === 0 ? (
                  <span className="muted small">
                    相手の{partnerDef?.name ?? '？？？'}（最終形態・★{need.stars}以上）がいません
                  </span>
                ) : (
                  partners.map((partner) => {
                    const key = `${hidden.id}:${partner.id}`
                    return partnerKey === key ? (
                      <button
                        key={key}
                        className="btn primary small"
                        disabled={!jogressAffordable(partner.defId)}
                        onClick={() => {
                          const newId = jogress(id, partner.id, hidden.id)
                          setPartnerKey(null)
                          if (newId) {
                            navigator.vibrate?.([120, 60, 120, 60, 320])
                            setBorn({ def: hidden, id: newId })
                          }
                        }}
                      >
                        本当にジョグレスする（{jogressCostText(partner.defId)}）
                      </button>
                    ) : (
                      <button key={key} className="btn small" onClick={() => setPartnerKey(key)}>
                        {partnerDef ? plusName(partnerDef, partner) : '？？？'}とジョグレス
                      </button>
                    )
                  })
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/** 進化に使う素材と、いまの所持数（足りないものは赤） */
function EvoMaterials({ cost, def, toNodeId }: { cost: EvoCost; def: MonsterDef; toNodeId: string }) {
  const { state } = useStore()
  const keys = materialKeys(def, toNodeId, state)
  const rows = [
    { label: '🪙進化コイン', need: cost.coins, have: state.coins ?? 0 },
    { label: `💠${STONE_LABEL(keys.stone)}`, need: cost.stones ?? 0, have: stonesOf(state, keys.stone) },
    { label: `💎${CORE_LABEL[keys.muscle]}`, need: cost.muscle ?? 0, have: coresOf(state, keys.muscle) },
    { label: `🟣${BALL_LABEL}`, need: cost.balls ?? 0, have: ballsOf(state) },
  ].filter((r) => r.need > 0)
  return (
    <span className="small evo-materials">
      {rows.map((r) => (
        <span key={r.label} className={r.have < r.need ? 'error' : undefined}>
          {r.label} {r.have.toLocaleString()}/{r.need.toLocaleString()}
        </span>
      ))}
    </span>
  )
}
