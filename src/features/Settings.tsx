import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { isSunoShortLink, parseSunoSongId } from '../lib/suno'

export function Settings() {
  const { songs, saveSongs } = useStore()
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
      <h1 className="title">設定</h1>

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
    </div>
  )
}
