import { useState } from 'react'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, type Attr } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { Stepper } from '../components/Stepper'
import { MonsterImage } from '../components/MonsterImage'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName, type MonsterDef, type RarityKey } from '../types'
import { GachaBanner } from '../components/GachaBanner'
import { percent, rarityOf, rateTable } from '../lib/gacha'

type Hatched = { def: MonsterDef; monsterId: string; shiny: boolean; rarity: RarityKey }

export function Shop({ go }: { go: Go }) {
  const { state, defs, owned, gachas, buyEgg, hatchEgg, buyExp } = useStore()
  const [attr, setAttr] = useState<Attr>('chestArms')
  const [amount, setAmount] = useState(CONFIG.shop.expBuyStep)
  const [hatched, setHatched] = useState<Hatched | null>(null)
  const [gachaId, setGachaId] = useState(() => {
    // 最初は、中身がいるガチャのうち、いちばん新しいものを選んでおく
    const withMembers = gachas.filter((g) => rateTable(g, defs).length > 0)
    return (withMembers[withMembers.length - 1] ?? gachas[0]).id
  })

  const gacha = gachas.find((g) => g.id === gachaId) ?? gachas[0]
  const table = rateTable(gacha, defs)
  const met = (defId: string) => owned.some((o) => o.defId === defId) || (state.dexFound[defId]?.length ?? 0) > 0
  const anyEggDefs = gachas.some((g) => rateTable(g, defs).length > 0)
  const canBuyEgg = state.gold >= CONFIG.shop.eggPrice && anyEggDefs
  const canHatch = state.eggs > 0 && table.length > 0
  const hatch = () => {
    const result = hatchEgg(gacha.id)
    if (result) setHatched({ ...result, rarity: result.def.common ? 'normal' : rarityOf(gacha, result.def.id) })
  }
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
        <h2>ガチャ</h2>
        <p>
          手持ちのタマゴ：<strong>{state.eggs}個</strong>
          <span className="muted small">（タマゴ1個で1回引けます）</span>
        </p>
        <button className="btn wide" disabled={!canBuyEgg} onClick={buyEgg}>
          タマゴを買う（{CONFIG.shop.eggPrice}G）
        </button>
        <div className="gacha-list">
          {gachas.map((g) => (
            <GachaBanner
              key={g.id}
              gacha={g}
              count={rateTable(g, defs).length}
              selected={g.id === gacha.id}
              onClick={() => setGachaId(g.id)}
            />
          ))}
        </div>
        <button className="btn small" onClick={() => go({ name: 'gachaForm' })}>
          ＋ ガチャを作る
        </button>
      </section>

      <section className="card">
        <div className="part-head">
          <h2>{gacha.name}</h2>
          <button className="btn small" onClick={() => go({ name: 'gachaForm', id: gacha.id })}>
            編集
          </button>
        </div>
        {table.length === 0 ? (
          <p className="warn small">
            このガチャにはまだモンスターがいません。図鑑の登録画面で、モンスターをこのガチャに入れてください。
          </p>
        ) : (
          <>
            <button className="btn primary wide" disabled={!canHatch} onClick={hatch}>
              「{gacha.name}」を引く（タマゴ1個）
            </button>
            <h3 className="small">提供割合（✨色違い 1/{Math.round(1 / gacha.shinyRate)}）</h3>
            <ul className="mini-list">
              {[...table]
                .sort((a, b) => a.rate - b.rate)
                .map(({ def, rarity, rate }) => (
                  <li key={def.id}>
                    <span className="monster-row">
                      <MonsterImage imageId={def.images[FIRST_NODE_ID]} silhouette={!met(def.id)} size={40} />
                      {met(def.id) ? monsterName(def, FIRST_NODE_ID) : '？？？'}
                    </span>
                    <span className={`tag rarity-${def.common ? 'common' : rarity}`}>
                      {def.common ? 'ハズレ枠' : CONFIG.gacha.rarities[rarity].label} {percent(rate)}
                    </span>
                  </li>
                ))}
            </ul>
          </>
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
        <div
          className={`beat-overlay${hatched.shiny || hatched.rarity === 'superRare' ? ' clear-overlay' : ''}`}
          onClick={() => setHatched(null)}
        >
          <div className="beat-burst" />
          {(hatched.shiny || hatched.rarity === 'superRare') && <div className="beat-burst reverse" />}
          {(hatched.shiny || hatched.rarity === 'superRare') &&
            Array.from({ length: 42 }, (_, i) => <i key={i} className="spark" style={{ ['--i' as string]: i }} />)}
          <div className="beat-text">
            {hatched.shiny && <div className="beat-title">✨ 色違い！！ ✨</div>}
            {!hatched.def.common && hatched.rarity !== 'normal' && (
              <div className={`beat-title rarity-${hatched.rarity}`}>{CONFIG.gacha.rarities[hatched.rarity].label}！</div>
            )}
            <MonsterImage imageId={hatched.def.images[FIRST_NODE_ID]} size={180} shiny={hatched.shiny} />
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
