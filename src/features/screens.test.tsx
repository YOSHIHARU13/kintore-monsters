// @vitest-environment jsdom
import { act, type ReactElement } from 'react'
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
  bestHabitStreak: 5,
  habitLabel: null,
  lastCheckinDate: '2026-10-03',
  dexFound: {},
  dexShiny: {},
  activeMonsterId: 'o1',
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
  id, name, bannerImageId: null, shinyRate: 1 / 20, rarity: {}, createdAt: 0, builtin: id === 'default', ...extra,
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
    setSlot: vi.fn(),
    buyExp: vi.fn(),
    buyEgg: vi.fn(),
    hatchEgg: vi.fn(() => ({ def: defs[1], monsterId: 'o2', shiny: false })),
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
  it('ホーム：今週の残りタスク・所持・累計・育成中モンスター', async () => {
    fake.store.weekSets = [past(1, 10, 1, TODAY, 'wed1'), past(2, 10, 2, TODAY, 'wed1')]
    const el = await render(<Home go={go} />)
    expect(el.textContent).toContain('今週の残りタスク：あと40セット')
    expect(el.textContent).toContain('残り10セット') // 脚は12セット中2セット済み
    expect(el.textContent).toContain('胸腕 0/5')
    expect(el.textContent).toContain('脚 0/4') // 3セットやりきった種目の数
    expect(el.textContent).toContain('ブルガリアンスクワット2/3')
    expect(el.textContent).not.toContain('腹筋ローラー') // ボーナス枠はタスク外
    expect(el.textContent).toContain('累計 2週')
    expect(el.textContent).toContain('500G')
    expect(el.textContent).toContain('ムキドラゴ') // 第2段階の名前
    expect(el.textContent).toContain('ベッドでスマホを見なかった：3日連続')
    expect(el.textContent).toContain('前日の歩数と習慣を記録する')
    await click('ブルガリアンスクワット')
    expect(go).toHaveBeenCalledWith({ name: 'set', slotId: 'wed1' })
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

  it('朝の記録：歩数と習慣を入れて記録', async () => {
    const el = await render(<Morning go={go} />)
    expect(el.textContent).toContain('10/4の分')
    const input = el.querySelector('input')!
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setValue.call(input, '6500')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(el.textContent).toContain('+23G')
    expect(el.textContent).toContain('あと1,500歩で +46G')
    expect(el.textContent).toContain('前日：ベッドでスマホを見なかった？')
    await click('できた（+10G）')
    await click('記録する（+33G）')
    expect(fake.store.recordMorning).toHaveBeenCalledWith(6500, true)
    expect(el.textContent).toContain('記録しました：+33G')
    expect(el.textContent).toContain('○（4日連続）')
  })

  it('朝の記録：記録済みなら結果だけ出る', async () => {
    fake.store.yesterdayCheckin = {
      date: '2026-10-04', steps: 5000, habit: false, habitLabel: '朝の光を浴びた', streak: 0, stepsGold: 20, habitGold: 0, ts: 1,
    }
    const el = await render(<Morning go={go} />)
    expect(el.textContent).toContain('記録しました：+20G')
    expect(el.textContent).toContain('朝の光を浴びた：×')
  })

  it('ショップ：色違いが生まれると特別な演出', async () => {
    fake.store.hatchEgg = vi.fn(() => ({ def: defs[1], monsterId: 'o2', shiny: true }))
    const shop = await render(<Shop go={go} />)
    expect(shop.textContent).toContain('色違い 1/20')
    await click('を引く')
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
    await click('進化する（300G）')
    expect(fake.store.evolve).toHaveBeenCalledWith('o1', 'n3a')
  })

  it('モンスター詳細：最終形態になるまでは合体できない', async () => {
    fake.store.owned = [...owned, { id: 'o3', defId: 'm1', nodeId: 'n1', obtainedAt: 3 }]
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).toContain('最終形態まで進化すると')
    expect(el.textContent).toContain('いま食べさせられるムキドラ：1体')
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
    expect(el.textContent).not.toContain('食べさせる') // ゲージが満タンになるまでは食べさせられない
    await click('胸腕EXPを注ぐ（+200）')
    expect(fake.store.pourPlusExp).toHaveBeenCalledWith('o1', 'chestArms')
    await click('万能EXPを注ぐ（+30）')
    expect(fake.store.pourPlusExp).toHaveBeenCalledWith('o1', 'any')
  })

  it('モンスター詳細：ゲージが満タンなら食べさせられる（別のモンスターは不可）', async () => {
    fake.store.owned = [
      { id: 'o1', defId: 'm1', nodeId: 'n3a', plus: 2, plusExp: { trained: 300, bought: 0 }, obtainedAt: 1 },
      { id: 'o3', defId: 'm1', nodeId: 'n1', obtainedAt: 3 },
      { id: 'o4', defId: 'm2', nodeId: 'n1', obtainedAt: 4 },
    ]
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).not.toContain('アシガメ')
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
    expect(el.textContent).toContain('？？？ ← ムキドラ＋5 ＆ アシガメ＋5')
    await click('アシガメ＋5とジョグレス')
    await click('本当にジョグレスする（1000G）')
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
    expect(dex.textContent).toContain('いちばん育っているのは2段階')
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
    const options = [...el.querySelectorAll('option')].map((o) => o.value)
    expect(options).toEqual(['lateBranch', 'lateBranch3'])
    const select = el.querySelector('select')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'lateBranch3')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(el.textContent).toContain('最終C')
    await click('保存する')
    expect(fake.store.saveMonsterDef).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'm1',
        templateId: 'lateBranch3',
        attrs: { n1: 'chestArms', n2: 'chestArms', n3a: 'chestArms', n3b: 'legs', n3c: 'chestArms' },
      }),
    )
  })

  it('ショップ：ガチャを選ぶと中身と確率が出る。ハズレ枠はどのガチャにも入る', async () => {
    fake.store.gachas = [gachas[0], gacha('g1', '脚まつり', { rarity: { m2: 'superRare' }, createdAt: 1 })]
    fake.store.defs = [
      { ...defs[0], gachas: ['g1'] },
      { ...defs[1], gachas: ['g1'] },
      { id: 'c1', name: 'ザコスラ', attr: 'none', templateId: 'linear3', images: {}, common: true, createdAt: 3 },
    ]
    const el = await render(<Shop go={go} />)
    // 中身がいる、いちばん新しいガチャが選ばれている
    expect(el.textContent).toContain('「脚まつり」を引く')
    expect(el.textContent).toContain('全3種')
    expect(el.textContent).toContain('激レア 4.76%') // 1 ÷ (10 + 1 + 10)
    expect(el.textContent).toContain('ハズレ枠 47.6%')
    expect(el.textContent).toContain('？？？') // まだ会っていないモンスターは名前を伏せる
    await click('いつものガチャ')
    expect(el.textContent).toContain('全1種') // ハズレ枠だけ
    await click('「いつものガチャ」を引く')
    expect(fake.store.hatchEgg).toHaveBeenCalledWith('default')
  })

  it('ガチャ編集：レア度を変えると確率が変わり、保存できる', async () => {
    fake.store.gachas = [gachas[0], gacha('g1', '脚まつり', { createdAt: 1 })]
    fake.store.defs = [{ ...defs[0], gachas: ['g1'] }, { ...defs[1], gachas: ['g1'] }]
    const el = await render(<GachaForm id="g1" go={go} />)
    expect(el.textContent).toContain('全2種')
    expect(el.textContent).toContain('50%')
    const row = [...el.querySelectorAll('.rarity-row')].find((r) => r.textContent?.includes('アシガメ'))!
    await act(async () => [...row.querySelectorAll('button')].find((b) => b.textContent === '激レア')!.click())
    expect(el.textContent).toContain('90.9%')
    expect(el.textContent).toContain('9.09%')
    await click('1/10')
    await click('保存する')
    expect(fake.store.saveGacha).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'g1', name: '脚まつり', shinyRate: 1 / 10, rarity: { m2: 'superRare' } }),
    )
    await click('このガチャを消す')
    await click('本当に消す')
    expect(fake.store.deleteGacha).toHaveBeenCalledWith('g1')
  })

  it('モンスター登録：入るガチャは3つまで', async () => {
    fake.store.gachas = [gachas[0], ...[1, 2, 3, 4].map((n) => gacha(`g${n}`, `ガチャ${n}`, { createdAt: n }))]
    const el = await render(<MonsterForm go={go} />)
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
        common: false,
      }),
    )
    expect(go).toHaveBeenCalledWith({ name: 'registry' })
  })
})
