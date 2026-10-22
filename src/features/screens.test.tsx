// @vitest-environment jsdom
import { act, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Gacha, GameState, MonsterDef, OwnedMonster, SetRecord } from '../types'

// Firebaseにはつながず、画面だけをニセのデータで動かして確認する
const fake = vi.hoisted(() => ({ store: {} as Record<string, unknown> }))
vi.mock('../store', () => ({ useStore: () => fake.store }))
vi.mock('../lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }))

import { Home } from './Home'
import { Training } from './Training'
import { SetInput } from './SetInput'
import { MenuEdit } from './MenuEdit'
import { Morning } from './Morning'
import { Box } from './Box'
import { MonsterDetail } from './MonsterDetail'
import { Shop } from './Shop'
import { Dex } from './Dex'
import { MonsterRegistry } from './MonsterRegistry'
import { MonsterForm } from './MonsterForm'
import { GachaForm } from './GachaForm'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const TODAY = '2026-10-05' // 月曜
const state: GameState = {
  gold: 500,
  eggs: 1,
  exp: {
    chestArms: { trained: 200, bought: 100 },
    legs: { trained: 0, bought: 0 },
    backShoulders: { trained: 0, bought: 0 },
  },
  lifetimeExp: { chestArms: 300, legs: 120, backShoulders: 40 },
  anyExp: 30,
  attendance: 7,
  lastAttendanceDate: '2026-10-02',
  totalSets: 60,
  beatCount: 4,
  weeklyClears: 2,
  lastClearWeek: '2026-09-21',
  habitStreak: 3,
  habitDate: '2026-10-04',
  habitMinutesToday: 10,
  bestHabitStreak: 5,
  habitLabel: null,
  habitMode: 'check',
  lastCheckinDate: '2026-10-03',
  dexFound: {},
  dexShiny: {},
  pity: {},
  activeMonsterId: 'o1',
  partners: {},
  challenge: null,
  questClears: 0,
  cores: { chestArms: 2, none: 2 },
  coreMisses: {},
}
const defs: MonsterDef[] = [
  {
    id: 'm1',
    name: 'ムキドラ',
    attr: 'chestArms',
    templateId: 'lateBranch',
    images: {},
    names: { n2: 'ムキドラゴ', n3b: 'ヤミムキドラ' },
    attrs: { n1: 'chestArms', n2: 'chestArms', n3a: 'chestArms', n3b: 'legs' },
    createdAt: 1,
  },
  { id: 'm2', name: 'アシガメ', attr: 'legs', templateId: 'linear3', images: {}, createdAt: 2 },
]
const gacha = (id: string, name: string, extra: Partial<Gacha> = {}): Gacha => ({
  id, name, bannerImageId: null, shinyRate: 1 / 20, catchphrase: '', theme: 'royal', featured: [], createdAt: 0,
  builtin: id === 'default', ...extra,
})
const gachas: Gacha[] = [gacha('default', 'いつものガチャ')]
const owned: OwnedMonster[] = [{ id: 'o1', defId: 'm1', nodeId: 'n2', invested: { trained: 250, bought: 250 }, obtainedAt: 1 }]

const past = (setNo: number, reps: number, ts: number, date: string, slotId = 'mon2'): SetRecord => ({
  id: `${date}-${slotId}-${setNo}`,
  exerciseId: 'floorPress',
  slotId,
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

const tapBanner = async (name: string) => {
  const banner = container.querySelector<HTMLElement>(`[role="button"][aria-label="${name}"]`)
  if (!banner) throw new Error(`バナーが見つかりません: ${name}`)
  await act(async () => {
    banner.click()
  })
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
    weekSets: [],
    todaySets: [],
    songs: [],
    gachas,
    saveGacha: vi.fn(async () => 'g9'),
    deleteGacha: vi.fn(),
    yesterday: '2026-10-04',
    yesterdayCheckin: null,
    getHistory: vi.fn(async () => [past(1, 10, 1000, '2026-09-28'), past(2, 9, 2000, '2026-09-28')]),
    recordSet: vi.fn((rec: Omit<SetRecord, 'id' | 'ts' | 'date'>) => ({
      record: { ...rec, id: `new${Date.now()}`, ts: Date.now(), date: TODAY },
      weekCleared: false,
    })),
    recordMorning: vi.fn((steps: number, habit: boolean) => ({
      date: '2026-10-04',
      steps,
      habit,
      habitLabel: 'ベッドでスマホを見なかった',
      streak: habit ? 4 : 0,
      stepsGold: 23,
      habitGold: habit ? 10 : 0,
      ts: 1,
    })),
    setHabitLabel: vi.fn(),
    setHabitMode: vi.fn(),
    recordHabit: vi.fn(() => 20),
    setPartner: vi.fn(),
    quests: [],
    week: TODAY,
    saveQuest: vi.fn(),
    deleteQuest: vi.fn(),
    startChallenge: vi.fn(),
    quitChallenge: vi.fn(),
    claimQuest: vi.fn(() => ({ monsterId: 'o8', cores: 1, coreKey: 'legs', corePity: false, gold: 50 })),
    exchangeCores: vi.fn(),
    setSlot: vi.fn(),
    buyExp: vi.fn(),
    buyEgg: vi.fn(),
    hatchEgg: vi.fn(() => ({ def: defs[1], monsterId: 'o2', shiny: false, pity: false })),
    pourExp: vi.fn(),
    evolve: vi.fn(),
    pourPlusExp: vi.fn(),
    fuse: vi.fn(),
    jogress: vi.fn(() => 'o9'),
    setActive: vi.fn(),
    saveMonsterDef: vi.fn(async () => {}),
    loadImage: vi.fn(async () => null),
  }
})

describe('画面の表示', () => {
  it('ホーム：今週の進み具合と次にやる種目、もうすぐ進化', async () => {
    fake.store.weekSets = [past(1, 10, 1, TODAY, 'wed1'), past(2, 10, 2, TODAY, 'wed1')]
    const el = await render(<Home go={go} />)
    expect(el.textContent).toContain('今週の残りタスク：あと40セット')
    expect(el.textContent).toContain('残り10') // 脚は12セット中2セット済み
    expect(el.textContent).toContain('胸腕 0/5')
    expect(el.textContent).not.toContain('腹筋ローラー') // ボーナス枠はタスク外
    expect(el.textContent).toContain('累計 2週')
    expect(el.textContent).toContain('もうすぐ進化')
    expect(el.textContent).toContain('ムキドラゴ') // 第2段階の名前
    expect(el.textContent).toContain('進化まで あと0EXP')
    expect(el.textContent).toContain('🧘 ベッドでスマホを見なかった')
    expect(el.textContent).toContain('3日連続')
    // 途中の種目を先に片付ける
    await click('次にやる：ブルガリアンスクワット（2/3）')
    expect(go).toHaveBeenCalledWith({ name: 'set', slotId: 'wed1' })
    await click('前日の歩数を記録する')
    expect(go).toHaveBeenCalledWith({ name: 'morning' })
  })

  it('ホーム：朝の記録が済んだら1行にまとまる', async () => {
    fake.store.state = { ...state, lastCheckinDate: '2026-10-04' }
    fake.store.yesterdayCheckin = {
      date: '2026-10-04', steps: 8200, habit: false, habitLabel: '', streak: 0, stepsGold: 54, habitGold: 0, ts: 1,
    }
    const el = await render(<Home go={go} />)
    expect(el.textContent).toContain('昨日 8,200歩・+54G')
    expect(el.textContent).not.toContain('前日の歩数を記録する')
  })

  it('上の所持：G・タマゴ・EXPがいつも見えて、増えると +N が浮かぶ', async () => {
    const { TopBar } = await import('../components/TopBar')
    let rerender = () => {}
    function Harness() {
      const [, setTick] = useState(0)
      rerender = () => setTick((t) => t + 1)
      return <TopBar go={go} />
    }
    const el = await render(<Harness />)
    expect(el.textContent).toContain('500')
    expect(el.textContent).toContain('300') // 胸腕（筋トレ200＋購入100）
    fake.store.state = { ...state, gold: 520 }
    await act(async () => rerender())
    expect(el.querySelector('.topbar-pop')?.textContent).toBe('+20')
    await click('⚙️')
    expect(go).toHaveBeenCalledWith({ name: 'settings' })
  })

  it('相棒：枠ごとにセットでき、セット入力のEXPに倍率がかかる', async () => {
    const { PartnerPick } = await import('./PartnerPick')
    fake.store.defs = [{ ...defs[0], favoriteSlot: 'mon2' }, defs[1]]
    fake.store.owned = [{ ...owned[0], plus: 2 }, { id: 'o2', defId: 'm2', nodeId: 'n1', obtainedAt: 2 }]
    const pick = await render(<PartnerPick slotId="mon2" go={go} />)
    // ムキドラゴ：ノーマルの★5＋2 → 攻撃力 2×3,000＋1,500＋2×1,500 = 10,500 → (1 + 0.175) × 1.2（得意種目）= 1.41
    expect(pick.textContent).toContain('攻撃力 10,500')
    expect(pick.textContent).toContain('EXP×1.41')
    expect(pick.textContent).toContain('得意種目！')
    await click('ムキドラゴ')
    expect(fake.store.setPartner).toHaveBeenCalledWith('mon2', 'o1')
    fake.store.state = { ...state, partners: { mon2: 'o1' } }
    const el = await render(<SetInput slotId="mon2" go={go} />)
    expect(el.textContent).toContain('相棒：ムキドラ')
    await click('11回で確定')
    expect(fake.store.recordSet).toHaveBeenCalledWith(expect.objectContaining({ exp: 21 }), true) // 15 × 1.41
  })

  it('習慣：やった直後にその場で分数を記録してGをもらう（1日30分まで）', async () => {
    const { HabitCard } = await import('../components/HabitCard')
    fake.store.state = { ...state, habitMode: 'minutes', habitLabel: '瞑想', habitDate: TODAY, habitMinutesToday: 25 }
    const el = await render(<HabitCard />)
    expect(el.textContent).toContain('今日 25分（Gは30分まで）')
    expect(el.textContent).toContain('10分（+10G）') // 残り5分ぶんだけ
    await click('10分')
    expect(fake.store.recordHabit).toHaveBeenCalledWith(10)
    expect(el.textContent).toContain('瞑想 10分 → +20G')
  })

  it('習慣：○×なら1日1回「できた」', async () => {
    const { HabitCard } = await import('../components/HabitCard')
    await render(<HabitCard />)
    await click('今日できた（+10G）')
    expect(fake.store.recordHabit).toHaveBeenCalledWith(0)
    fake.store.state = { ...state, habitDate: TODAY }
    expect((await render(<HabitCard />)).textContent).toContain('今日はできた！')
  })

  it('トレーニング：全部位の枠とボーナス枠が1画面に並ぶ', async () => {
    const el = await render(<Training go={go} />)
    expect(el.textContent).toContain('プッシュアップ')
    expect(el.textContent).toContain('ブルガリアンスクワット')
    expect(el.textContent).toContain('ワンハンドロウ')
    expect(el.textContent).toContain('腹筋ローラー（膝つき）')
    await click('ブルガリアンスクワット')
    expect(go).toHaveBeenCalledWith({ name: 'set', slotId: 'wed1' })
  })

  it('セット入力：目標が入っていて1タップで確定、前回超えの演出が出る', async () => {
    const el = await render(<SetInput slotId="mon2" go={go} />)
    expect(el.textContent).toContain('今週 1セット目')
    expect(el.textContent).toContain('目標 11回') // 前回10回 → +1
    await click('11回で確定')
    const recordSet = fake.store.recordSet as ReturnType<typeof vi.fn>
    expect(recordSet).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: 'floorPress',
        day: 'mon',
        setNo: 1,
        weightKg: 5,
        reps: 11,
        judge: 'beat',
        exp: 15,
      }),
      true,
    )
    expect(el.textContent).toContain('前回超え！！')
    expect(el.textContent).toContain('今週 2セット目')
    // 直後の2セット目は30秒ルールで報酬対象外
    expect(el.textContent).toContain('休むと報酬の対象になります')
  })

  it('セット入力：今週3セット終えた種目は2周目（EXP半分）', async () => {
    fake.store.weekSets = [1, 2, 3].map((n) => past(n, 10, n, '2026-10-06'))
    fake.store.today = '2026-10-07'
    const el = await render(<SetInput slotId="mon2" go={go} />)
    expect(el.textContent).toContain('今週 2周目 1セット目')
    expect(el.textContent).toContain('EXPは50%')
    await click('回で確定')
    expect(fake.store.recordSet).toHaveBeenCalledWith(expect.objectContaining({ eligible: true }), expect.anything())
  })

  it('セット入力：2周目まで終えた種目は記録のみ', async () => {
    fake.store.weekSets = [1, 2, 3, 4, 5, 6].map((n) => past(n, 10, n, '2026-10-06'))
    fake.store.today = '2026-10-07'
    const el = await render(<SetInput slotId="mon2" go={go} />)
    expect(el.textContent).toContain('記録のみ')
    await click('回で確定')
    expect(fake.store.recordSet).toHaveBeenCalledWith(expect.objectContaining({ eligible: false, exp: 0 }), false)
  })

  it('セット入力：全消しした瞬間に演出が出る', async () => {
    fake.store.recordSet = vi.fn((rec: Omit<SetRecord, 'id' | 'ts' | 'date'>) => ({
      record: { ...rec, id: 'last', ts: Date.now(), date: TODAY },
      weekCleared: true,
    }))
    const el = await render(<SetInput slotId="mon2" go={go} />)
    await click('回で確定')
    expect(el.textContent).toContain('今週 全消し！！')
    expect(el.textContent).toContain('+150G')
    expect(el.textContent).toContain('累計 3週目')
  })

  it('メニュー編集：候補を選ぶと差し替わる', async () => {
    await render(<MenuEdit day="mon" go={go} />)
    await click('プッシュアップ（バーで深く）')
    expect(fake.store.setSlot).toHaveBeenCalledWith('mon1', 'pushupBar')
  })

  it('朝の記録：前日の歩数を入れて記録（150歩ごとに1G）', async () => {
    fake.store.recordMorning = vi.fn((steps: number) => ({
      date: '2026-10-04', steps, habit: false, habitLabel: '', streak: 0, stepsGold: Math.floor(steps / 150), habitGold: 0, ts: 1,
    }))
    const el = await render(<Morning go={go} />)
    expect(el.textContent).toContain('10/4の分')
    const input = el.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '6500')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('記録する（+43G）')
    expect(fake.store.recordMorning).toHaveBeenCalledWith(6500)
    expect(el.textContent).toContain('記録しました：+43G')
  })

  it('朝の記録：記録済みなら結果だけ出る', async () => {
    fake.store.yesterdayCheckin = {
      date: '2026-10-04', steps: 5000, habit: false, habitLabel: '', streak: 0, stepsGold: 33, habitGold: 0, ts: 1,
    }
    const el = await render(<Morning go={go} />)
    expect(el.textContent).toContain('記録しました：+33G')
    expect(el.textContent).toContain('歩数 5,000歩')
  })

  it('ショップ：色違いが生まれると特別な演出', async () => {
    fake.store.hatchEgg = vi.fn(() => ({ def: defs[1], monsterId: 'o2', shiny: true, pity: false }))
    const shop = await render(<Shop go={go} />)
    expect(shop.textContent).toContain('色違い 1/20')
    await click('を引く')
    await click('スキップ')
    expect(shop.textContent).toContain('色違い！！')
    expect(shop.querySelector('.shiny')).not.toBeNull()
  })

  it('BOX・図鑑・ショップ', async () => {
    expect((await render(<Box go={go} />)).textContent).toContain('ムキドラ')
    const registry = await render(<MonsterRegistry go={go} />)
    expect(registry.textContent).toContain('入手 1／登録 2')
    expect(registry.textContent).toContain('未入手')
    // 全体図鑑：ムキドラは第2段階まで（2形態）発見、アシガメは未入手
    const dex = await render(<Dex go={go} />)
    expect(dex.textContent).toContain('発見 2／全 7 形態')
    expect(dex.textContent).toContain('ムキドラゴ')
    expect(dex.textContent).not.toContain('ヤミムキドラ') // 進化していない形態の名前は伏せる
    expect(dex.textContent).not.toContain('アシガメ')
    // 同じモンスターをもう1体、別の進化先に育てると、その形態も埋まる
    fake.store.owned = [...owned, { id: 'o3', defId: 'm1', nodeId: 'n3b', obtainedAt: 2 }]
    const dex2 = await render(<Dex go={go} />)
    expect(dex2.textContent).toContain('発見 3／全 7 形態')
    expect(dex2.textContent).toContain('ヤミムキドラ')
    expect(dex2.textContent).toContain('所持2体')
    expect((await render(<Box go={go} />)).textContent).toContain('所持 2体')
    const shop = await render(<Shop go={go} />)
    await click('「いつものガチャ」を引く')
    expect(fake.store.hatchEgg).toHaveBeenCalledWith('default')
    expect(shop.textContent).not.toContain('が生まれた！') // まずはタマゴが揺れる
    await click('スキップ')
    expect(shop.querySelectorAll('.hatch-stars span')).toHaveLength(1) // 生まれたときは、レア度に関係なく★1
    expect(shop.textContent).toContain('アシガメ')
    expect(shop.textContent).toContain('が生まれた！')
    await click('会いに行く')
    expect(go).toHaveBeenCalledWith({ name: 'monster', id: 'o2' })
  })

  it('モンスター詳細：進化先ごとに、その属性のEXPを注いで進化する', async () => {
    const el = await render(<MonsterDetail id="o1" go={go} />)
    // 胸腕の進化先は満タン（旧形式のデータも通常ルートに数える）、脚の進化先はまだ0
    expect(el.textContent).toContain('胸腕EXPで進化')
    expect(el.textContent).toContain('500/500')
    expect(el.textContent).toContain('脚EXPで進化')
    expect(el.textContent).toContain('0/500')
    expect(el.textContent).not.toContain('進化の石')
    await click('進化する（200G・剛腕の核×2）')
    expect(fake.store.evolve).toHaveBeenCalledWith('o1', 'n3a')
  })

  it('モンスター詳細：最終形態になるまでは合体できない', async () => {
    fake.store.owned = [...owned, { id: 'o3', defId: 'm1', nodeId: 'n1', obtainedAt: 3 }]
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).toContain('最終形態まで進化すると')
    expect(el.textContent).toContain('いま食べさせられるモンスター：1体')
    expect(el.textContent).not.toContain('食べさせる（')
  })

  it('モンスター詳細：最終形態はEXPを注いでから、同じモンスターを食べさせて＋1', async () => {
    fake.store.owned = [
      { id: 'o1', defId: 'm1', nodeId: 'n3a', plus: 2, plusExp: { trained: 100, bought: 0 }, shiny: true, obtainedAt: 1 },
      { id: 'o3', defId: 'm1', nodeId: 'n1', obtainedAt: 3 },
      { id: 'o4', defId: 'm2', nodeId: 'n1', obtainedAt: 4 },
    ]
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).toContain('✨ムキドラ＋2')
    expect(el.textContent).toContain('合体（＋2／5）')
    expect(el.textContent).toContain('100/300')
    expect(el.querySelector('.frame.plus-2 .shiny')).not.toBeNull()
    // ゲージが満タンになるまでは食べさせられない
    expect([...el.querySelectorAll('button')].some((b) => b.textContent === '食べさせる')).toBe(false)
    await click('胸腕EXPを注ぐ（+200）')
    expect(fake.store.pourPlusExp).toHaveBeenCalledWith('o1', 'chestArms')
    await click('万能EXPを注ぐ（+30）')
    expect(fake.store.pourPlusExp).toHaveBeenCalledWith('o1', 'any')
  })

  it('モンスター詳細：ゲージが満タンなら、同じモンスター（＋2）か同じ属性のモンスター（＋1）を食べさせられる', async () => {
    fake.store.defs = [
      { ...defs[0], element: 'fire' },
      { ...defs[1], element: 'water' },
      { id: 'm3', name: 'ヒノコ', attr: 'legs', templateId: 'early2', images: {}, element: 'fire', rarity: 'hazure', createdAt: 3 },
    ]
    fake.store.owned = [
      { id: 'o1', defId: 'm1', nodeId: 'n3a', plus: 2, plusExp: { trained: 300, bought: 0 }, obtainedAt: 1 },
      { id: 'o3', defId: 'm1', nodeId: 'n1', obtainedAt: 3 },
      { id: 'o4', defId: 'm2', nodeId: 'n1', obtainedAt: 4 },
      { id: 'o5', defId: 'm3', nodeId: 'n1', obtainedAt: 5 },
    ]
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).not.toContain('アシガメ') // 水は炎の素材にならない
    const rows = [...el.querySelectorAll('.mini-list li')].map((li) => li.textContent)
    expect(rows[0]).toContain('＋2（同じモンスター）')
    expect(rows[1]).toContain('ヒノコ')
    expect(rows[1]).toContain('＋1（同じ属性）')
    await click('食べさせる')
    await click('本当に食べさせる（300G）')
    expect(fake.store.fuse).toHaveBeenCalledWith('o1', 'o3')
  })

  it('モンスター詳細：＋5どうしでジョグレスすると隠しモンスターが生まれる', async () => {
    const hidden: MonsterDef = {
      id: 'h1', name: 'カイザードラ', attr: 'none', templateId: 'linear3', images: {}, recipe: ['m1', 'm2'], createdAt: 3,
    }
    fake.store.defs = [...defs, hidden]
    fake.store.state = { ...state, gold: 1500 }
    fake.store.owned = [
      { id: 'o1', defId: 'm1', nodeId: 'n3a', plus: 5, obtainedAt: 1 },
      { id: 'o2', defId: 'm2', nodeId: 'n3', plus: 5, obtainedAt: 2 },
    ]
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).toContain('？？？（★4で誕生）← ムキドラ ＆ アシガメ：どちらも★3以上')
    await click('アシガメ＋5とジョグレス')
    await click('本当にジョグレスする（600G・無垢の核×2）')
    expect(fake.store.jogress).toHaveBeenCalledWith('o1', 'o2', 'h1')
    expect(el.textContent).toContain('ジョグレス進化！！')
    expect(el.textContent).toContain('カイザードラ')
    await click('会いに行く')
    expect(go).toHaveBeenCalledWith({ name: 'monster', id: 'o9' })
  })

  it('図鑑：隠しモンスターはヒントだけ。合体でいなくなった個体の発見も残る', async () => {
    fake.store.defs = [
      ...defs,
      { id: 'h1', name: 'カイザードラ', attr: 'none', templateId: 'linear3', images: {}, recipe: ['m1', 'm2'], createdAt: 3 },
    ]
    fake.store.state = { ...state, dexFound: { m1: ['n1', 'n2', 'n3b'] }, dexShiny: { m1: true } }
    const dex = await render(<Dex go={go} />)
    expect(dex.textContent).toContain('ジョグレスのレシピ')
    expect(dex.textContent).toContain('いちばん育っているのは★2')
    expect(dex.textContent).toContain('アシガメ未所持')
    expect(dex.textContent).not.toContain('カイザードラ')
    expect(dex.textContent).toContain('ヤミムキドラ')
    expect(dex.textContent).toContain('ムキドラ ✨')
  })

  it('モンスター詳細：手持ちのEXPがあれば進化先を選んで注げる', async () => {
    fake.store.state = { ...state, exp: { ...state.exp, legs: { trained: 80, bought: 0 } } }
    await render(<MonsterDetail id="o1" go={go} />)
    await click('EXPを注ぐ（+80）')
    expect(fake.store.pourExp).toHaveBeenCalledWith('o1', 'n3b', 'legs')
  })

  it('モンスター詳細：無属性の進化先には、どの属性のEXPでも注げる', async () => {
    fake.store.defs = [{ ...defs[0], attrs: { ...defs[0].attrs, n3b: 'none' } }, defs[1]]
    fake.store.state = { ...state, exp: { ...state.exp, backShoulders: { trained: 60, bought: 0 } } }
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).toContain('無属性：どのEXPでも進化')
    await click('背肩のEXPを注ぐ（+60）')
    expect(fake.store.pourExp).toHaveBeenCalledWith('o1', 'n3b', 'backShoulders')
    await click('胸腕のEXPを注ぐ（+300・うち購入 100）')
    expect(fake.store.pourExp).toHaveBeenCalledWith('o1', 'n3b', 'chestArms')
  })

  it('モンスター編集：2種分岐のモンスターは3種分岐に増やせる', async () => {
    const el = await render(<MonsterForm id="m1" go={go} />)
    const options = [...el.querySelector('select')!.querySelectorAll('option')].map((o) => o.value)
    expect(options).toEqual(['lateBranch', 'lateBranch3'])
    const select = el.querySelector('select')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'lateBranch3')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(el.textContent).toContain('★3-C') // 分岐の3つ目（形態は星で表す）
    await click('保存する')
    expect(fake.store.saveMonsterDef).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'm1',
        templateId: 'lateBranch3',
        attrs: { n1: 'chestArms', n2: 'chestArms', n3a: 'chestArms', n3b: 'legs', n3c: 'chestArms' },
      }),
    )
  })

  it('ショップ：レア度ごとの確率と天井が出る。ハズレとノーマルはどのガチャにも入る', async () => {
    fake.store.gachas = [gachas[0], gacha('g1', '脚まつり', { createdAt: 1 })]
    fake.store.state = { ...state, pity: { g1: 27 } }
    fake.store.defs = [
      { ...defs[0], rarity: 'rare', gachas: ['g1'] },
      { ...defs[1], rarity: 'superRare', gachas: ['g1'] },
      { id: 'c1', name: 'ザコスラ', attr: 'none', templateId: 'early2', images: {}, rarity: 'hazure', createdAt: 3 },
      { id: 'c2', name: 'フツウドリ', attr: 'none', templateId: 'linear3', images: {}, createdAt: 4 },
      { id: 'r2', name: 'ツノウサ', attr: 'legs', templateId: 'linear3', images: {}, rarity: 'rare', gachas: ['g1'], createdAt: 5 },
    ]
    const el = await render(<Shop go={go} />)
    // 引けるガチャのうち、いちばん新しいものが選ばれている
    expect(el.textContent).toContain('「脚まつり」を引く')
    expect(el.textContent).toContain('全5種')
    expect(el.textContent).toContain('激レア 合計3%（1種）')
    expect(el.textContent).toContain('レア 合計12%（2種）')
    expect(el.textContent).toContain('ノーマル 合計35%（1種）')
    expect(el.textContent).toContain('ハズレ 合計50%（1種）')
    expect(el.textContent).toContain('激レア確定まで あと3回')
    expect(el.textContent).toContain('？？？') // まだ会っていないモンスターは名前を伏せる
    // いつものガチャにはレア・激レアがいないので、その分がハズレとノーマルに回る
    await tapBanner('いつものガチャ')
    expect(el.textContent).toContain('全2種')
    expect(el.textContent).toContain('ハズレ 合計58.8%')
    expect(el.textContent).not.toContain('確定まで')
    await click('「いつものガチャ」を引く')
    expect(fake.store.hatchEgg).toHaveBeenCalledWith('default')
  })

  it('ショップ：ピックアップが3体そろっていないガチャは準備中', async () => {
    fake.store.gachas = [gachas[0], gacha('g1', '脚まつり', { createdAt: 1 })]
    fake.store.defs = [...defs, { id: 'r1', name: 'ツノウサ', attr: 'legs', templateId: 'linear3', images: {}, rarity: 'rare', gachas: ['g1'], createdAt: 5 }]
    const el = await render(<Shop go={go} />)
    expect(el.textContent).toContain('「いつものガチャ」を引く') // 引けるガチャが選ばれている
    await tapBanner('脚まつり')
    expect(el.textContent).toContain('準備中：ピックアップ（レア以上）があと2体')
    expect(el.textContent).not.toContain('「脚まつり」を引く')
  })

  it('ガチャ作成：レア以上からピックアップを選ぶと、その場で確率が出る', async () => {
    fake.store.defs = [
      ...defs,
      { id: 'r1', name: 'ツノウサ', attr: 'legs', templateId: 'linear3', images: {}, rarity: 'rare', createdAt: 5 },
      { id: 's1', name: 'カミドラ', attr: 'legs', templateId: 'linear3', images: {}, rarity: 'superRare', element: 'fire', createdAt: 6 },
      {
        id: 'r3', name: 'イソガシ', attr: 'legs', templateId: 'linear3', images: {}, rarity: 'rare', gachas: ['a', 'b', 'c'], createdAt: 7,
      },
    ]
    const el = await render(<GachaForm go={go} />)
    expect(el.textContent).not.toContain('ムキドラ（') // ノーマルは選ぶ一覧に出ない
    const pick = async (name: string) => {
      const b = [...el.querySelectorAll('button.choice')].find((x) => x.textContent?.includes(name))!
      await act(async () => (b as HTMLButtonElement).click())
    }
    expect([...el.querySelectorAll('button.choice')].find((x) => x.textContent?.includes('イソガシ'))!.hasAttribute('disabled')).toBe(true)
    await pick('ツノウサ')
    await pick('カミドラ')
    expect(el.textContent).toContain('激レア 合計6%') // ハズレがいないので、その分が回る
    expect(el.textContent).toContain('あと1体で')
    const type = async (input: HTMLInputElement, value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    await type(el.querySelector('input')!, '脚まつり')
    // スライド式のバナー：①主役のズーム ②ほかのピックアップ ③主役の集合。色は主役の属性
    await type(el.querySelector<HTMLInputElement>('input[placeholder^="例：伝説"]')!, '伝説の脚竜、降臨！')
    const banner = el.querySelector('.banner-carousel')!
    expect(banner.classList.contains('tone-fire')).toBe(true) // 主役のカミドラ（激レア・炎）
    const hero = banner.querySelector('.slide-hero')!
    expect(hero.textContent).toContain('脚まつり')
    expect(hero.textContent).toContain('伝説の脚竜、降臨！')
    expect(hero.textContent).toContain('激レア登場')
    expect(hero.textContent).toContain('カミドラ')
    expect(banner.querySelector('.slide-pickups')!.textContent).toContain('ツノウサ')
    expect(banner.querySelectorAll('.slide-trio .trio-member')).toHaveLength(2)
    expect(banner.querySelectorAll('.banner-dots i')).toHaveLength(3)
    const featuredChip = [...el.querySelectorAll('button.chip')].find((b) => b.textContent === 'カミドラ')!
    await act(async () => (featuredChip as HTMLButtonElement).click())
    expect(el.querySelector('.slide-trio')).toBeNull() // 主役が1体なら集合のスライドはない
    await click('ガチャを作る')
    expect(fake.store.saveGacha).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '脚まつり', pickups: ['r1', 's1'], catchphrase: '伝説の脚竜、降臨！', featured: ['s1'],
      }),
    )
  })

  it('ガチャ編集：ジョグレスの最強形態もバナーに出せる', async () => {
    fake.store.gachas = [gachas[0], gacha('g1', '脚まつり', { createdAt: 1 })]
    fake.store.defs = [
      ...defs,
      { id: 's1', name: 'カミドラ', attr: 'legs', templateId: 'linear3', images: {}, rarity: 'superRare', gachas: ['g1'], createdAt: 6 },
      { id: 'j1', name: 'カイザードラ', attr: 'none', templateId: 'single', images: {}, recipe: ['s1', 'm1'], createdAt: 7 },
    ]
    const el = await render(<GachaForm id="g1" go={go} />)
    const chip = [...el.querySelectorAll('button.chip')].find((b) => b.textContent === '★4 カイザードラ（ジョグレス）')!
    await act(async () => (chip as HTMLButtonElement).click())
    expect(el.querySelector('.banner-carousel .slide-hero')!.textContent).toContain('ジョグレスで★4')
    await click('保存する')
    expect(fake.store.saveGacha).toHaveBeenCalledWith(expect.objectContaining({ featured: ['j1'] }))
  })

  it('クエスト作成：ボス・弱点・HPを決めて保存（HPには目安が入っている）', async () => {
    const { QuestForm } = await import('./QuestForm')
    fake.store.defs = [...defs, { id: 'b1', name: 'アシリュウ', attr: 'legs', templateId: 'linear3', images: {}, questOnly: true, createdAt: 9 }]
    const el = await render(<QuestForm go={go} />)
    const type = async (input: HTMLInputElement, value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    await type(el.querySelector('input')!, '脚竜の巣')
    expect(el.textContent).toContain('アシリュウ') // クエスト限定のモンスターだけがボス候補
    expect([...el.querySelectorAll('option')].map((o) => o.textContent)).not.toContain('ムキドラ')
    await click('胸腕：ダンベルカール')
    await click('＋バリアブレイカー')
    // 新しいアビリティは、ギミック名とセットで作る
    await type(el.querySelector<HTMLInputElement>('input[aria-label="新しいギミック"]')!, 'ゾーン')
    await type(el.querySelector<HTMLInputElement>('input[aria-label="対応するアビリティ"]')!, 'ゾーンブレイク')
    await click('追加')
    await click('クエストを作る')
    expect(fake.store.saveQuest).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '脚竜の巣', bossDefId: 'b1', attr: 'legs', weakSlots: ['mon4'],
        requirements: [{ tag: 'ab:バリア', count: 2 }, { tag: 'ab:ゾーン', count: 2 }],
        customGimmicks: { ゾーン: 'ゾーンブレイク' },
        hp: { easy: expect.any(Number), normal: expect.any(Number), hard: expect.any(Number) },
      }),
    )
  })

  it('クエスト詳細：効きやすい順にメンバーが並び、選んで挑戦できる', async () => {
    const { QuestDetail } = await import('./QuestDetail')
    const quest = {
      id: 'q1', name: '脚竜の巣', bossDefId: 'm2', attr: 'legs' as const, element: 'wood' as const, weakSlots: ['mon4'], gimmicks: ['バリア'],
      hp: { easy: 1000, normal: 3000, hard: 6000 }, catchphrase: '', theme: 'flame', createdAt: 1,
    }
    fake.store.quests = [quest]
    fake.store.defs = [{ ...defs[0], favoriteSlot: 'mon4', abilities: ['バリア'], element: 'fire' }, defs[1]]
    fake.store.owned = [owned[0], { id: 'o2', defId: 'm2', nodeId: 'n1', obtainedAt: 2 }]
    const el = await render(<QuestDetail id="q1" go={go} />)
    expect(el.textContent).toContain('バリアブレイカー0/2')
    expect(el.textContent).toContain('編成倍率 ×0.40')
    expect(el.textContent).toContain('ダンベルカール')
    const names = [...el.querySelectorAll('button.choice')].map((b) => b.textContent)
    expect(names[0]).toContain('ムキドラゴ') // 胸腕（脚に強い）・得意種目と特攻が弱点
    expect(names[0]).toContain('得意種目が弱点')
    expect(names[0]).toContain('バリアブレイカー') // ボスのギミックに対応している
    expect(names[1]).not.toContain('バリアブレイカー')
    // ボスクエストは難易度を選ばない。格（決めていなければ極）でHPと報酬が決まる
    expect(el.querySelector('[aria-label="難易度"]')).toBeNull()
    expect(el.textContent).toContain('HP 3,000・80Gドロップ アシガメ・たまに')
    await click('ムキドラゴ')
    expect(el.textContent).toContain('バリアブレイカー1/2') // 選ぶとメーターが埋まる
    await click('出撃する')
    expect(fake.store.startChallenge).toHaveBeenCalledWith('q1', 'normal', ['o1'])
  })

  it('クエスト：出撃してからのセットがダメージになり、倒したらその場で報酬を受け取れる', async () => {
    const { Quests } = await import('./Quests')
    const quest = {
      id: 'q1', name: '脚竜の巣', bossDefId: 'm2', attr: 'legs' as const, element: 'wood' as const, weakSlots: ['mon2'], gimmicks: [],
      hp: { easy: 25, normal: 25, hard: 25 }, catchphrase: '', theme: 'flame', createdAt: 1,
    }
    fake.store.quests = [quest]
    fake.store.state = {
      ...state,
      challenge: { date: TODAY, questId: 'q1', difficulty: 'easy', party: ['o1'], startTs: 10 },
    }
    // 開始前のセットは数えない。ムキドラゴ（胸腕・攻撃力7,500）がフロアプレス（弱点）を攻撃：2.5 × 2.5 × 2（部位一致）× 2（弱点）= 25
    fake.store.weekSets = [past(1, 10, 5, TODAY), past(2, 10, 20, TODAY)]
    const el = await render(<Quests go={go} />)
    expect(el.textContent).toContain('与えたダメージ 25 ／ HP 25')
    expect(el.textContent).toContain('討伐できる！')
    await click('報酬を受け取る')
    expect(fake.store.claimQuest).toHaveBeenCalled()
    expect(el.textContent).toContain('討伐成功！')
    expect(el.textContent).toContain('健脚の核 ×1 がドロップ！') // ボスクエストでも、たまに核が落ちる
    await click('会いに行く')
    expect(go).toHaveBeenCalledWith({ name: 'monster', id: 'o8' })
  })

  it('クエスト：日付が変わったら時間切れ。トレーニング画面には出撃中のHPが出る', async () => {
    const { Quests } = await import('./Quests')
    const quest = {
      id: 'q1', name: '脚竜の巣', bossDefId: 'm2', attr: 'legs' as const, weakSlots: [], gimmicks: [],
      hp: { easy: 500, normal: 500, hard: 500 }, catchphrase: '', theme: 'flame', createdAt: 1,
    }
    fake.store.quests = [quest]
    fake.store.state = { ...state, challenge: { date: '2026-10-04', questId: 'q1', difficulty: 'easy', party: ['o1'], startTs: 0 } }
    expect((await render(<Quests go={go} />)).textContent).toContain('「脚竜の巣」は時間切れでした')
    fake.store.state = { ...state, challenge: { date: TODAY, questId: 'q1', difficulty: 'easy', party: ['o1'], startTs: 0 } }
    const training = await render(<Training go={go} />)
    expect(training.textContent).toContain('⚔️ 脚竜の巣　のこりHP 500')
  })

  it('素材クエスト：倒すと核が落ちる（落ちないこともある）', async () => {
    const { Quests } = await import('./Quests')
    const quest = {
      id: 'q2', name: '脚の修練場', kind: 'material' as const, bossDefId: 'm2', attr: 'legs' as const, weakSlots: [],
      gimmicks: [], hp: { easy: 10, normal: 1500, hard: 3000 }, catchphrase: '', theme: 'forest', createdAt: 1,
    }
    fake.store.quests = [quest]
    fake.store.state = { ...state, challenge: { date: TODAY, questId: 'q2', difficulty: 'easy', party: ['o1'], startTs: 0 } }
    fake.store.weekSets = [past(1, 10, 5, TODAY)]
    fake.store.claimQuest = vi.fn(() => ({ monsterId: null, cores: 0, coreKey: 'legs', corePity: false, gold: 25 }))
    const el = await render(<Quests go={go} />)
    expect(el.textContent).toContain('💎 素材・健脚の核')
    await click('報酬を受け取る（健脚の核のチャンス')
    expect(el.textContent).toContain('今回は核が落ちなかった')
    expect(el.textContent).not.toContain('会いに行く')
  })

  it('ショップ：余った核はタマゴと交換できる', async () => {
    fake.store.state = { ...state, cores: { legs: 3, chestArms: 1 } }
    const el = await render(<Shop go={go} />)
    const row = [...el.querySelectorAll('.mini-list li')].find((li) => li.textContent?.includes('健脚の核'))!
    await act(async () => row.querySelector('button')!.click())
    expect(fake.store.exchangeCores).toHaveBeenCalledWith('legs')
    const chest = [...el.querySelectorAll('.mini-list li')].find((li) => li.textContent?.includes('剛腕の核'))!
    expect(chest.querySelector('button')!.disabled).toBe(true)
  })

  it('ショップ：天井で激レアが出ると演出に出る', async () => {
    fake.store.hatchEgg = vi.fn(() => ({ def: { ...defs[1], rarity: 'superRare' }, monsterId: 'o2', shiny: false, pity: true }))
    const shop = await render(<Shop go={go} />)
    await click('を引く')
    await click('スキップ')
    expect(shop.textContent).toContain('天井で確定！')
    expect(shop.textContent).toContain('激レア！')
  })

  it('ショップ：タマゴが揺れて、光の色と星が順に出てからモンスターが出る', async () => {
    vi.useFakeTimers()
    try {
      fake.store.hatchEgg = vi.fn(() => ({ def: { ...defs[1], rarity: 'superRare' }, monsterId: 'o2', shiny: false, pity: false }))
      const shop = await render(<Shop go={go} />)
      await click('を引く')
      expect(shop.querySelector('.hatch-egg.shaking')).not.toBeNull()
      await act(async () => vi.advanceTimersByTime(1100))
      expect(shop.querySelector('.glow-superRare .hatch-glow')).not.toBeNull()
      await act(async () => vi.advanceTimersByTime(800))
      for (let i = 0; i < 4; i++) await act(async () => vi.advanceTimersByTime(280))
      expect(shop.querySelectorAll('.hatch-stars span.on')).toHaveLength(1) // 激レアでも生まれたときは★1
      await act(async () => vi.advanceTimersByTime(560))
      expect(shop.textContent).toContain('激レア！')
      expect(shop.textContent).toContain('が生まれた！')
    } finally {
      vi.useRealTimers()
    }
  })

  it('ガチャ編集：中身をレア度ごとに見せ、名前と色違いの確率を保存できる', async () => {
    fake.store.gachas = [gachas[0], gacha('g1', '脚まつり', { createdAt: 1 })]
    fake.store.defs = [{ ...defs[0], rarity: 'rare', gachas: ['g1'] }, { ...defs[1], rarity: 'superRare', gachas: ['g1'] }]
    const el = await render(<GachaForm id="g1" go={go} />)
    expect(el.textContent).toContain('全2種')
    expect(el.textContent).toContain('レア 合計80%') // 12 ÷ (12 + 3)
    expect(el.textContent).toContain('激レア 合計20%')
    await click('1/10')
    await click('保存する')
    expect(fake.store.saveGacha).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1', name: '脚まつり', shinyRate: 1 / 10 }))
    await click('このガチャを消す')
    await click('本当に消す')
    expect(fake.store.deleteGacha).toHaveBeenCalledWith('g1')
  })

  it('モンスター登録：足りないものが分かり、おすすめで埋められ、刺さるクエストが出る', async () => {
    fake.store.quests = [
      {
        id: 'q1', name: '脚竜の巣', bossDefId: 'm2', attr: 'legs', weakSlots: ['wed1'],
        requirements: [{ tag: 'el:fire', count: 3 }, { tag: 'ab:シールド', count: 2 }],
        hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: 'flame', createdAt: 1,
      },
    ]
    const el = await render(<MonsterForm go={go} />)
    expect(el.textContent).toContain('胸腕 1体') // ムキドラ（最終形態に胸腕がある）
    expect(el.textContent).toContain('炎 0体／クエスト1不足')
    expect(el.textContent).toContain('シールドクラッシャー 0体／クエスト1不足')
    expect(el.textContent).toContain('特に刺さるクエストはまだありません') // 刺さらないクエストは出さない
    await click('足りないもので埋める')
    const favorite = [...el.querySelectorAll('select')].find((x) => x.textContent?.includes('プッシュアップ')) as HTMLSelectElement
    expect(favorite.value).toBe('wed1') // 弱点種目なのに得意なモンスターがいない
    expect(el.querySelector('.fit-good')).not.toBeNull() // 胸腕・シールドクラッシャー・得意種目が弱点 → ◎
    expect(el.textContent).toContain('脚竜の巣')
  })

  it('モンスター登録：進化しない降臨モンスターは「1形態だけ」＋クエスト限定で、星を選べる', async () => {
    const el = await render(<MonsterForm go={go} />)
    const type = async (input: HTMLInputElement, value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    await type(el.querySelector('input')!, 'コウリンオー')
    const select = el.querySelector('select')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'single')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await click('保存する')
    expect(el.textContent).toContain('クエスト限定のモンスター専用です')
    const questOnly = [...el.querySelectorAll('label.row')].find((l) => l.textContent?.includes('クエスト限定にする'))!
    await act(async () => questOnly.querySelector('input')!.click())
    await act(async () => el.querySelector('[aria-label="進化しないモンスターの星"]')!.querySelectorAll('button')[1].click())
    await click('保存する')
    expect(fake.store.saveMonsterDef).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'コウリンオー', templateId: 'single', questOnly: true, fixedStars: 2 }),
    )
  })

  it('モンスター登録：🎯このクエスト用にすると、条件に合わせて属性・アビリティ・得意種目が入る', async () => {
    fake.store.quests = [
      {
        id: 'q1', name: '脚竜の巣', bossDefId: 'm2', attr: 'legs', weakSlots: ['wed1'],
        requirements: [{ tag: 'el:water', count: 3 }, { tag: 'ab:シールド', count: 2 }],
        hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: 'flame', createdAt: 1,
      },
    ]
    const el = await render(<MonsterForm go={go} />)
    const picker = [...el.querySelectorAll('select')].find((x) => x.textContent?.includes('クエストを選ぶ'))!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(picker, 'q1')
      picker.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const on = [...el.querySelectorAll('button.chip.on')].map((b) => b.textContent)
    expect(on.some((t) => t?.startsWith('水'))).toBe(true)
    expect(on.some((t) => t?.startsWith('シールドクラッシャー'))).toBe(true)
    expect(el.textContent).toContain('◎ 脚竜の巣')
  })

  it('モンスター登録：入るガチャは3つまで', async () => {
    fake.store.gachas = [gachas[0], ...[1, 2, 3, 4].map((n) => gacha(`g${n}`, `ガチャ${n}`, { createdAt: n }))]
    const el = await render(<MonsterForm go={go} />)
    expect(el.textContent).not.toContain('ガチャ1') // ノーマルはどのガチャからも出るので選ばない
    await act(async () => el.querySelector('[aria-label="レア度"]')!.querySelectorAll('button')[2].click())
    expect(el.textContent).toContain('分岐ありのかっこいいやつ')
    for (const n of [1, 2, 3]) await click(`ガチャ${n}`)
    const g4 = [...el.querySelectorAll('button')].find((b) => b.textContent === 'ガチャ4')!
    expect(g4.disabled).toBe(true)
  })

  it('モンスター登録：名前を入れて保存', async () => {
    const el = await render(<MonsterForm go={go} />)
    expect(el.textContent).toContain('1→2 150EXP＋100G')
    await click('保存する')
    expect(el.textContent).toContain('名前を入力してください')
    const type = async (input: HTMLInputElement, value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    expect(el.textContent).not.toContain('大器晩成') // 5段階は新規登録では選べない
    await type(el.querySelector('input')!, 'テストモン')
    const chips = (label: string) => el.querySelector(`[aria-label="${label}の属性"]`)!.querySelectorAll('button')
    expect([...chips('第2段階')].map((b) => b.textContent)).toEqual(['胸腕', '脚', '背肩', '無'])
    await act(async () => chips('第2段階')[1].click())
    await act(async () => chips('第3段階（最終）')[3].click())
    await type(el.querySelector<HTMLInputElement>('input[aria-label="第2段階の名前"]')!, 'テストモン改')
    await click('保存する')
    expect(fake.store.saveMonsterDef).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'テストモン',
        templateId: 'linear3',
        attrs: { n1: 'chestArms', n2: 'legs', n3: 'none' },
        names: { n2: 'テストモン改' },
        gachas: [],
        rarity: 'normal',
      }),
    )
    expect(go).toHaveBeenCalledWith({ name: 'registry' })
  })
})
