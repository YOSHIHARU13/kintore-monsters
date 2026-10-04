import { useState } from 'react'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, type Attr } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { Stepper } from '../components/Stepper'
import { MonsterImage } from '../components/MonsterImage'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName, type MonsterDef } from '../types'

type Hatched = { def: MonsterDef; monsterId: string }

export function Shop({ go }: { go: Go }) {
  const { state, defs, buyEgg, hatchEgg, buyExp } = useStore()
  const [attr, setAttr] = useState<Attr>('chestArms')
  const [amount, setAmount] = useState(CONFIG.shop.expBuyStep)
  const [hatched, setHatched] = useState<Hatched | null>(null)

  const canBuyEgg = state.gold >= CONFIG.shop.eggPrice && defs.length > 0
  const canHatch = state.eggs > 0 && defs.length > 0
  const expCost = amount * CONFIG.shop.goldPerExp
  const maxAmount = Math.max(
    CONFIG.shop.expBuyStep,
    Math.floor(state.gold / CONFIG.shop.goldPerExp / CONFIG.shop.expBuyStep) * CONFIG.shop.expBuyStep,
  )

  return (
    <div className="page">
      <h1 className="title">ショップ</h1>
      <p className="gold">所持 {state.gold}G</p>

      <section className="card">
        <h2>タマゴ</h2>
        <p className="muted small">
          登録済みのモンスター（{defs.length}種）から、ランダムで1体生まれます。ダブりあり。同じモンスターを別の進化先に育てて、図鑑を埋められます。
        </p>
        <p>
          手持ちのタマゴ：<strong>{state.eggs}個</strong>
        </p>
        <button className="btn primary wide" disabled={!canHatch} onClick={() => setHatched(hatchEgg())}>
          タマゴを孵す
        </button>
        <button className="btn wide" disabled={!canBuyEgg} onClick={buyEgg}>
          タマゴを買う（{CONFIG.shop.eggPrice}G）
        </button>
        {defs.length === 0 && (
          <p className="warn small">生まれるモンスターがいません。図鑑で新しいモンスターを登録してください。</p>
        )}
      </section>

      <section className="card">
        <h2>EXPを買う</h2>
        <p className="muted small">
          {CONFIG.shop.goldPerExp}G＝1EXP。購入EXPは、各進化に必要なEXPの
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
        <button className="btn primary wide" disabled={state.gold < expCost} onClick={() => buyExp(attr, amount)}>
          {ATTR_LABEL[attr]}EXP {amount} を買う（{expCost}G）
        </button>
        <p className="small muted">
          手持ちの購入EXP：{ATTRS.map((a) => `${ATTR_LABEL[a]} ${state.exp[a].bought}`).join('／')}
        </p>
      </section>

      {hatched && (
        <div className="beat-overlay" onClick={() => setHatched(null)}>
          <div className="beat-burst" />
          <div className="beat-text">
            <MonsterImage imageId={hatched.def.images[FIRST_NODE_ID]} size={180} />
            <div className="beat-title">{monsterName(hatched.def, FIRST_NODE_ID)}</div>
            <div className="beat-sub">が生まれた！</div>
            <button
              className="btn primary"
              onClick={(e) => {
                e.stopPropagation()
                go({ name: 'monster', id: hatched.monsterId })
              }}
            >
              会いに行く
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
