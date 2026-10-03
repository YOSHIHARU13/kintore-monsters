import { useState } from 'react'
import { useStore } from '../store'
import { ATTR_LABEL } from '../data/exercises'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { CONFIG } from '../config/gameConfig'
import { boughtCap, evolutionCost, isExpFull, planPour } from '../lib/evolution'
import { Gauge } from '../components/Gauge'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName } from '../types'

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
  const wallet = state.exp[def.attr]
  const invested = mon.invested.trained + mon.invested.bought
  const pour = cost ? planPour(cost, mon.invested, wallet) : { trained: 0, bought: 0 }
  const pourTotal = pour.trained + pour.bought
  const full = cost ? isExpFull(cost, mon.invested) : false

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
        <p style={{ color: ATTR_COLOR[def.attr] }}>
          {ATTR_LABEL[def.attr]}属性・{node.label}
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
          <h2>次の進化</h2>
          <div className="gauge-row">
            <span>EXP</span>
            <Gauge value={invested} max={cost.exp} color={ATTR_COLOR[def.attr]} />
            <span className="num">
              {invested}/{cost.exp}
            </span>
          </div>
          <p className="muted small">
            うち購入EXP {mon.invested.bought}/{boughtCap(cost)}（購入分は必要EXPの
            {Math.round(CONFIG.shop.boughtExpMaxRatio * 100)}%まで）
          </p>
          <p className="small">
            手持ちの{ATTR_LABEL[def.attr]}EXP：筋トレ {wallet.trained}／購入 {wallet.bought}
          </p>

          {!full && (
            <button className="btn primary wide" disabled={pourTotal <= 0} onClick={() => pourExp(id)}>
              {pourTotal > 0
                ? `EXPを注ぐ（+${pourTotal}${pour.bought > 0 ? `・うち購入 ${pour.bought}` : ''}）`
                : '注げるEXPがありません'}
            </button>
          )}
          {!full && pourTotal <= 0 && wallet.bought > 0 && (
            <p className="warn small">購入EXPは上限に達しています。残りは筋トレで稼いだEXPが必要です。</p>
          )}

          <div className="routes">
            {node.next.map((nextId, index) => {
              const next = getNode(template, nextId)
              const needStone = index > 0
              const canEvolve =
                full && state.gold >= cost.gold && (!needStone || state.stones >= CONFIG.stone.branchCost)
              return (
                <div key={nextId} className="route">
                  <MonsterImage imageId={def.images[nextId]} silhouette size={72} />
                  <div className="route-body">
                    <strong>{needStone ? '分岐ルート' : node.next.length > 1 ? '通常ルート' : '進化先'}</strong>
                    <span className="small muted">{next.label}</span>
                    <span className="small">
                      {cost.gold}G{needStone ? ` ＋ 進化の石${CONFIG.stone.branchCost}個` : ''}
                    </span>
                    <button className="btn primary small" disabled={!canEvolve} onClick={() => doEvolve(nextId)}>
                      進化する
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="muted small">
            所持：{state.gold}G／進化の石 {state.stones}個
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
