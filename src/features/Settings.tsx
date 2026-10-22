import { useState, type FormEvent } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useStore } from '../store'
import type { Go } from '../nav'
import { habitLabelOf } from '../lib/rewards'
import { CONFIG } from '../config/gameConfig'
import { isSunoShortLink, parseSunoSongId } from '../lib/suno'

export function Settings({ go }: { go: Go }) {
  const { songs, saveSongs, state, setHabitLabel, setHabitMode } = useStore()
  const [habit, setHabit] = useState(habitLabelOf(state))
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = (e: FormEvent) => {
    e.preventDefault()
    const id = parseSunoSongId(url)
    if (!id) {
      setError(
        isSunoShortLink(url)
          ? '短い共有リンク（suno.com/s/…）はそのまま使えません。ブラウザで一度開いて、アドレス欄に出る「suno.com/song/…」の長いURLを貼ってください。'
          : 'Sunoの曲のURL（https://suno.com/song/…）を貼ってください。',
      )
      return
    }
    if (songs.some((s) => s.id === id)) {
      setError('その曲はすでに登録されています。')
      return
    }
    saveSongs([...songs, { id, title: title.trim() || `曲${songs.length + 1}` }])
    setUrl('')
    setTitle('')
    setError(null)
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'home' })}>
        ← ホームに戻る
      </button>
      <h1 className="title">設定</h1>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          setHabitLabel(habit)
        }}
      >
        <h2>朝の記録の習慣</h2>
        <label className="field">
          ホームから、やった直後にその場で記録できます
          <input
            type="text"
            maxLength={30}
            placeholder={CONFIG.morning.habitDefaultLabel}
            value={habit}
            onChange={(e) => setHabit(e.target.value)}
          />
        </label>
        <button className="btn primary wide" type="submit" disabled={habit.trim() === habitLabelOf(state)}>
          習慣の名前を保存
        </button>
        <div className="field">
          記録のしかた
          <div className="chips" role="group" aria-label="記録のしかた">
            <button
              type="button"
              className={`chip${state.habitMode !== 'minutes' ? ' on' : ''}`}
              onClick={() => setHabitMode('check')}
            >
              ○×（できたら +{CONFIG.morning.habitGold}G）
            </button>
            <button
              type="button"
              className={`chip${state.habitMode === 'minutes' ? ' on' : ''}`}
              onClick={() => setHabitMode('minutes')}
            >
              分数（1分 +{CONFIG.morning.habitGoldPerMinute}G・{CONFIG.morning.habitMaxMinutes}分まで）
            </button>
          </div>
        </div>
      </form>

      <section className="card">
        <h2>トレーニング中に流す曲（Suno）</h2>
        {songs.length > 0 ? (
          <ul className="choice-list">
            {songs.map((song) => (
              <li key={song.id} className="song-row">
                <span>🎵 {song.title}</span>
                <button className="btn small" onClick={() => saveSongs(songs.filter((s) => s.id !== song.id))}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">まだ曲がありません。</p>
        )}
        <p className="muted small">
          登録すると、トレーニング画面とセット入力画面に曲ごとのボタンが出ます。押すと流れ、もう一度押すと止まります。Sunoで曲を「公開」設定にしておく必要があります。
        </p>
      </section>

      <form className="card" onSubmit={add}>
        <h2>曲を追加</h2>
        <label className="field">
          Sunoの曲のURL
          <input
            type="url"
            inputMode="url"
            placeholder="https://suno.com/song/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className="field">
          曲の名前（省略可）
          <input type="text" maxLength={30} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {error && <p className="error small">{error}</p>}
        <button className="btn primary wide" type="submit" disabled={!url.trim()}>
          追加する
        </button>
      </form>
      <button className="btn ghost wide" onClick={() => signOut(auth)}>
        ログアウト
      </button>
    </div>
  )
}
