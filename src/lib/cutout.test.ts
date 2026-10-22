import { describe, expect, it } from 'vitest'
import { clearWhiteBackground } from './cutout'

describe('白い背景を透明に', () => {
  it('ふちとつながった白だけ透明になり、キャラの中の白は残る', () => {
    // 5×5：まわりが白、内側3×3が赤、真ん中が白（キャラの中の白）
    const data = new Uint8ClampedArray(25 * 4)
    for (let i = 0; i < 25; i++) {
      const x = i % 5
      const y = Math.floor(i / 5)
      const ring = x === 0 || y === 0 || x === 4 || y === 4
      const c = ring || (x === 2 && y === 2) ? [255, 255, 255] : [200, 30, 30]
      data.set([...c, 255], i * 4)
    }
    expect(clearWhiteBackground(data, 5, 5)).toBe(16)
    expect(data[3]).toBe(0) // 角は透明
    expect(data[12 * 4 + 3]).toBe(255) // 中の白は残る
    expect(data[6 * 4 + 3]).toBe(255) // 赤は残る
  })
})
