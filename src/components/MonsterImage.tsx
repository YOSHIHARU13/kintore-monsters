import { useEffect, useState } from 'react'
import { useStore } from '../store'

interface Props {
  imageId?: string
  silhouette?: boolean // 画像があっても黒いシルエットで表示する（未入手・進化先）
  size?: number
}

/** モンスター画像。画像が未登録ならプレースホルダーのシルエットを出す */
export function MonsterImage({ imageId, silhouette = false, size = 96 }: Props) {
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
