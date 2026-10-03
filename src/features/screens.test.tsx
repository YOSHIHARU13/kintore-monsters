// @vitest-environment jsdom
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameState, MonsterDef, OwnedMonster, SetRecord } from '../types'

// Firebaseにはつながず、画面だけをニセのデータで動かして確認する
const fake = vi.hoisted(() => ({ store: {} as Record<string, unknown> }))
vi.mock('../store', () => ({ useStore: () => fake.store }))
vi.mock('../lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }))

import { Home } from './Home'
import { Training } from './Training'
import { SetInput } from './SetInput'
import { MenuEdit } from './MenuEdit'
import { Cardio } from './Cardio'
import { Box } from './Box'
import { MonsterDetail } from './MonsterDetail'
import { Shop } from './Shop'
import { Dex } from './Dex'
import { MonsterForm } from './MonsterForm'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const TODAY = '2026-10-05' // 月曜
const state: GameState = {
  gold: 500,
  stones: 1,
  eggs: 1,
  exp: {
    chestArms: { trained: 200, bought: 100 },
    legs: { trained: 0, bought: 0 },
    backShoulders: { trained: 0, bought: 0 },
  },
  lifetimeExp: { chestArms: 300, legs: 120, backShoulders: 40 },
  attendance: 7,
  lastAttendanceDate: '2026-10-02',
  totalSets: 60,
  beatCount: 4,
  activeMonsterId: 'm1',
}
const defs: MonsterDef[] = [
  {
    id: 'm1',
    name: 'ムキドラ',
    attr: 'chestArms',
    templateId: 'lateBranch',
    images: {},
    names: { n2: 'ムキドラゴ', n3b: 'ヤミムキドラ' },
    createdAt: 1,
  },
  { id: 'm2', name: 'アシガメ', attr: 'legs', templateId: 'linear3', images: {}, createdAt: 2 },
]
const owned: OwnedMonster[] = [{ id: 'm1', nodeId: 'n2', invested: { trained: 250, bought: 250 }, obtainedAt: 1 }]

const past = (setNo: number, reps: number, ts: number, date: string): SetRecord => ({
  id: `${date}-${setNo}`,
  exerciseId: 'floorPress',
  slotId: 'mon2',
  day: 'mon',
  date,
  ts,
  setNo,
  weightKg: 5,
  reps,
  target: null,
  judge: 'normal',
  eligible: true,
  exp: 10,
  gold: 0,
})

let container: HTMLDivElement
const go = vi.fn()

async function render(el: ReactElement) {
  container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(el)
  })
  return container
}

const click = async (text: string) => {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
  if (!button) throw new Error(`ボタンが見つかりません: ${text}`)
  await act(async () => {
    button.click()
  })
}

beforeEach(() => {
  document.body.innerHTML = ''
  go.mockClear()
  fake.store = {
    state,
    menu: {},
    defs,
    owned,
    today: TODAY,
    todaySets: [],
    todayActivities: [],
    getHistory: vi.fn(async () => [past(1, 10, 1000, '2026-09-28'), past(2, 9, 2000, '2026-09-28')]),
    recordSet: vi.fn((rec: Omit<SetRecord, 'id' | 'ts' | 'date'>) => ({ ...rec, id: 'new', ts: Date.now(), date: TODAY })),
    recordCardio: vi.fn(),
    setSlot: vi.fn(),
    buyExp: vi.fn(),
    buyEgg: vi.fn(),
    hatchEgg: vi.fn(() => defs[1]),
    pourExp: vi.fn(),
    evolve: vi.fn(),
    setActive: vi.fn(),
    saveMonsterDef: vi.fn(async () => {}),
    loadImage: vi.fn(async () => null),
  }
})

