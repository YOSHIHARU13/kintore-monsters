import { describe, expect, it } from 'vitest'
import { isSunoShortLink, parseSunoSongId, sunoAudioUrl } from './suno'

const ID = '7da7e863-084e-43f2-acc8-a45bcb30e2e4'

describe('SunoのURLの読み取り', () => {
  it('曲ページのURLからIDを取り出す', () => {
    expect(parseSunoSongId(`https://suno.com/song/${ID}`)).toBe(ID)
    expect(parseSunoSongId(`https://suno.com/song/${ID}?sh=abc`)).toBe(ID)
    expect(parseSunoSongId(`https://app.suno.ai/song/${ID}/`)).toBe(ID)
    expect(parseSunoSongId(`https://suno.com/embed/${ID}`)).toBe(ID)
  })

  it('前後に文章や空白が付いていても読み取る', () => {
    expect(parseSunoSongId(`  Listen on Suno https://suno.com/song/${ID.toUpperCase()}\n`)).toBe(ID)
    expect(parseSunoSongId(ID)).toBe(ID)
  })

  it('曲のURLでなければ null', () => {
    expect(parseSunoSongId('')).toBeNull()
    expect(parseSunoSongId('https://suno.com/s/AbCd1234')).toBeNull()
    expect(parseSunoSongId(`https://example.com/song/${ID}`)).toBeNull()
    expect(parseSunoSongId('https://suno.com/song/abc')).toBeNull()
  })

  it('共有用の短いURLを見分ける', () => {
    expect(isSunoShortLink('https://suno.com/s/AbCd1234')).toBe(true)
    expect(isSunoShortLink(`https://suno.com/song/${ID}`)).toBe(false)
  })

  it('再生用のURLを作る', () => {
    expect(sunoAudioUrl(ID)).toBe(`https://cdn1.suno.ai/${ID}.mp4`)
  })
})
