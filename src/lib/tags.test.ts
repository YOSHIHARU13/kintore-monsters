import { describe, expect, it } from 'vitest'
import { allTags, parseTags, sharedTags, tagRate } from './tags'
import type { MonsterDef } from '../types'

const def = (id: string, tags: string[]) => ({ id, name: id, templateId: 'single', images: {}, createdAt: 0, tags }) as MonsterDef

describe('タグ', () => {
  it('ボスと一致したタグの数だけダメージが上がる（3つまで）', () => {
    const quest = { bossTags: ['ドラゴン', '炎の民', '神', '王'] }
    expect(sharedTags(def('a', ['ドラゴン', '侍']), quest)).toEqual(['ドラゴン'])
    expect(tagRate(def('a', ['ドラゴン']), quest)).toBeCloseTo(1.15)
    expect(tagRate(def('b', ['ドラゴン', '炎の民', '神', '王']), quest)).toBeCloseTo(1.45) // 3つまで
    expect(tagRate(def('c', []), quest)).toBe(1)
  })
  it('一覧は多い順。入力は読点や空白で区切れる', () => {
    expect(allTags([def('a', ['侍', '神']), def('b', ['神'])])).toEqual(['神', '侍'])
    expect(parseTags('ドラゴン、侍  神,神')).toEqual(['ドラゴン', '侍', '神'])
  })
})