describe('画面の表示', () => {
  it('ホーム：今日のメニュー・所持・累計・育成中モンスター', async () => {
    const el = await render(<Home go={go} />)
    expect(el.textContent).toContain('今日のメニュー：月曜・胸腕')
    expect(el.textContent).toContain('プッシュアップ')
    expect(el.textContent).toContain('500G')
    expect(el.textContent).toContain('ムキドラゴ') // 第2段階の名前
    await click('トレーニング開始')
    expect(go).toHaveBeenCalledWith({ name: 'training', day: 'mon' })
  })

  it('トレーニング：その日の枠とボーナス枠', async () => {
    const el = await render(<Training day="wed" go={go} />)
    expect(el.textContent).toContain('ブルガリアンスクワット')
    expect(el.textContent).toContain('腹筋ローラー（膝つき）')
    await click('ブルガリアンスクワット')
    expect(go).toHaveBeenCalledWith({ name: 'set', day: 'wed', slotId: 'wed1' })
  })

  it('セット入力：目標が入っていて1タップで確定、前回超えの演出が出る', async () => {
    const el = await render(<SetInput day="mon" slotId="mon2" go={go} />)
    expect(el.textContent).toContain('1セット目')
    expect(el.textContent).toContain('目標 11回') // 前回10回 → +1
    await click('11回で確定')
    const recordSet = fake.store.recordSet as ReturnType<typeof vi.fn>
    expect(recordSet).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: 'floorPress', setNo: 1, weightKg: 5, reps: 11, judge: 'beat', exp: 15 }),
      true,
    )
    expect(el.textContent).toContain('前回超え！！')
    expect(el.textContent).toContain('進化の石をゲット') // 累計4回 → 5回目
    expect(el.textContent).toContain('2セット目')
    // 直後の2セット目は30秒ルールで報酬対象外
    expect(el.textContent).toContain('休むと報酬の対象になります')
  })

  it('メニュー編集：候補を選ぶと差し替わる', async () => {
    await render(<MenuEdit day="mon" go={go} />)
    await click('プッシュアップ（バーで深く）')
    expect(fake.store.setSlot).toHaveBeenCalledWith('mon1', 'pushupBar')
  })

  it('サブメニュー：ワンタップで記録', async () => {
    await render(<Cardio go={go} />)
    await click('フィットボクシング')
    expect(fake.store.recordCardio).toHaveBeenCalledWith('fitBoxing', 'フィットボクシング', 10)
  })

  it('BOX・図鑑・ショップ', async () => {
    expect((await render(<Box go={go} />)).textContent).toContain('ムキドラ')
    const dex = await render(<Dex go={go} />)
    expect(dex.textContent).toContain('入手 1／登録 2')
    expect(dex.textContent).toContain('未入手')
    const shop = await render(<Shop go={go} />)
    await click('タマゴを孵す')
    expect(shop.textContent).toContain('アシガメ')
    expect(shop.textContent).toContain('が生まれた！')
  })

  it('モンスター詳細：EXPが満タンなら通常・分岐の両ルートに進化できる', async () => {
    const el = await render(<MonsterDetail id="m1" go={go} />)
    expect(el.textContent).toContain('500/500')
    expect(el.textContent).toContain('通常ルート')
    expect(el.textContent).toContain('分岐ルート')
    const buttons = [...el.querySelectorAll('button')].filter((b) => b.textContent === '進化する')
    expect(buttons).toHaveLength(2)
    await act(async () => buttons[1].click())
    expect(fake.store.evolve).toHaveBeenCalledWith('m1', 'n3b')
  })

  it('モンスター登録：名前を入れて保存', async () => {
    const el = await render(<MonsterForm go={go} />)
    expect(el.textContent).toContain('1→2 150EXP＋30G')
    await click('保存する')
    expect(el.textContent).toContain('名前を入力してください')
    const type = async (input: HTMLInputElement, value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    await type(el.querySelector('input')!, 'テストモン')
    await type(el.querySelector<HTMLInputElement>('input[aria-label="第2段階の名前"]')!, 'テストモン改')
    await click('保存する')
    expect(fake.store.saveMonsterDef).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'テストモン',
        attr: 'chestArms',
        templateId: 'linear3',
        names: { n2: 'テストモン改' },
      }),
    )
    expect(go).toHaveBeenCalledWith({ name: 'dex' })
  })
})
