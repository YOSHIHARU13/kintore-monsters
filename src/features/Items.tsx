import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { BALL_LABEL, CORE_KEYS, CORE_LABEL, STONE_LABEL, ballsOf, coresOf, stonesOf } from '../lib/cores'
import { ELEMENTS, ELEMENT_COLOR } from '../lib/element'
import { ATTR_COLOR, type Go } from '../nav'

/** 所持アイテム：進化素材の数。余った結晶・核はトク玉と交換できる */
export function Items({ go }: { go: Go }) {
  const { state, exchangeMaterial } = useStore()
  const ex = CONFIG.materials.eggExchange
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'more' })}>
        ← その他に戻る
      </button>
      <h1 className="title">所持アイテム</h1>

      <section className="card">
        <ul className="mini-list">
          <li>
            <span>🔮 オーブ</span>
            <strong className="num">{state.gold.toLocaleString()}</strong>
          </li>
          <li>
            <span>🪙 進化コイン</span>
            <strong className="num">{(state.coins ?? 0).toLocaleString()}</strong>
          </li>
          <li>
            <span>🟡 トク玉</span>
            <strong className="num">{state.eggs}</strong>
          </li>
          <li>
            <span>🟣 {BALL_LABEL}</span>
            <strong className="num">{ballsOf(state)}</strong>
          </li>
        </ul>
        <p className="muted small">{BALL_LABEL}は★2→★3の進化とジョグレスに使います（闇の素材クエストで落ちる）。</p>
      </section>

      <section className="card">
        <h2>💠 属性の結晶</h2>
        <p className="muted small">進化に使います（そのモンスターの属性の結晶）。{ex.stone}個でトク玉1個と交換できます。</p>
        <ul className="mini-list">
          {ELEMENTS.map((e) => (
            <li key={e}>
              <span style={{ color: ELEMENT_COLOR[e] }}>
                {STONE_LABEL(e)} <strong className="num">{stonesOf(state, e)}</strong>
              </span>
              <button className="btn small" disabled={stonesOf(state, e) < ex.stone} onClick={() => exchangeMaterial('stone', e)}>
                ×{ex.stone} → トク玉
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>💎 部位の核</h2>
        <p className="muted small">★2→★3からの進化に使います（進化先の部位の核）。{ex.muscle}個でトク玉1個と交換できます。</p>
        <ul className="mini-list">
          {CORE_KEYS.map((k) => (
            <li key={k}>
              <span style={{ color: ATTR_COLOR[k] }}>
                {CORE_LABEL[k]} <strong className="num">{coresOf(state, k)}</strong>
              </span>
              <button className="btn small" disabled={coresOf(state, k) < ex.muscle} onClick={() => exchangeMaterial('muscle', k)}>
                ×{ex.muscle} → トク玉
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
