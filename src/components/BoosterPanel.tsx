import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { BOOSTER_KEYS, boostActive, boosterName } from '../lib/boosters'

/** ブースター：持っている数・使用中か・使う・買う。compact ならホーム用に、持っているか使用中のものだけ */
export function BoosterPanel({ compact = false }: { compact?: boolean }) {
  const { state, buyBooster, useBooster } = useStore()
  const keys = compact
    ? BOOSTER_KEYS.filter((k) => (state.boosters?.[k] ?? 0) > 0 || boostActive(state, k))
    : BOOSTER_KEYS
  if (keys.length === 0) return null

  return (
    <section className="card">
      <h2>⚡ ブースター</h2>
      <ul className="mini-list">
        {keys.map((k) => {
          const b = CONFIG.boosters[k]
          const have = state.boosters?.[k] ?? 0
          const active = boostActive(state, k)
          return (
            <li key={k}>
              <span>
                <strong>{boosterName(state, k)}</strong> ×{have}
                <br />
                <span className="muted small">{b.text}</span>
                {active && (
                  <span className="tag keep small">
                    {' '}
                    使用中{k === 'exp' ? `（のこり${state.boosts.expSets}セット）` : ''}
                  </span>
                )}
              </span>
              <span className="row">
                <button className="btn small primary" disabled={have < 1 || active} onClick={() => useBooster(k)}>
                  使う
                </button>
                {!compact && (
                  <button className="btn small" disabled={state.coins < b.coinPrice} onClick={() => buyBooster(k)}>
                    🪙{b.coinPrice}
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {!compact && <p className="muted small">使うと次の1回だけ効きます（筋トレは次の{CONFIG.boosters.exp.sets}セット）。期限はありません。同じ種類は重ねて使えません。</p>}
    </section>
  )
}
