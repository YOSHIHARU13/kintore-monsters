import { useState } from 'react'
import { useStore } from '../store'
import { ATTR_LABEL } from '../data/exercises'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { CONFIG } from '../config/gameConfig'
import { boughtCap, evolutionCost, isExpFull, planPour } from '../lib/evolution'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { investedFor, monsterName, nodeAttr } from '../types'

export function MonsterDetail({ id, go }: { id: string; go: Go }) {
  const { owned, defs, state, pourExp, evolve, setActive } = useStore()
  const [evolved, setEvolved] = useState(0)
  const mon = owned.find((o) => o.id === id)
  const def = defs.find((d) => d.id === id)

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
          <MonsterImage imageId={def.images[mon.nodeId]} size={200} />
        </div>
        <h1 className="title">{monsterName(def, mon.nodeId)}</h1>
        <p style={{ color: ATTR_COLOR[attr] }}>
          {ATTR_LABEL[attr]}属性・{node.label}
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
              const wallet = state.exp[nextAttr]
              const invested = investedFor(mon, nextId, node.next[0])
              const total = invested.trained + invested.bought
              const pour = planPour(cost, invested, wallet)
              const pourTotal = pour.trained + pour.bought
              const full = isExpFull(cost, invested)
              return (
                <div key={nextId} className="route">
                  <MonsterImage imageId={def.images[nextId]} silhouette size={72} />
                  <div className="route-body">
                    <strong style={{ color: ATTR_COLOR[nextAttr] }}>{ATTR_LABEL[nextAttr]}EXPで進化</strong>
                    <div className="gauge-row">
                      <Gauge value={total} max={cost.exp} color={ATTR_COLOR[nextAttr]} />
                      <span className="num">
                        {total}/{cost.exp}
                      </span>
                    </div>
                    <span className="small muted">
                      手持ち：筋トレ {wallet.trained}／購入 {wallet.bought}（購入分は {invested.bought}/
                      {boughtCap(cost)} まで）
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
                      <button className="btn small" disabled={pourTotal <= 0} onClick={() => pourExp(id, nextId)}>
                        {pourTotal > 0
                          ? `EXPを注ぐ（+${pourTotal}${pour.bought > 0 ? `・うち購入 ${pour.bought}` : ''}）`
                          : wallet.bought > 0
                            ? '残りは筋トレEXPが必要'
                            : '注げるEXPがありません'}
                      </button>
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
    </div>
  )
}
