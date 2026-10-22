import { useState } from 'react'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, FORM_ATTR_LABEL, type Attr } from '../data/exercises'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { CONFIG } from '../config/gameConfig'
import { boughtCap, evolutionCost, fusionCost, isExpFull, planPour } from '../lib/evolution'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { investedFor, nodeAttr, plusName } from '../types'

export function MonsterDetail({ id, go }: { id: string; go: Go }) {
  const { owned, defs, state, pourExp, evolve, fuse, setActive } = useStore()
  const [evolved, setEvolved] = useState(0)
  const [foodId, setFoodId] = useState<string | null>(null)
  const mon = owned.find((o) => o.id === id)
  const def = mon && defs.find((d) => d.id === mon.defId)

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
  const plus = mon.plus ?? 0
  const fuseCost = fusionCost(plus)
  // 食べさせられるのは同じモンスターの別の個体
  const foods = owned.filter((o) => o.defId === mon.defId && o.id !== mon.id)

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
          <MonsterImage imageId={def.images[mon.nodeId]} size={200} plus={mon.plus} />
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
        {fuseCost === null ? (
          <p className="muted">＋{CONFIG.fusion.maxPlus}に到達！ これ以上は合体できません。</p>
        ) : (
          <>
            <p className="muted small">
              同じモンスターを食べさせると＋1。＋が上がるほど枠が豪華になります（銅→銀→金→金の光→虹）。食べさせた側は
              いなくなりますが、注いでいたEXPは財布に戻り、図鑑の発見も消えません。
            </p>
            {foods.length === 0 ? (
              <p className="muted small">食べさせられる{def.name}がいません。タマゴでダブったら合体できます。</p>
            ) : (
              <ul className="mini-list">
                {foods.map((food) => (
                  <li key={food.id}>
                    <span className="monster-row">
                      <MonsterImage imageId={def.images[food.nodeId]} size={48} plus={food.plus} />
                      {plusName(def, food)}・{getNode(template, food.nodeId).stage}段階
                    </span>
                    {foodId === food.id ? (
                      <button
                        className="btn primary small"
                        disabled={state.gold < fuseCost}
                        onClick={() => {
                          fuse(id, food.id)
                          setFoodId(null)
                          setEvolved(Date.now())
                          navigator.vibrate?.([60, 40, 200])
                        }}
                      >
                        本当に食べさせる（{fuseCost}G）
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
            <p className="muted small">
              ＋{plus + 1}にするのに {fuseCost}G（所持 {state.gold}G）
            </p>
          </>
        )}
      </section>
    </div>
  )
}
