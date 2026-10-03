import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from './store'
import { sunoAudioUrl } from './lib/suno'
import type { Song } from './types'

type Status = 'stopped' | 'loading' | 'playing'

interface Music {
  songs: Song[]
  currentId: string | null
  status: Status
  toggleSong: (song: Song) => void
}

const MusicContext = createContext<Music | null>(null)

/** 曲の再生をアプリ全体で1つだけ持つ。画面を切り替えても曲が止まらないようにするため */
export function MusicProvider({ children }: { children: ReactNode }) {
  const { songs } = useStore()
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('stopped')
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    audioRef.current?.pause()
    setStatus('stopped')
  }

  const start = (song: Song) => {
    let el = audioRef.current
    if (!el) {
      el = new Audio()
      el.loop = true
      el.preload = 'auto'
      el.addEventListener('playing', () => setStatus('playing'))
      // 通信が詰まって再バッファ中は「読み込み中」に戻す
      el.addEventListener('waiting', () => setStatus((s) => (s === 'stopped' ? s : 'loading')))
      el.addEventListener('error', () => {
        setStatus('stopped')
        setError('曲を再生できませんでした。URLが正しいか、曲が「公開」になっているか確認してください。')
      })
      audioRef.current = el
    }
    // 同じ曲なら、止めたところから続きを流す
    const url = sunoAudioUrl(song.id)
    if (el.src !== url) el.src = url
    setCurrentId(song.id)
    setStatus('loading')
    setError(null)
    // play() はタップ処理の中で同期的に呼ぶ（スマホの自動再生制限対策）
    el.play().catch((e) => {
      // 別の曲への切り替えや停止で中断された場合は正常なので無視
      if (e?.name === 'AbortError') return
      console.error(e)
      setStatus('stopped')
      if (e?.name === 'NotAllowedError') setError('ブラウザに再生をブロックされました。もう一度ボタンを押してください。')
    })
  }

  const toggleSong = (song: Song) => {
    if (status !== 'stopped' && song.id === currentId) stop()
    else start(song)
  }

  // 再生中の曲が設定から削除されたら止める
  useEffect(() => {
    if (currentId && !songs.some((s) => s.id === currentId)) {
      audioRef.current?.pause()
      setStatus('stopped')
      setCurrentId(null)
    }
  }, [songs, currentId])

  // ログアウトなどで画面ごと消えるときは止める
  useEffect(() => () => audioRef.current?.pause(), [])

  return (
    <MusicContext.Provider value={{ songs, currentId, status, toggleSong }}>
      {children}
      {error && (
        <div className="toast error" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </MusicContext.Provider>
  )
}

/** 曲ごとのボタン。ワンタップで流す・止める。曲が未登録なら何も出さない */
export function MusicButtons() {
  // テストなど MusicProvider の外では null
  const music = useContext(MusicContext)
  if (!music || music.songs.length === 0) return null
  const { songs, currentId, status } = music

  return (
    <div className="music-songs">
      {songs.map((song) => {
        const active = song.id === currentId && status !== 'stopped'
        return (
          <button key={song.id} className={`chip${active ? ' on' : ''}`} onClick={() => music.toggleSong(song)}>
            {active ? (status === 'loading' ? '⏳' : '⏸') : '🎵'} {song.title}
          </button>
        )
      })}
    </div>
  )
}
