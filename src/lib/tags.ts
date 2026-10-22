import type { MonsterDef } from '../types'

/** 自分で付けたタグ（コラボ名は入らない） */
export const ownTagsOf = (def: Pick<MonsterDef, 'tags'> | undefined): string[] =>
  [...new Set((def?.tags ?? []).map((t) => t.trim()).filter((t) => t !== ''))]

/**
 * タグ：因縁のある子どうしをまとめる目印。コラボのシリーズ名もタグの1つとして数える。
 * 出撃条件そのものにはしない。クエストを作るとき、ボスと同じタグの子たちが刺さる（適正になる）ように、属性とギミックを自動で決めるのに使う。
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

/** 一致を調べるときのタグ。コラボの子に付けたタグは、そのコラボの中だけで効く（同じ言葉でも、ほかとは一致しない） */
export function matchTags(def: Pick<MonsterDef, 'tags' | 'series'>): string[] {
  const series = def.series?.trim()
  return [...ownTagsOf(def).map((t) => (series ? `${series}/${t}` : t)), ...(series ? [series] : [])]
}

/** ボスとタグが一致する子（ガチャ・ジョグレス。一致が多い順） */
export function tagMates(boss: MonsterDef, defs: MonsterDef[]): MonsterDef[] {
  const mine = matchTags(boss)
  if (mine.length === 0) return []
  return defs
    .filter((d) => d.id !== boss.id && !d.questOnly)
    .map((d) => ({ d, n: matchTags(d).filter((t) => mine.includes(t)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.d)
}

/** 登録画面で候補に出すタグ：コラボの子なら同じコラボで使っているタグだけ、通常の子なら通常の子のタグだけ */
export function tagSuggestions(defs: MonsterDef[], series: string): string[] {
  return allTags(
    defs.filter((d) => (d.series?.trim() ?? '') === series.trim()),
    true,
  )
}
