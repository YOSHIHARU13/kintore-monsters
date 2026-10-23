import { describe, expect, it } from 'vitest'
import { elementInfo, elementName, jogressElementOf } from './element'
import type { MonsterDef } from '../types'

const def = (id: string, extra: Partial<MonsterDef> = {}): MonsterDef => ({
  id, name: id, attr: 'chestArms', templateId: 'linear3', images: {}, createdAt: 0, ...extra,
})

describe('ジョグレスの属性', () => {
  const defs = [def('f1', { element: 'fire' }), def('f2', { element: 'fire' }), def('w', { element: 'water' }), def('n')]

  it('同じ属性どうしなら超属性', () => {
    const info = jogressElementOf(['f1', 'f2'], defs)
    expect(info).toEqual({ elements: ['fire'], super: true })
    expect(elementName(info)).toBe('超炎')
  })

  it('違う属性どうしなら複合属性', () => {
    const info = jogressElementOf(['f1', 'w'], defs)
    expect(info).toEqual({ elements: ['fire', 'water'], super: false })
    expect(elementName(info)).toBe('炎×水')
  })

  it('無属性が入ると、もう片方の属性だけ', () => {
    expect(jogressElementOf(['f1', 'n'], defs)).toEqual({ elements: ['fire'], super: false })
  })

  it('隠しモンスターは保存された属性を使う', () => {
    const hidden = def('h', { recipe: ['f1', 'f2'], jogressElements: ['fire'], jogressSuper: true })
    expect(elementName(elementInfo(hidden))).toBe('超炎')
    expect(elementName(elementInfo(def('x')))).toBe('零属性')
  })
})
