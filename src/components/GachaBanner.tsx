import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { Gacha } from '../types'

interface Props {
  gacha: Gacha
  count: number // 中身の種類数
  selected?: boolean
  onClick?: () => void
  preview?: string // まだ保存していないバナー画像（編集画面のプレビュー）
}

/** ガチャのバナー。画像がなければ名前だけの帯を出す */
export function GachaBanner({ gacha, count, selected = false, onClick, preview }: Props) {
  const { loadImage } = useStore()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setSrc(null)
    if (gacha.bannerImageId) loadImage(gacha.bannerImageId).then((data) => alive && setSrc(data))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gacha.bannerImageId])

  const image = preview ?? src
  return (
    <button
      type="button"
      className={`gacha-banner${selected ? ' on' : ''}${image ? ' has-image' : ''}`}
      style={image ? { backgroundImage: `url(${image})` } : undefined}
      onClick={onClick}
    >
      <span className="gacha-banner-text">
        <strong>{gacha.name}</strong>
        <span className="small">
          全{count}種・✨色違い 1/{Math.round(1 / gacha.shinyRate)}
        </span>
      </span>
    </button>
  )
}
