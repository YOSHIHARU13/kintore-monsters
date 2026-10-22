import type { MonsterDef } from '../types'

/** 自分で付けたタグ（コラボ名は入らない） */
export const ownTagsOf = (def: Pick<MonsterDef, 'tags'> | undefined): string[] =>
  [...new Set((def?.tags ?? []).map((t) => t.trim()).filter((t) => t !== ''))]

/**
 * タグ：モンスターに付ける自由なラベル（ドラゴン・侍・神…）。コラボのシリーズ名もタグの1つとして数える。
 * クエストの「求められる編成」の条件にできる（例：🏷️ドラゴン 4）。タグを多く持つ子ほど、たくさんの条件を一度に満たせる。
 */
export const tagsOfDef = (def: Pick<MonsterDef, 'tags' | 'series'> | undefined): string[] => {
  const series = def?.series?.trim()
  return [...new Set([...ownTagsOf(def), ...(series ? [series] : [])])]
}

/** 登録されているタグ（多い順）。own なら自分で付けたタグだけ（コラボ名は除く） */
export function allTags(defs: MonsterDef[], own = false): string[] {
  const count: Record<string, number> = {}
  for (const d of defs) for (const t of own ? ownTagsOf(d) : tagsOfDef(d)) count[t] = (count[t] ?? 0) + 1
  return Object.keys(count).sort((a, b) => count[b] - count[a] || a.localeCompare(b))
}

/** 文字列からタグの一覧へ（読点・カンマ・空白で区切る） */
export const parseTags = (text: string): string[] => ownTagsOf({ tags: text.split(/[、,，\s]+/) })
