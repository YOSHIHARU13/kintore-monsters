import { describe, expect, it } from 'vitest'
import { slidesOf } from './GachaBanner'
import type { Gacha } from '../types'

const gacha = (slides: Gacha['slides']): Gacha => ({
  id: 'g', name: 'g', bannerImageId: null, shinyRate: 0.05, catchphrase: '', theme: 'royal',
  featured: [], slides, createdAt: 0, builtin: false,
})

describe('slidesOf', () => {
  it('選んでいなければ、出せる型を全部（5体いれば3体の型は重ねない）', () => {
    expect(slidesOf(gacha([]), 5, 2)).toEqual(['top1', 'top5', 'pickups'])
    expect(slidesOf(gacha([]), 3, 0)).toEqual(['top1', 'top3'])
  })
  it('目玉が足りない型は飛ばす', () => {
    expect(slidesOf(gacha(['top5', 'top3']), 3, 0)).toEqual(['top3'])
    expect(slidesOf(gacha(['top5']), 1, 0)).toEqual(['top1'])
  })
})
