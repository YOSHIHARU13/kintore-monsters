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
  it('茶色→黒のグラデーションの背景もたどれる', () => {
    const row = [[90, 60, 30], [70, 45, 22], [45, 30, 15], [20, 12, 6]]
    const data = new Uint8ClampedArray(4 * 4)
    row.forEach((c, i) => data.set([...c, 255], i * 4))
    whitenPixels(data, 4, 1, 100)
    expect([...data]).toEqual(new Array(16).fill(255))
  })
  it('茶色の背景は、キャラの黒い輪郭（背景と色がはっきり違う）で止まる', () => {
    // 5×5：まわりが茶色、内側3×3が黒い輪郭、真ん中が明るいキャラ
    const data = new Uint8ClampedArray(25 * 4)
    for (let i = 0; i < 25; i++) {
      const x = i % 5
      const y = Math.floor(i / 5)
      const ring = x === 0 || y === 0 || x === 4 || y === 4
      const c = ring ? [90, 60, 30] : x === 2 && y === 2 ? [230, 200, 180] : [0, 0, 0]
      data.set([...c, 255], i * 4)
    }
    expect(whitenPixels(data, 5, 5, 100)).toBe(16)
    expect(data[(1 * 5 + 1) * 4]).toBeLessThan(255) // 輪郭は残る（境目なので少し明るくなるだけ）
    expect([...data.slice(12 * 4, 12 * 4 + 3)]).toEqual([230, 200, 180])
  })
})
