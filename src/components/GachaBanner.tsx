import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { getTemplate } from '../data/evolutionTemplates'
import { MonsterImage } from './MonsterImage'
import { rarityOf, type Rate } from '../lib/gacha'
import { isHidden, type Gacha, type MonsterDef } from '../types'

/** バナーに出す姿：最終形態のうち画像があるもの（なければ画像がある中でいちばん進化した姿） */
export function bannerNodeOf(def: MonsterDef): string {
  const nodes = getTemplate(def.templateId).nodes
  const withImage = nodes.filter((n) => def.images[n.id])
  const final = withImage.find((n) => n.next.length === 0)
  return (final ?? withImage[withImage.length - 1] ?? nodes[0]).id
}

/** そのガチャから出るモンスターがレシピに入っている、ジョグレスの隠しモンスター */
export function jogressOf(table: Rate[], defs: MonsterDef[]): MonsterDef[] {
  const ids = new Set(table.map((t) => t.def.id))
  return defs.filter((d) => isHidden(d) && d.recipe!.some((r) => ids.has(r)))
}

/** バナーに出すモンスター。選んでいなければ、ピックアップのうちレア度の高い順に */
export function featuredOf(gacha: Gacha, table: Rate[], defs: MonsterDef[]): MonsterDef[] {
  const max = CONFIG.gacha.bannerMonsters
  const pool = [...table.map((t) => t.def), ...jogressOf(table, defs)]
  const chosen = gacha.featured.map((id) => pool.find((d) => d.id === id)).filter((d) => !!d)
  if (chosen.length > 0) return chosen.slice(0, max)
  const order = ['superRare', 'rare'] as const
  return order.flatMap((r) => table.filter((t) => t.rarity === r).map((t) => t.def)).slice(0, max)
}

interface Props {
  gacha: Gacha
  count: number // 中身の種類数
  featured?: MonsterDef[] // 自動バナーに出すモンスター
  selected?: boolean
  onClick?: () => void
  preview?: string // まだ保存していないバナー画像（編集画面のプレビュー）
}

/** ガチャのバナー。画像があれば画像、なければテーマ色・キャッチコピー・ピックアップで組み立てる */
export function GachaBanner({ gacha, count, featured = [], selected = false, onClick, preview }: Props) {
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
  const info = (
    <span className="small">
      全{count}種・✨色違い 1/{Math.round(1 / gacha.shinyRate)}
    </span>
  )

  if (image) {
    return (
      <button
        type="button"
        className={`gacha-banner has-image${selected ? ' on' : ''}`}
        style={{ backgroundImage: `url(${image})` }}
        onClick={onClick}
      >
        <span className="gacha-banner-text">
          <strong>{gacha.name}</strong>
          {info}
        </span>
      </button>
    )
  }

  const hasSuperRare = featured.some((d) => !isHidden(d) && rarityOf(d) === 'superRare')
  const hasJogress = featured.some(isHidden)
  return (
    <button
      type="button"
      className={`gacha-banner auto theme-${gacha.theme}${selected ? ' on' : ''}`}
      onClick={onClick}
    >
      <span className="auto-rays" aria-hidden="true" />
      <span className="auto-monsters">
        {featured.map((d, i) => (
          <span key={d.id} className={`auto-monster m${i}`}>
            <MonsterImage imageId={d.images[bannerNodeOf(d)]} size={i === 0 ? 104 : 78} />
          </span>
        ))}
      </span>
      <span className="auto-text">
        {(hasJogress || hasSuperRare) && (
          <span className="auto-badge">{hasJogress ? 'ジョグレスで★7' : '激レア登場'}</span>
        )}
        <strong className="auto-title">{gacha.name}</strong>
        {gacha.catchphrase && <span className="auto-catch">{gacha.catchphrase}</span>}
        {info}
      </span>
    </button>
  )
}
