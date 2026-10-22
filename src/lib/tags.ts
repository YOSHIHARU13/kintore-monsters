import { CONFIG } from '../config/gameConfig'
import type { MonsterDef, Quest } from '../types'

/**
 * タグ：モンスターに付ける自由なラベル（ドラゴン・侍・神…）。コラボのシリーズとは別。
 * クエストはボスのタグを持ち、タグが多く一致するモンスターほど、そのクエストで強い（最適性）。
 */
export const tagsOfDef = (def: Pick<MonsterDef, 'tags'> | undefined): string[] =>
  [...new Set((def?.tags ?? []).map((t) => t.trim()).filter((t) => t !== ''))]

/** 登録されているタグ（多い順） */
export function allTags(defs: MonsterDef[]): string[] {
  const count: Record<string, number> = {}
  for (const d of defs) for (const t of tagsOfDef(d)) count[t] = (count[t] ?? 0) + 1
  return Object.keys(count).sort((a, b) => count[b] - count[a] || a.localeCompare(b))
}

/** そのモンスターとクエスト（ボス）で一致するタグ */
export function sharedTags(def: MonsterDef, quest: Pick<Quest, 'bossTags'>): string[] {
  const boss = quest.bossTags ?? []
  return tagsOfDef(def).filter((t) => boss.includes(t))
}

/** タグが一致したぶんのダメージ倍率（1つにつき＋perTag、maxTags まで） */
export function tagRate(def: MonsterDef, quest: Pick<Quest, 'bossTags'>): number {
  const n = Math.min(sharedTags(def, quest).length, CONFIG.tags.maxTags)
  return 1 + n * CONFIG.tags.perTag
}

/** 文字列からタグの一覧へ（読点・カンマ・空白で区切る） */
export const parseTags = (text: string): string[] => tagsOfDef({ tags: text.split(/[、,，\s]+/) })
