import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { Gauge } from '../components/Gauge'
import {
  canClaim,
  dailyMissions,
  dexMissions,
  isClaimed,
  loginReward,
  rewardText,
  weeklyMissions,
  loginReady,
  LOGIN_HINT,
  type Mission,
} from '../lib/missions'
import type { Go } from '../nav'

/** ミッション：ログインボーナス・プレゼント・デイリー・ウィークリー・図鑑の達成報酬 */
export function Missions({ go }: { go: Go }) {
  const store = useStore()
  const { state, today, week, todaySets, weekSets, defs, owned, claimReward } = store
  const [flash, setFlash] = useState<string | null>(null)
  const ctx = { state, today, week, todaySets, weekSets }
  const sections: [string, Mission[]][] = [
    ['📅 デイリー', dailyMissions(ctx)],
    ['🗓 ウィークリー（月曜にリセット）', weeklyMissions(ctx)],
    ['📖 図鑑の達成報酬', dexMissions(defs, owned, state)],
  ]
  const claim = (m: Mission) => {
    if (claimReward(m.key, m.reward)) setFlash(`${m.label}：${rewardText(m.reward)} を受け取った！`)
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'home' })}>
        ← ホームに戻る
      </button>
      <h1 className="title">🎯 ミッション</h1>
      {flash && <div className="result keep">{flash}</div>}
      <LoginBonus />
      <Gifts />
      {sections.map(([title, list]) => (
        <section key={title} className="card">
          <h2>{title}</h2>
          <ul className="mini-list mission-list">
            {list.map((m) => {
              const claimed = isClaimed(state, m.key)
              return (
                <li key={m.key} className={claimed ? 'claimed' : ''}>
                  <span className="mission-body">
                    <span>{m.label}</span>
                    <Gauge value={Math.min(m.have, m.need)} max={m.need} color="#ffd166" />
                    <span className="muted small">
                      {Math.min(m.have, m.need)}／{m.need}・{rewardText(m.reward)}
                    </span>
                  </span>
                  {claimed ? (
                    <span className="tag">受取済</span>
                  ) : (
                    <button className="btn small primary" disabled={!canClaim(state, m)} onClick={() => claim(m)}>
                      受け取る
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** ログインボーナス（1日1回・7日周期） */
export function LoginBonus() {
  const { state, today, yesterday, claimLogin } = useStore()
  const active = loginReady(state, yesterday)
  const [got, setGot] = useState<string | null>(null)
  const claimed = isClaimed(state, `login:${today}`)
  if (claimed && !got) return null
  const { day, reward } = loginReward(state)
  return (
    <section className="card login-bonus">
      {got ? (
        <strong>🎉 ログインボーナス：{got} を受け取った！</strong>
      ) : (
        <>
          <h2>🎁 ログインボーナス {day}日目</h2>
          <div className="login-days">
            {CONFIG.missions.login.map((r, i) => (
              <span key={i} className={`login-day${i + 1 === day ? ' on' : i + 1 < day ? ' done' : ''}`}>
                <span className="small">{i + 1}日目</span>
                <span className="small">{rewardText(r)}</span>
              </span>
            ))}
          </div>
          <button
            className="btn primary wide"
            disabled={!active}
            onClick={() => {
              const r = claimLogin()
              if (r) setGot(rewardText(r))
            }}
          >
            受け取る（{rewardText(reward)}）
          </button>
          {!active && <p className="muted small">🔒 {LOGIN_HINT}</p>}
        </>
      )}
    </section>
  )
}

/** 一度だけのプレゼント（スタートダッシュなど） */
export function Gifts() {
  const { state, claimReward } = useStore()
  const [got, setGot] = useState<string | null>(null)
  const gifts = CONFIG.missions.gifts.filter((g) => !isClaimed(state, `gift:${g.id}`))
  if (gifts.length === 0 && !got) return null
  return (
    <section className="card gift-card">
      {got && <strong>🎉 {got}</strong>}
      {gifts.map((g) => (
        <div key={g.id} className="gift">
          <h2>🎁 {g.label}</h2>
          <p className="small">
            {rewardText(g.reward)}
            {g.boosters && `・ブースター各1個（${g.boosters.map((b) => CONFIG.boosters[b].icon).join('')}）`}
          </p>
          <button
            className="btn primary wide"
            onClick={() => {
              if (claimReward(`gift:${g.id}`, g.reward, g.boosters)) setGot(`${g.label}を受け取った！`)
            }}
          >
            受け取る
          </button>
        </div>
      ))}
    </section>
  )
}
