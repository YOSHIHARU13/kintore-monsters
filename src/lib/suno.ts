const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const BARE_ID = new RegExp(`^${UUID}$`, 'i')
const SONG_URL = new RegExp(`suno\\.(?:com|ai)/(?:song|embed)/(${UUID})`, 'i')

/** SunoのURL（suno.com/song/…）から曲のIDを取り出す。読み取れなければ null */
export function parseSunoSongId(input: string): string | null {
  const text = input.trim()
  if (BARE_ID.test(text)) return text.toLowerCase()
  const match = text.match(SONG_URL)
  return match ? match[1].toLowerCase() : null
}

/** 共有用の短いURL（suno.com/s/…）。曲のIDが含まれないので、このアプリからは再生できない */
export function isSunoShortLink(input: string): boolean {
  return /suno\.com\/s\//i.test(input)
}

/**
 * 再生に使うURL。Sunoの音声ファイル本体（mp3）は外から読めないため、
 * 公開されている動画（mp4）の音声トラックを再生する
 */
export function sunoAudioUrl(songId: string): string {
  return `https://cdn1.suno.ai/${songId}.mp4`
}
