import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { getTemplate } from '../data/evolutionTemplates'
import { MonsterImage } from './MonsterImage'
import { ElementBadge } from './ElementBadge'
import { Stars } from './Stars'
import { isPickupRarity, rarityOf, starsOf, type Rate } from '../lib/gacha'
import { elementInfo } from '../lib/element'
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
  return table.filter((t) => t.rarity === 'superRare').map((t) => t.def).slice(0, max)
}

/** ピックアップ（レア以上）。激レアを先に */
export function pickupsOf(table: Rate[]): MonsterDef[] {
  return table
    .filter((t) => isPickupRarity(t.rarity))
    .sort((a, b) => Number(b.rarity === 'superRare') - Number(a.rarity === 'superRare'))
    .map((t) => t.def)
}

/** バナーの色：主役の属性の色（無属性なら金） */
export function bannerTone(hero: MonsterDef | undefined): string {
  const el = hero ? elementInfo(hero).elements[0] : undefined
  return el ? `tone-${el}` : 'tone-gold'
}

interface Props {
  gacha: Gacha
  count: number // 中身の種類数
  featured?: MonsterDef[] // 主役（3体まで）
  pickups?: MonsterDef[] // ピックアップ（レア以上）
  selected?: boolean
  onClick?: () => void
  preview?: string // まだ保存していないバナー画像（編集画面のプレビュー）
}

const AUTO_MS = 3800

/**
 * ガチャのバナー。スライドで3枚見られる：①主役をズーム ②ほかのピックアップ ③主役3体の集合。
 * 自動で切り替わり、指でスライドもできる。画像を選んでいれば①が画像になる。
 */
export function GachaBanner({ gacha, count, featured = [], pickups = [], selected = false, onClick, preview }: Props) {
  const { loadImage } = useStore()
  const [src, setSrc] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const touched = useRef(0)

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
  const hero = featured[0]
  const others = pickups.filter((d) => d.id !== hero?.id)
  const info = (
    <span className="small">
      全{count}種・✨色違い 1/{Math.round(1 / gacha.shinyRate)}
    </span>
  )
  const hasSuperRare = featured.some((d) => !isHidden(d) && rarityOf(d) === 'superRare')
  const jogressStars = Math.max(0, ...featured.filter(isHidden).map((d) => starsOf(d, bannerNodeOf(d))))
  const badge = (jogressStars > 0 || hasSuperRare) && (
    <span className="auto-badge">{jogressStars > 0 ? `ジョグレスで★${jogressStars}` : '激レア登場'}</span>
  )

  const slides: ReactNode[] = [
    image ? (
      <span key="image" className="slide slide-image" style={{ backgroundImage: `url(${image})` }}>
        <span className="gacha-banner-text">
          <strong>{gacha.name}</strong>
          {info}
        </span>
      </span>
    ) : (
      <span key="hero" className="slide slide-hero">
        <span className="auto-rays" aria-hidden="true" />
        {hero && (
          <span className="hero-monster">
            <MonsterImage imageId={hero.images[bannerNodeOf(hero)]} size={150} />
          </span>
        )}
        <span className="auto-text">
          {badge}
          <strong className="auto-title">{gacha.name}</strong>
          {gacha.catchphrase && <span className="auto-catch">{gacha.catchphrase}</span>}
          {hero && <span className="hero-name">{hero.name}</span>}
          {info}
        </span>
      </span>
    ),
  ]
  if (others.length > 0) {
    slides.push(
      <span key="pickups" className="slide slide-pickups">
        <strong className="slide-label">ピックアップ</strong>
        <span className="pickup-row">
          {others.slice(0, 6).map((d) => (
            <span key={d.id} className="pickup">
              <MonsterImage imageId={d.images[bannerNodeOf(d)]} size={64} />
              <span className="pickup-name">{d.name}</span>
              <Stars def={d} nodeId={bannerNodeOf(d)} />
              <ElementBadge def={d} />
            </span>
          ))}
        </span>
      </span>,
    )
  }
  if (featured.length >= 2) {
    slides.push(
      <span key="trio" className="slide slide-trio">
        <span className="auto-rays" aria-hidden="true" />
        <span className="trio-row">
          {featured.map((d) => (
            <span key={d.id} className="trio-member">
              <MonsterImage imageId={d.images[bannerNodeOf(d)]} size={92} />
              <span className="pickup-name">{d.name}</span>
            </span>
          ))}
        </span>
        <strong className="trio-title">{gacha.name}</strong>
      </span>,
    )
  }

  // 自動で次のスライドへ（指で触った直後はしばらく止める）
  useEffect(() => {
    if (slides.length <= 1) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const t = setInterval(() => {
      if (Date.now() - touched.current < AUTO_MS * 2) return
      const el = track.current
      if (!el) return
      const next = (Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) + 1) % slides.length
      el.scrollTo?.({ left: next * el.clientWidth, behavior: 'smooth' })
    }, AUTO_MS)
    return () => clearInterval(t)
  }, [slides.length])

  return (
    <div className={`banner-carousel ${bannerTone(hero)}${selected ? ' on' : ''}`}>
      <div
        ref={track}
        className="banner-track"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        onTouchStart={() => (touched.current = Date.now())}
        onScroll={(e) => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
        }}
        aria-label={gacha.name}
      >
        {slides}
      </div>
      {slides.length > 1 && (
        <span className="banner-dots" aria-hidden="true">
          {slides.map((_, i) => (
            <i key={i} className={i === index ? 'on' : ''} />
          ))}
        </span>
      )}
    </div>
  )
}
