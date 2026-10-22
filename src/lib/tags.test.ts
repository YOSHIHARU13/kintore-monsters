import { describe, expect, it } from 'vitest'
import { allTags, ownTagsOf, parseTags, tagMates, tagSuggestions, tagsOfDef } from './tags'
import type { MonsterDef } from '../types'

const def = (id: string, tags: string[], series?: string) => ({ id, name: id, templateId: 'single', images: {}, createdAt: 0, tags, series }) as MonsterDef

describe('タグ', () => {
  it('コラボ名もタグの1つとして数える', () => {
    expect(tagsOfDef(def('a', ['ドラゴン'], '鬼退治'))).toEqual(['ドラゴン', '鬼退治'])
    expect(ownTagsOf(def('a', ['ドラゴン'], '鬼退治'))).toEqual(['ドラゴン'])
  })
  it('一覧は多い順。入力は読点や空白で区切れる', () => {
    const all = allTags([def('a', ['侍', '神']), def('b', ['神'], '鬼')])
    expect(all[0]).toBe('神')
    expect([...all].sort()).toEqual(['侍', '神', '鬼'].sort())
    expect(allTags([def('b', ['神'], '鬼')], true)).toEqual(['神'])
    expect(parseTags('ドラゴン、侍  神,神')).toEqual(['ドラゴン', '侍', '神'])
  })
  it('コラボの子のタグはそのコラボの中だけで一致し、候補もそのコラボの中だけに出る', () => {
    const boss = def('boss', ['因縁'], '鬼')
    const defs = [boss, def('x', ['因縁'], '鬼'), def('y', ['因縁']), def('z', [], '鬼')]
    expect(tagMates(boss, defs).map((d) => d.id)).toEqual(['x', 'z']) // x はタグとコラボの2つ一致、z はコラボだけ
    expect(tagSuggestions(defs, '鬼')).toEqual(['因縁'])
    expect(tagSuggestions([def('y', ['因縁']), def('w', ['侍'], '鬼')], '')).toEqual(['因縁'])
  })
})
