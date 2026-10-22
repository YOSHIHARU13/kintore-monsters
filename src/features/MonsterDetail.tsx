import { useState } from 'react'
import { awakenOf, imageOf } from '../lib/art'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, FORM_ATTR_LABEL, SLOTS, exerciseOfSlot, type Attr } from '../data/exercises'
import { FIRST_NODE_ID, getNode, getTemplate } from '../data/evolutionTemplates'
import { CONFIG } from '../config/gameConfig'
import { boughtCap, isExpFull, nextCost, planPour } from '../lib/evolution'
import { Gauge } from '../components/Gauge'
import { Stars } from '../components/Stars'
import { Abilities } from '../components/Abilities'
import { isLuckMax, luckOf } from '../lib/fusion'
import { ElementBadge } from '../components/ElementBadge'
import { CORE_LABEL } from '../lib/cores'
import { attackOf, isJogressReady, jogressNeed } from '../lib/stats'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { investedFor, isHidden, monsterName, nodeAttr, plusName, type MonsterDef } from '../types'

export function MonsterDetail({ id, go }: { id: string; go: Go }) {
  const { owned, defs, state, menu, pourExp, evolve, feedLuck, jogress } = useStore()
  const [evolved, setEvolved] = useState(0)
  const [confirmAllLuck, setConfirmAllLuck] = useState(false)
  const [partnerKey, setPartnerKey] = useState<string | null>(null)
  const [born, setBorn] = useState<{ def: MonsterDef; id: string } | null>(null)
  const [luckMaxNow, setLuckMaxNow] = useState(false)
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
          <MonsterImage imageId={imageOf(born.def, FIRST_NODE_ID)} awaken={awakenOf(born.def, FIRST_NODE_ID)} size={180} />
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

  const template = getTemplate(def.templateId)
  const node = getNode(template, mon.nodeId)
  const cost = nextCost(template, node)
  const attr = nodeAttr(def, mon.nodeId)
  const branching = node.next.length > 1
  // 運の素材：同じモンスターの別の個体（運が低い順。運が高い個体を残せるように）
  const luckFoods = owned
    .filter((o) => o.defId === mon.defId && o.id !== mon.id)
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
      {luckMaxNow && (
        <div className="beat-overlay clear-overlay" onClick={() => setLuckMaxNow(false)}>
          <div className="beat-burst" />
          <div className="beat-burst reverse" />
          {Array.from({ length: 42 }, (_, i) => (
            <i key={i} className="spark" style={{ ['--i' as string]: i }} />
          ))}
          <div className="beat-text">
            <div className="beat-title">運極達成！！</div>
            <MonsterImage imageId={imageOf(def, mon.nodeId)} awaken={awakenOf(def, mon.nodeId)} size={180} shiny={mon.shiny} />
            <div className="beat-title">{plusName(def, mon)}</div>
            <div className="beat-sub">
              クエスト報酬G＋{Math.round(CONFIG.luck.goldBonus * 100)}%・核＋{Math.round(CONFIG.luck.coreBonus * 100)}%
            </div>
            <span className="luck-max">運極</span>
          </div>
        </div>
      )}
      <button className="back" onClick={() => go({ name: 'box' })}>
        ← BOXに戻る
      </button>

      <section className="card center">
        <div className={evolved ? 'evolve-flash' : ''} key={evolved}>
          <MonsterImage imageId={imageOf(def, mon.nodeId)} awaken={awakenOf(def, mon.nodeId)} size={200} plus={mon.plus} shiny={mon.shiny} />
        </div>
        <h1 className="title">{plusName(def, mon)}</h1>
        <Stars def={def} nodeId={mon.nodeId} />
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

        </p>
        {partnerSlot && <span className="badge">「{slotName(partnerSlot)}」の相棒</span>}
      </section>

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
                  <MonsterImage imageId={imageOf(def, nextId)} awaken={awakenOf(def, nextId)} silhouette size={72} />
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
                      <button
                        className="btn primary small"
                        disabled={state.gold < cost.gold || (state.cores[nextAttr] ?? 0) < (cost.cores ?? 0)}
                        onClick={() => doEvolve(nextId)}
                      >
                        進化する（{cost.gold}G{cost.cores ? `・${CORE_LABEL[nextAttr]}×${cost.cores}` : ''}）
                      </button>
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
                            <span className="small muted">手持ち：万能 {state.anyExp}（腹筋ローラーで貯まる）</span>
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
            所持 {state.gold}G。購入EXPで埋められるのは必要EXPの{Math.round(CONFIG.shop.boughtExpMaxRatio * 100)}
            %までです。
            {branching && '選ばなかった進化先に注いだEXPは、進化したときに戻ってきます。'}
          </p>
        </section>
      ) : null}

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
          {Math.round(CONFIG.luck.goldBonus * 100)}%、核が落ちる確率＋{Math.round(CONFIG.luck.coreBonus * 100)}%。
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
                feedLuck(
                  id,
                  luckPicked.map((f) => f.id),
                )
                setConfirmAllLuck(false)
                // この食べさせで運極になったら、お祝いの演出
                if (luckOf(mon) + luckGain >= CONFIG.luck.max) setLuckMaxNow(true)
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
            レシピの2体が条件を満たしたら、合わせて隠しモンスターを生めます（{CONFIG.jogress.gold}
            G、2体はいなくなります。図鑑の発見は残ります）。
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
                        disabled={state.gold < CONFIG.jogress.gold || (state.cores.none ?? 0) < CONFIG.jogress.cores}
                        onClick={() => {
                          const newId = jogress(id, partner.id, hidden.id)
                          setPartnerKey(null)
                          if (newId) {
                            navigator.vibrate?.([120, 60, 120, 60, 320])
                            setBorn({ def: hidden, id: newId })
                          }
                        }}
                      >
                        本当にジョグレスする（{CONFIG.jogress.gold}G・{CORE_LABEL.none}×{CONFIG.jogress.cores}）
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
