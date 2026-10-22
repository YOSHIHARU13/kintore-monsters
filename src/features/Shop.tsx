import { useState } from 'react'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, type Attr } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { Stepper } from '../components/Stepper'
import { MonsterImage } from '../components/MonsterImage'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { ATTR_COLOR, type Go } from '../nav'
import { monsterName } from '../types'
import { HatchReveal, type Hatched } from '../components/HatchReveal'
import { Stars } from '../components/Stars'
import { GachaBanner, featuredOf } from '../components/GachaBanner'
import { isReady, percent, pickupCount, rarityOf, rateTable, tierRates } from '../lib/gacha'


export function Shop({ go }: { go: Go }) {
  const { state, defs, owned, gachas, buyEgg, hatchEgg, buyExp } = useStore()
  const [attr, setAttr] = useState<Attr>('chestArms')
  const [amount, setAmount] = useState(CONFIG.shop.expBuyStep)
  const [hatched, setHatched] = useState<Hatched | null>(null)
  const [gachaId, setGachaId] = useState(() => {
    // 最初は、中身がいるガチャのうち、いちばん新しいものを選んでおく
    const withMembers = gachas.filter((g) => isReady(g, rateTable(g.id, defs)))
    return (withMembers[withMembers.length - 1] ?? gachas[0]).id
  })

  const gacha = gachas.find((g) => g.id === gachaId) ?? gachas[0]
  const table = rateTable(gacha.id, defs)
  const hasPityTier = table.some((t) => t.rarity === CONFIG.gacha.pity.rarity)
  const pityLeft = CONFIG.gacha.pity.pulls - (state.pity[gacha.id] ?? 0)
  const met = (defId: string) => owned.some((o) => o.defId === defId) || (state.dexFound[defId]?.length ?? 0) > 0
  const anyEggDefs = gachas.some((g) => rateTable(g.id, defs).length > 0)
  const canBuyEgg = state.gold >= CONFIG.shop.eggPrice && anyEggDefs
  const ready = isReady(gacha, table)
  const canHatch = state.eggs > 0 && ready
  const hatch = () => {
    const result = hatchEgg(gacha.id)
    if (result) setHatched({ ...result, rarity: rarityOf(result.def) })
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
              count={rateTable(g.id, defs).length}
              featured={featuredOf(g, rateTable(g.id, defs))}
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
        {!ready ? (
          <p className="warn small">
            {gacha.builtin
              ? 'このガチャにはまだモンスターがいません。図鑑でモンスターを登録してください。'
              : `準備中：ピックアップ（レア以上）があと${CONFIG.gacha.minPickups - pickupCount(table)}体そろうと引けます。「編集」から選べます。`}
          </p>
        ) : (
          <>
            <button className="btn primary wide" disabled={!canHatch} onClick={hatch}>
              「{gacha.name}」を引く（タマゴ1個）
            </button>
            {hasPityTier && (
              <p className="small center bonus-reward">
                {CONFIG.gacha.rarities[CONFIG.gacha.pity.rarity].label}確定まで あと{pityLeft}回
              </p>
            )}
            <h3 className="small">提供割合（✨色違い 1/{Math.round(1 / gacha.shinyRate)}）</h3>
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
                          <MonsterImage imageId={def.images[FIRST_NODE_ID]} silhouette={!met(def.id)} size={40} />
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
