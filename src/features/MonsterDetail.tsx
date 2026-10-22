import { useState } from 'react'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, FORM_ATTR_LABEL, type Attr } from '../data/exercises'
import { FIRST_NODE_ID, getNode, getTemplate } from '../data/evolutionTemplates'
import { CONFIG } from '../config/gameConfig'
import { boughtCap, evolutionCost, fusionCost, isExpFull, planPour } from '../lib/evolution'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { investedFor, isHidden, monsterName, nodeAttr, plusName, type MonsterDef, type OwnedMonster } from '../types'

export function MonsterDetail({ id, go }: { id: string; go: Go }) {
  const { owned, defs, state, pourExp, pourPlusExp, evolve, fuse, jogress, setActive } = useStore()
  const [evolved, setEvolved] = useState(0)
  const [foodId, setFoodId] = useState<string | null>(null)
  const [partnerKey, setPartnerKey] = useState<string | null>(null)
  const [born, setBorn] = useState<{ def: MonsterDef; id: string } | null>(null)
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
          <MonsterImage imageId={born.def.images[FIRST_NODE_ID]} size={180} />
          <div className="beat-title">{monsterName(born.def, FIRST_NODE_ID)}</div>
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
  const cost = node.next.length > 0 ? evolutionCost(node.stage) : null
  const attr = nodeAttr(def, mon.nodeId)
  const branching = node.next.length > 1
  const isFinal = node.next.length === 0
  const plus = mon.plus ?? 0
  const fuseCost = fusionCost(plus)
  const plusExp = mon.plusExp ?? { trained: 0, bought: 0 }
  const plusFull = fuseCost !== null && isExpFull(fuseCost, plusExp)
  // 食べさせられるのは同じモンスターの別の個体（段階は問わない）
  const foods = owned.filter((o) => o.defId === mon.defId && o.id !== mon.id)
  const isMax = isFinal && plus >= CONFIG.fusion.maxPlus
  const isFinalOf = (o: OwnedMonster) => {
    const d = defs.find((x) => x.id === o.defId)
    return !!d && getNode(getTemplate(d.templateId), o.nodeId).next.length === 0
  }
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
        partners: owned.filter(
          (o) => o.defId === partnerDefId && o.id !== mon.id && (o.plus ?? 0) >= CONFIG.fusion.maxPlus && isFinalOf(o),
        ),
      }
    })
  const attrSources: Attr[] = attr === 'none' ? ATTRS : [attr]

  const doEvolve = (toNodeId: string) => {
    evolve(id, toNodeId)
    setEvolved(Date.now())
    navigator.vibrate?.([60, 40, 60, 40, 200])
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'box' })}>
        ← BOXに戻る
      </button>

      <section className="card center">
        <div className={evolved ? 'evolve-flash' : ''} key={evolved}>
          <MonsterImage imageId={def.images[mon.nodeId]} size={200} plus={mon.plus} shiny={mon.shiny} />
        </div>
        <h1 className="title">{plusName(def, mon)}</h1>
        <p style={{ color: ATTR_COLOR[attr] }}>
          {FORM_ATTR_LABEL[attr]}属性・{node.label}
        </p>
        <p className="muted small">{template.name}</p>
        {state.activeMonsterId === id ? (
          <span className="badge">育成中</span>
        ) : (
          <button className="btn small" onClick={() => setActive(id)}>
            育成中にする
          </button>
        )}
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
                  <MonsterImage imageId={def.images[nextId]} silhouette size={72} />
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
                        disabled={state.gold < cost.gold}
                        onClick={() => doEvolve(nextId)}
                      >
                        進化する（{cost.gold}G）
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
      ) : (
        <section className="card center">
          <h2>最終段階</h2>
          <p className="muted">これ以上は進化しません。おつかれさま！</p>
        </section>
      )}

      <section className="card">
        <h2>
          合体（＋{plus}／{CONFIG.fusion.maxPlus}）
        </h2>
        {!isFinal ? (
          <p className="muted small">
            最終形態まで進化すると、同じモンスターを食べさせて＋を上げられます（最大＋{CONFIG.fusion.maxPlus}
            、＋が上がるほど枠が豪華に）。食べさせる側は進化していなくてもOK。いま食べさせられる{def.name}：{foods.length}体
          </p>
        ) : fuseCost === null ? (
          <p>＋{CONFIG.fusion.maxPlus}に到達！ 枠が虹色になりました。</p>
        ) : (
          <>
            <p className="muted small">
              ①EXPを注いでゲージを満タンに → ②同じモンスターを食べさせて＋1（{fuseCost.gold}G）。食べさせた側は
              いなくなりますが、注いでいたEXPは財布に戻り、図鑑の発見も消えません。
            </p>
            <div className="gauge-row">
              <span>＋{plus + 1}まで</span>
              <Gauge value={plusExp.trained + plusExp.bought} max={fuseCost.exp} color={ATTR_COLOR[attr]} />
              <span className="num">
                {plusExp.trained + plusExp.bought}/{fuseCost.exp}
              </span>
            </div>
            {!plusFull ? (
              <>
                {attrSources.map((src) => {
                  const pour = planPour(fuseCost, plusExp, state.exp[src])
                  const total = pour.trained + pour.bought
                  return (
                    <button key={src} className="btn small" disabled={total <= 0} onClick={() => pourPlusExp(id, src)}>
                      {total > 0 ? `${ATTR_LABEL[src]}EXPを注ぐ（+${total}）` : `${ATTR_LABEL[src]}EXPが足りません`}
                    </button>
                  )
                })}
                {(() => {
                  const pour = planPour(fuseCost, plusExp, { trained: state.anyExp, bought: 0 })
                  return (
                    <button className="btn small" disabled={pour.trained <= 0} onClick={() => pourPlusExp(id, 'any')}>
                      {pour.trained > 0 ? `万能EXPを注ぐ（+${pour.trained}）` : '万能EXPがありません'}
                    </button>
                  )
                })()}
              </>
            ) : foods.length === 0 ? (
              <p className="muted small">ゲージは満タン！ あとは食べさせる{def.name}がいれば＋1。タマゴでダブりを狙おう。</p>
            ) : (
              <ul className="mini-list">
                {foods.map((food) => (
                  <li key={food.id}>
                    <span className="monster-row">
                      <MonsterImage imageId={def.images[food.nodeId]} size={48} plus={food.plus} shiny={food.shiny} />
                      {plusName(def, food)}・{getNode(template, food.nodeId).stage}段階
                    </span>
                    {foodId === food.id ? (
                      <button
                        className="btn primary small"
                        disabled={state.gold < fuseCost.gold}
                        onClick={() => {
                          fuse(id, food.id)
                          setFoodId(null)
                          setEvolved(Date.now())
                          navigator.vibrate?.([60, 40, 200])
                        }}
                      >
                        本当に食べさせる（{fuseCost.gold}G）
                      </button>
                    ) : (
                      <button className="btn small" onClick={() => setFoodId(food.id)}>
                        食べさせる
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {recipes.length > 0 && (
        <section className="card">
          <h2>ジョグレス</h2>
          <p className="muted small">
            最終形態の＋{CONFIG.fusion.maxPlus}どうしを合わせると、隠しモンスターが生まれます（{CONFIG.jogress.gold}
            G、2体はいなくなります。図鑑の発見は残ります）。
          </p>
          <ul className="mini-list">
            {recipes.map(({ hidden, met, partnerDef, partners }) => (
              <li key={hidden.id} className="jogress">
                <span>
                  {met ? hidden.name : '？？？'} ← {def.name}＋{CONFIG.fusion.maxPlus} ＆ {partnerDef?.name ?? '？？？'}＋
                  {CONFIG.fusion.maxPlus}
                </span>
                {!isMax ? (
                  <span className="muted small">このモンスターを最終形態の＋{CONFIG.fusion.maxPlus}にしよう</span>
                ) : partners.length === 0 ? (
                  <span className="muted small">
                    相手の{partnerDef?.name ?? '？？？'}（最終形態の＋{CONFIG.fusion.maxPlus}）がいません
                  </span>
                ) : (
                  partners.map((partner) => {
                    const key = `${hidden.id}:${partner.id}`
                    return partnerKey === key ? (
                      <button
                        key={key}
                        className="btn primary small"
                        disabled={state.gold < CONFIG.jogress.gold}
                        onClick={() => {
                          const newId = jogress(id, partner.id, hidden.id)
                          setPartnerKey(null)
                          if (newId) {
                            navigator.vibrate?.([120, 60, 120, 60, 320])
                            setBorn({ def: hidden, id: newId })
                          }
                        }}
                      >
                        本当にジョグレスする（{CONFIG.jogress.gold}G）
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
        </section>
      )}
    </div>
  )
}
