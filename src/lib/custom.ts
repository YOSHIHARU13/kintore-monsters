import { CONFIG } from '../config/gameConfig'
import { abilityName } from './gimmick'
import { isBonusSlot } from '../data/exercises'
import { nodeAttr, type MonsterDef, type OwnedMonster } from '../types'

/**
 * カスタマイズアイテム（神殿で落ちる）。1体に1つ付けられる。
 * itemKey：'atk1'〜'atk3'（攻撃力アップ 銅・銀・金）、'fav'（得意種目の追加・銀）、'ab:バリア'（アビリティの追加・金）
 */
export type Grade = 1 | 2 | 3 // 銅・銀・金

export const GRADE_ICON: Record<Grade, string> = { 1: '🥉', 2: '🥈', 3: '🥇' }

export interface ItemInfo {
  key: string
  grade: Grade
  kind: 'attack' | 'favorite' | 'ability'
  label: string
  attack: number
  ability?: string
}

export function itemInfo(key: string, names?: Record<string, string>): ItemInfo {
  if (key === 'fav') return { key, grade: 2, kind: 'favorite', label: '得意種目の追加', attack: 0 }
  if (key.startsWith('ab:')) {
    const ability = key.slice(3)
    return { key, grade: 3, kind: 'ability', label: `アビリティ追加：${abilityName(ability, names)}`, attack: 0, ability }
  }
  const grade = Math.min(3, Math.max(1, Number(key.slice(3)) || 1)) as Grade
  const attack = CONFIG.temple.attack[grade - 1]
  return { key, grade, kind: 'attack', label: `攻撃力 +${attack.toLocaleString()}`, attack }
}

/** アイテムの表示（例：🥈 攻撃力 +1,000） */
export function itemLabel(key: string, names?: Record<string, string>): string {
  const info = itemInfo(key, names)
  return `${GRADE_ICON[info.grade]} ${info.label}`
}

/** 並べる順：金から、同じ格なら攻撃力→得意種目→アビリティ */
export function itemOrder(a: string, b: string): number {
  const x = itemInfo(a)
  const y = itemInfo(b)
  const kinds = ['attack', 'favorite', 'ability']
  return y.grade - x.grade || kinds.indexOf(x.kind) - kinds.indexOf(y.kind) || a.localeCompare(b)
}

/** 1個ぶん引く：まず銅・銀・金を決め、銀なら一部が得意種目、金なら一部がアビリティ */
export function rollItem(level: 'normal' | 'hard', gimmicks: string[], random: () => number): string {
  const t = CONFIG.temple
  const [bronze, silver] = t.rarity[level]
  const r = random()
  const grade: Grade = r < bronze ? 1 : r < bronze + silver ? 2 : 3
  if (grade === 2 && random() < t.silverFavorite) return 'fav'
  if (grade === 3 && gimmicks.length > 0 && random() < t.goldAbility) {
    return `ab:${gimmicks[Math.floor(random() * gimmicks.length) % gimmicks.length]}`
  }
  return `atk${grade}`
}

/** 神殿のドロップ：くじの数だけアイテム。運極1体ごとに、当たりにくいくじが1回増える */
export function rollTempleItems(level: 'normal' | 'hard', luckCount: number, gimmicks: string[], random: () => number): string[] {
  const t = CONFIG.temple
  const d = t.drops[level]
  const items: string[] = []
  for (let i = 0; i < d.rolls; i++) if (random() < d.rate) items.push(rollItem(level, gimmicks, random))
  for (let i = 0; i < luckCount; i++) if (random() < t.luckRate) items.push(rollItem(level, gimmicks, random))
  return items
}

/** 付けたアイテムの攻撃力 */
export function customAttack(mon: Pick<OwnedMonster, 'custom'>): number {
  return mon.custom ? itemInfo(mon.custom).attack : 0
}

/** その個体のカスタマイズを反映したモンスター（得意種目・アビリティが増える） */
export function customized(def: MonsterDef, mon: Pick<OwnedMonster, 'custom' | 'customSlot'> & { nodeId?: string; shinkaGold?: boolean }): MonsterDef {
  // 部位の条件は、今の形態の部位で数える
  const part = mon.nodeId ? nodeAttr(def, mon.nodeId) : undefined
  if (part && part !== nodeAttr(def, 'n1')) def = { ...def, partNow: part }
  // 金の獣神化（激レア2体の合体）は、相手の属性も持つ（同じ属性なら超属性）。アビリティは激レアより1つ多い：
  // 自分のアビリティに、相手のアビリティから持っていないものを1つ足す
  if (mon.shinkaGold && def.element && def.partnerElement) {
    const slots = CONFIG.gimmicks.slots.superRare
    const abilities = [...new Set([...(def.abilities ?? []).slice(0, slots), ...(def.partnerAbilities ?? []).slice(0, slots)])].slice(0, slots + 1)
    def = def.partnerElement === def.element
      ? { ...def, abilities, goldElements: [def.element], goldSuper: true }
      : { ...def, abilities, goldElements: [def.element, def.partnerElement] }
  }
  if (!mon.custom) return def
  const info = itemInfo(mon.custom)
  if (info.kind === 'ability' && info.ability && !(def.abilities ?? []).includes(info.ability)) {
    return { ...def, extraAbilities: [info.ability] }
  }
  if (info.kind === 'favorite' && mon.customSlot && mon.customSlot !== def.favoriteSlot) {
    return { ...def, extraFavorite: mon.customSlot }
  }
  return def
}

/** その種目が得意種目か（カスタマイズで足した分も） */
export function isFavorite(def: Pick<MonsterDef, 'favoriteSlot' | 'extraFavorite'>, slotId: string): boolean {
  // 全身枠は誰の得意種目にもならない（以前ローラーを得意にしていた子も効かない）
  if (isBonusSlot(slotId)) return false
  return def.favoriteSlot === slotId || def.extraFavorite === slotId
}
