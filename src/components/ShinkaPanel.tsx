import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { protectedIds } from '../lib/fusion'
import { SHINKA_LABEL, canShinka, canShinkaDef, recipeHave, shinkaRecipe, shinkaTierOf } from '../lib/shinka'
import { getNode, getTemplate } from '../data/evolutionTemplates'
import { awakenOf, glowOf, imageOf } from '../lib/art'
import { bannerNodeOf } from './GachaBanner'
import { MonsterImage } from './MonsterImage'
import type { MonsterDef, OwnedMonster } from '../types'

/** 獣神化（★4）：レシピの降臨の運を集めて★4に。合体の相手がいれば、金の獣神化も */
export function ShinkaPanel({ mon, def, onDone }: { mon: OwnedMonster; def: MonsterDef; onDone: (gold: boolean) => void }) {
  const { state, owned, defs, today, shinka } = useStore()
  if (!canShinkaDef(def)) return null
  const tier = shinkaTierOf(mon, def)
  const keep = new Set([...protectedIds(state, today, owned), mon.id])
  const recipe = shinkaRecipe(def, defs)
  const rows = recipe.map((item) => {
    const d = defs.find((x) => x.id === item.defId)
    const have = recipeHave(item, owned, keep)
    return { item, d, have, need: item.count * item.luck }
  })
  const enough = rows.every((r) => r.have >= r.need) && (state.coins ?? 0) >= CONFIG.shinka.coins
  const partner = def.jogressPartner ? defs.find((d) => d.id === def.jogressPartner) : undefined
  const partnerReady = owned.some((o) => {
    if (o.defId !== def.jogressPartner || keep.has(o.id)) return false
    const pd = defs.find((d) => d.id === o.defId)
    return !!pd && getNode(getTemplate(pd.templateId), o.nodeId).next.length === 0
  })
  const ready = canShinka(mon, def)
  const run = (gold: boolean) => {
    if (shinka(mon.id, gold)) {
      onDone(gold)
    }
  }
  return (
    <section className="card shinka-card">
      <h2>{tier ? `${SHINKA_LABEL[tier]}（★4）` : '🌟 獣神化（★4へ）'}</h2>
      {tier ? (
        <p className="small">獣神化したモンスターです。★4になり、攻撃力が上がっています。</p>
      ) : (
        <>
          <p className="muted small">
            {ready ? '' : '最終形態まで育てると獣神化できます。'}素材（このモンスターだけのレシピ）：降臨の運を合わせて使います。余った運のモンスターはBOXに残ります。🪙
            {CONFIG.shinka.coins}
          </p>
          {rows.length === 0 ? (
            <p className="warn small">素材になる降臨モンスターがまだ登録されていません。</p>
          ) : (
            <ul className="mini-list">
              {rows.map(({ item, d, have, need }) => (
                <li key={item.defId}>
                  <span className="monster-row">
                    {d && <MonsterImage imageId={imageOf(d, bannerNodeOf(d))} awaken={awakenOf(d, bannerNodeOf(d))} glow={glowOf(d)} size={36} />}
                    <span>
                      {d?.name ?? '？'} 運{item.luck}（{item.luck}体ぶん）
                    </span>
                  </span>
                  <span className={have >= need ? 'tag keep' : 'error small'}>
                    運 {have}/{need}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button className="btn primary wide" disabled={!ready || !enough || rows.length === 0} onClick={() => run(false)}>
            {def.images.shinka ? SHINKA_LABEL.silver : SHINKA_LABEL.bronze}する
          </button>
          {partner && (
            <>
              <p className="small">
                {SHINKA_LABEL.gold}：上の素材に加えて、{partner.name}（最終形態）1体と合体します{partnerReady ? '' : '（まだいません）'}
              </p>
              <button className="btn wide" disabled={!ready || !enough || !partnerReady} onClick={() => run(true)}>
                {partner.name}と合体して、{SHINKA_LABEL.gold}する
              </button>
            </>
          )}
        </>
      )}
    </section>
  )
}
