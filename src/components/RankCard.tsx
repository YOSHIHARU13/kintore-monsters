import { useState } from 'react'
import { useStore } from '../store'
import { pendingRanks, playerRankOf, rankExpOf, rankReward } from '../lib/rank'
import { Gauge } from './Gauge'

/** プレイヤーランク：筋トレの積み上げ。上がるたびに卵（たまっていれば、まとめて受け取る） */
export function RankCard() {
  const { state, claimRanks } = useStore()
  const [got, setGot] = useState<number | null>(null)
  const { rank, into, need } = playerRankOf(rankExpOf(state))
  const pending = pendingRanks(state)
  const eggs = pending.reduce((sum, r) => sum + (rankReward(r).eggs ?? 0), 0)
  return (
    <section className="card rank-card">
      <div className="part-head">
        <h2>🏅 ランク {rank}</h2>
        <span className="muted small">次まで {(need - into).toLocaleString()}EXP</span>
      </div>
      <Gauge value={into} max={need} color="#ffd166" />
      {pending.length > 0 && (
        <button className="btn primary wide" onClick={() => setGot(claimRanks())}>
          🎉 ランクアップ報酬（{pending.length > 1 ? `ランク${pending[0]}〜${pending[pending.length - 1]}` : `ランク${pending[0]}`}
          ）🥚卵×{eggs} を受け取る
        </button>
      )}
      {got !== null && pending.length === 0 && <div className="result keep">🥚卵×{got} を受け取りました！</div>}
    </section>
  )
}
