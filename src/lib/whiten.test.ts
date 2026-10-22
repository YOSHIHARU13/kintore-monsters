import { describe, expect, it } from 'vitest'
import { whitenPixels } from './whiten'

/** 5×5：まわりが黒、真ん中3×3が赤で、そのさらに真ん中が黒（キャラの中の黒） */
function sample() {
  const w = 5
  const data = new Uint8ClampedArray(w * w * 4)
  for (let i = 0; i < w * w; i++) {
    const x = i % w
    const y = Math.floor(i / w)
    const inner = x >= 1 && x <= 3 && y >= 1 && y <= 3
    const center = x === 2 && y === 2
    const [r, g, b] = inner && !center ? [200, 30, 30] : [5, 5, 5]
    data.set([r, g, b, 255], i * 4)
  }
  return data
}
const px = (d: Uint8ClampedArray, x: number, y: number) => [...d.slice((y * 5 + x) * 4, (y * 5 + x) * 4 + 3)]

describe('黒背景を白に', () => {
  it('ふちとつながった黒だけ白になり、キャラの中の黒は残る', () => {
    const d = sample()
    expect(whitenPixels(d, 5, 5, 40)).toBe(16)
    expect(px(d, 0, 0)).toEqual([255, 255, 255])
    expect(px(d, 2, 2)).toEqual([5, 5, 5]) // 中の黒は残る
    expect(px(d, 1, 1)).toEqual([200, 30, 30]) // 赤は明るいのでそのまま
  })
})
