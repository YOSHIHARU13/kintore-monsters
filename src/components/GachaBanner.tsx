import { useEffect, useRef, useState, type ReactNode } from 'react'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { useStore } from '../store'
import { seriesOf } from '../lib/series'
import { CONFIG } from '../config/gameConfig'
import { getTemplate } from '../data/evolutionTemplates'
import { MonsterImage } from './MonsterImage'
import { ElementBadge } from './ElementBadge'
import { Stars } from './Stars'
import { isPickupRarity, rarityOf, starsOf, type Rate } from '../lib/gacha'
import { ELEMENT_COLOR, elementInfo } from '../lib/element'
import { isHidden, type BannerSlide, type Gacha, type MonsterDef } from '../types'

/** バナーに出す姿：最終形態のうち画像があるもの（なければ画像がある中でいちばん進化した姿） */
export function bannerNodeOf(def: MonsterDef): string {
  const nodes = getTemplate(def.templateId).nodes
  const withImage = nodes.filter((n) => imageOf(def, n.id))
  const final = withImage.find((n) => n.next.length === 0)
  return (final ?? withImage[withImage.length - 1] ?? nodes[0]).id
}

/** そのガチャから出るモンスターがレシピに入っている、ジョグレスの隠しモンスター */
export function jogressOf(table: Rate[], defs: MonsterDef[]): MonsterDef[] {
  const ids = new Set(table.map((t) => t.def.id))
  return defs.filter((d) => isHidden(d) && d.recipe!.some((r) => ids.has(r)))
}

/** バナーに出すモンスター（並び順が優先度）。選んでいなければ、激レアを属性がばらけるように */
export function featuredOf(gacha: Gacha, table: Rate[], defs: MonsterDef[]): MonsterDef[] {
  const max = CONFIG.gacha.bannerMonsters
  const pool = [...table.map((t) => t.def), ...jogressOf(table, defs)]
  const chosen = gacha.featured.map((id) => pool.find((d) => d.id === id)).filter((d) => !!d)
  if (chosen.length > 0) return chosen.slice(0, max)
  const rares = table.filter((t) => t.rarity === 'superRare').map((t) => t.def)
  const seen = new Set<string>()
  const spread = rares.filter((d) => {
    const el = elementInfo(d).elements[0] ?? 'none'
    if (seen.has(el)) return false
    seen.add(el)
    return true
  })
  return [...spread, ...rares.filter((d) => !spread.includes(d))].slice(0, max)
}

export const SLIDE_LABEL: Record<BannerSlide, string> = {
  top1: '1位をズーム',
  top3: '上位3体',
  top5: '上位5体',
  pickups: 'ピックアップ一覧',
}
export const ALL_SLIDES: BannerSlide[] = ['top1', 'top3', 'top5', 'pickups']

/** 実際にスライドする型：選んだもののうち、主役の数が足りるものだけ（空なら全部） */
export function slidesOf(gacha: Gacha, featuredCount: number, othersCount: number): BannerSlide[] {
  const want = gacha.slides.length > 0 ? ALL_SLIDES.filter((s) => gacha.slides.includes(s)) : ALL_SLIDES
  const ok = want.filter((s) =>
    s === 'top3' ? featuredCount >= 2 : s === 'top5' ? featuredCount >= 4 : s === 'pickups' ? othersCount > 0 : true,
  )
  // 上位5体が出せるなら、選んでいなくても上位3体は重ねない（空のときだけ）
  if (gacha.slides.length === 0 && ok.includes('top5')) return ok.filter((s) => s !== 'top3')
  return ok.length > 0 ? ok : ['top1']
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
  featured?: MonsterDef[] // 主役（優先度順に5体まで）
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
      全{count}種
    </span>
  )
  const hasSuperRare = featured.some((d) => !isHidden(d) && rarityOf(d) === 'superRare')
  const jogressStars = Math.max(0, ...featured.filter(isHidden).map((d) => starsOf(d, bannerNodeOf(d))))
  const badge = (jogressStars > 0 || hasSuperRare) && (
    <span className="auto-badge">{jogressStars > 0 ? `ジョグレスで★${jogressStars}` : '激レア登場'}</span>
  )

  // ピックアップが全員同じシリーズなら、コラボのリボンを出す
  const series = [...new Set(pickups.map(seriesOf))]
  const collab = series.length === 1 ? series[0] : ''
  const types = slidesOf(gacha, featured.length, others.length)
  const slides: ReactNode[] = []
  // 画像を選んでいれば、いちばん最初は画像
  if (image || types.includes('top1')) {
    slides.push(
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
              <MonsterImage imageId={imageOf(hero, bannerNodeOf(hero))} awaken={awakenOf(hero, bannerNodeOf(hero))} glow={glowOf(hero)} size={150} />
            </span>
          )}
          <span className="auto-text">
            {collab && <span className="collab-ribbon">🤝 {collab} コラボ</span>}
            {badge}
            <strong className="auto-title">{gacha.name}</strong>
            {gacha.catchphrase && <span className="auto-catch">{gacha.catchphrase}</span>}
            {hero && <span className="hero-name">{hero.name}</span>}
            {info}
          </span>
        </span>
      ),
    )
  }
  const group = (members: MonsterDef[], kind: 'trio' | 'five') => {
    // 1位を真ん中に、順位が下がるほど外側で小さく
    const order = kind === 'five' ? [3, 1, 0, 2, 4] : [1, 0, 2]
    const sizes = kind === 'five' ? [96, 74, 74, 60, 60] : [104, 84, 84]
    return (
      <span key={kind} className={`slide slide-trio slide-${kind}`}>
        <span className="auto-rays" aria-hidden="true" />
        <span className="trio-row">
          {order
            .filter((i) => members[i])
            .map((i) => {
              const d = members[i]
              const el = elementInfo(d).elements[0]
              return (
                <span
                  key={d.id}
                  className={`trio-member${i === 0 ? ' first' : ''}`}
                  style={el ? { ['--glow' as string]: ELEMENT_COLOR[el] } : undefined}
                >
                  <MonsterImage imageId={imageOf(d, bannerNodeOf(d))} awaken={awakenOf(d, bannerNodeOf(d))} glow={glowOf(d)} size={sizes[i]} />
                  <span className="pickup-name">{d.name}</span>
                </span>
              )
            })}
        </span>
        <strong className="trio-title">{gacha.name}</strong>
      </span>
    )
  }
  if (types.includes('top3')) slides.push(group(featured.slice(0, 3), 'trio'))
  if (types.includes('top5')) slides.push(group(featured.slice(0, 5), 'five'))
  if (types.includes('pickups')) {
    slides.push(
      <span key="pickups" className="slide slide-pickups">
        <strong className="slide-label">ピックアップ</strong>
        <span className="pickup-row">
          {others.slice(0, 6).map((d) => (
            <span key={d.id} className="pickup">
              <MonsterImage imageId={imageOf(d, bannerNodeOf(d))} awaken={awakenOf(d, bannerNodeOf(d))} glow={glowOf(d)} size={64} />
              <span className="pickup-name">{d.name}</span>
              <Stars def={d} nodeId={bannerNodeOf(d)} />
              <ElementBadge def={d} />
            </span>
          ))}
        </span>
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
