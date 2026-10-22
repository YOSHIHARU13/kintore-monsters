import { useEffect, useState } from 'react'
import { useStore } from '../store'

interface Props {
  imageId?: string
  silhouette?: boolean // 画像があっても黒いシルエットで表示する（未入手・進化先）
  size?: number
  plus?: number // 合体の＋。1以上なら＋に応じた枠で囲む
  shiny?: boolean // 色違い。色を変えてキラキラさせる
  awaken?: number // 覚醒の段階（1：覚醒、2：真・覚醒）。絵のまわりが光る（星とは別）
}

/** モンスター画像。画像が未登録ならプレースホルダーのシルエットを出す */
export function MonsterImage({ plus: _plus = 0, shiny = false, awaken = 0, ...props }: Props) {
  // ＋はなくなったので、枠は出さない（色違いだけ）
  const plus = 0
  const base = shiny ? (
    <div className="shiny">
      <Picture {...props} />
      <span className="shiny-mark" aria-label="色違い">
        ✨
      </span>
    </div>
  ) : (
    <Picture {...props} />
  )
  // 覚醒：絵のうしろに光の輪。大きい絵には「覚醒」の文字も（星の数と見間違えないように）
  const picture =
    awaken > 0 && !props.silhouette ? (
      <div className={`awaken awaken-${Math.min(awaken, 2)}`}>
        {base}
        {(props.size ?? 96) >= 72 && <span className="awaken-mark">{awaken >= 2 ? '真・覚醒' : '覚醒'}</span>}
      </div>
    ) : (
      base
    )
  if (plus <= 0) return picture
  return (
    <div className={`frame plus-${Math.min(plus, 5)}`}>
      {picture}
      <span className="frame-plus">＋{plus}</span>
    </div>
  )
}

function Picture({ imageId, silhouette = false, size = 96 }: Omit<Props, 'plus' | 'shiny'>) {
  const { loadImage } = useStore()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setSrc(null)
    if (imageId) loadImage(imageId).then((data) => alive && setSrc(data))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId])

  const style = { width: size, height: size }
  if (!src) {
    return (
      <div className="monster-img placeholder" style={style}>
        <svg viewBox="0 0 100 100" width="70%" height="70%" aria-hidden="true">
          <ellipse cx="50" cy="56" rx="30" ry="34" fill="currentColor" />
          <circle cx="30" cy="26" r="10" fill="currentColor" />
          <circle cx="70" cy="26" r="10" fill="currentColor" />
        </svg>
        <span>？</span>
      </div>
    )
  }
  return <img className={`monster-img${silhouette ? ' silhouette' : ''}`} style={style} src={src} alt="" />
}
