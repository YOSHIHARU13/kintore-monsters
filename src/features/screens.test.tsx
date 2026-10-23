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
  clearedQuests: {},
  tower: null,
  boosters: {},
  boosts: {},
  freeClaims: {},
  claims: {},
  coins: 500,
  loginDays: 0,
  stats: null,
  cores: { chestArms: 2, none: 2 },
  coreMisses: {},
  questRules: 2,
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
  id, name, bannerImageId: null, shinyRate: 1 / 20, catchphrase: '', theme: 'royal', featured: [], slides: [], createdAt: 0,
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
    tower: [],
    castle: [],
    seriesPeriods: {},
    week: TODAY,
    saveQuest: vi.fn(),
    deleteQuest: vi.fn(),
    startChallenge: vi.fn(),
    quitChallenge: vi.fn(),
    claimQuest: vi.fn(() => ({ monsterId: 'o8', drops: [{ icon: '💠', label: '木の結晶', count: 1 }], gold: 50 })),
    exchangeMaterial: vi.fn(),
    attachCustom: vi.fn(),
    shinka: vi.fn(() => true),
    renameSeries: vi.fn(),
    markQuestRules: vi.fn(),
    removeCustom: vi.fn(),
    claimRanks: vi.fn(() => 3),
    setSlot: vi.fn(),
    buyExp: vi.fn(),
    hatchEgg: vi.fn(() => ({ def: defs[1], monsterId: 'o2', shiny: false, pity: false })),
    pourExp: vi.fn(),
    evolve: vi.fn(),
    pourPlusExp: vi.fn(),
    fuse: vi.fn(),
    feedLuck: vi.fn(),
    jogress: vi.fn(() => 'o9'),
    setActive: vi.fn(),
    saveMonsterDef: vi.fn(async () => {}),
    autoTuneDefs: vi.fn(),
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
    expect(el.textContent).toContain('昨日 8,200歩・+54オーブ')
    expect(el.textContent).not.toContain('前日の歩数を記録する')
  })

  it('上の所持：ランク・EXP・トク玉・オーブ・コインがいつも見えて、増えると +N が浮かぶ', async () => {
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
    // ランク：筋トレEXPの積み上げ 460 → 100＋120＋140 でランク4
    expect(el.textContent).toContain('R4')
    expect(el.textContent).not.toContain('💎') // 素材の数は上に出さない
    await act(async () => el.querySelector<HTMLButtonElement>('.topbar-main')!.click())
    expect(el.textContent).toContain('ランク 4（次まで 60EXP）')
    await click('所持アイテム')
    expect(go).toHaveBeenCalledWith({ name: 'items' })
  })

  it('ランク：たまったランクアップ報酬をまとめて受け取る', async () => {
    const { RankCard } = await import('../components/RankCard')
    fake.store.state = { ...state, claims: { 'rank:2': true } }
    const el = await render(<RankCard />)
    expect(el.textContent).toContain('ランク 4')
    await click('ランクアップ報酬（ランク3〜4）🟡トク玉×2 を受け取る')
    expect(fake.store.claimRanks).toHaveBeenCalled()
  })

  it('相棒：枠ごとにセットでき、セット入力のEXPに倍率がかかる', async () => {
    const { PartnerPick } = await import('./PartnerPick')
    fake.store.defs = [{ ...defs[0], favoriteSlot: 'mon2' }, defs[1]]
    fake.store.owned = [{ ...owned[0], plus: 2 }, { id: 'o2', defId: 'm2', nodeId: 'n1', obtainedAt: 2 }]
    const pick = await render(<PartnerPick slotId="mon2" go={go} />)
    // ムキドラゴ：レアの★2 → 攻撃力 2×3,000＋2,500 = 8,500 → (1 + 0.142) × 1.2（得意種目）= 1.37
    expect(pick.textContent).toContain('攻撃力 8,500')
    expect(pick.textContent).toContain('EXP×1.37')
    expect(pick.textContent).toContain('得意種目！')
    await click('ムキドラゴ')
    expect(fake.store.setPartner).toHaveBeenCalledWith('mon2', 'o1')
    fake.store.state = { ...state, partners: { mon2: 'o1' } }
    const el = await render(<SetInput slotId="mon2" go={go} />)
    expect(el.textContent).toContain('相棒：ムキドラ')
    await click('11回で確定')
    expect(fake.store.recordSet).toHaveBeenCalledWith(expect.objectContaining({ exp: 21 }), true) // 15 × 1.37
  })

  it('習慣：やった直後にその場で分数を記録してオーブをもらう（1日30分まで）', async () => {
    const { HabitCard } = await import('../components/HabitCard')
    fake.store.state = { ...state, habitMode: 'minutes', habitLabel: '瞑想', habitDate: TODAY, habitMinutesToday: 25 }
    const el = await render(<HabitCard />)
    expect(el.textContent).toContain('今日 25分（オーブは30分まで）')
    expect(el.textContent).toContain('10分（+5オーブ）') // 残り5分ぶんだけ（10分続けた単価1オーブ）
    await click('10分（+5オーブ）')
    expect(fake.store.recordHabit).toHaveBeenCalledWith(10)
    expect(el.textContent).toContain('瞑想 10分 → +20オーブ')
  })

  it('習慣：○×なら1日1回「できた」', async () => {
    const { HabitCard } = await import('../components/HabitCard')
    await render(<HabitCard />)
    await click('今日できた（+5オーブ）')
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
    expect(el.textContent).toContain('+15オーブ')
    expect(el.textContent).toContain('累計 3週目')
  })

  it('メニュー編集：候補を選ぶと差し替わる', async () => {
    await render(<MenuEdit day="mon" go={go} />)
    await click('プッシュアップ（バーで深く）')
    expect(fake.store.setSlot).toHaveBeenCalledWith('mon1', 'pushupBar')
  })

  it('朝の記録：前日の歩数を入れて記録（1000歩ごとに1オーブ）', async () => {
    fake.store.recordMorning = vi.fn((steps: number) => ({
      date: '2026-10-04', steps, habit: false, habitLabel: '', streak: 0, stepsGold: Math.floor(steps / 1000), habitGold: 0, ts: 1,
    }))
    const el = await render(<Morning go={go} />)
    expect(el.textContent).toContain('10/4の分')
    const input = el.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '6500')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('記録する（+6オーブ）')
    expect(fake.store.recordMorning).toHaveBeenCalledWith(6500)
    expect(el.textContent).toContain('記録しました：+6オーブ')
  })

  it('朝の記録：記録済みなら結果だけ出る', async () => {
    fake.store.yesterdayCheckin = {
      date: '2026-10-04', steps: 5000, habit: false, habitLabel: '', streak: 0, stepsGold: 33, habitGold: 0, ts: 1,
    }
    const el = await render(<Morning go={go} />)
    expect(el.textContent).toContain('記録しました：+33オーブ')
    expect(el.textContent).toContain('歩数 5,000歩')
  })

  it('ショップ：色違いはなくなった（古いデータの色違いも普通に出す）', async () => {
    fake.store.hatchEgg = vi.fn(() => ({ def: defs[1], monsterId: 'o2', shiny: true, pity: false }))
    const shop = await render(<Shop go={go} />)
    expect(shop.textContent).not.toContain('色違い')
    await click('1回引く')
    await click('スキップ')
    expect(shop.textContent).not.toContain('色違い！！')
    expect(shop.querySelector('.shiny')).toBeNull()
  })

  it('BOX・図鑑・ショップ', async () => {
    expect((await render(<Box go={go} />)).textContent).toContain('ムキドラ')
    const registry = await render(<MonsterRegistry go={go} />)
    expect(registry.textContent).toContain('入手 1／登録 2')
    expect(registry.textContent).toContain('未入手')
    // 全体図鑑：ムキドラは第2段階まで（2形態）発見、アシガメは未入手
    // 全体図鑑：形態ごとに番号つきのアイコン。ムキドラは第2段階まで（2形態）発見、アシガメは未入手
    const dex = await render(<Dex go={go} />)
    const labels = () => [...dex.querySelectorAll('.dex-cell')].map((c) => c.getAttribute('aria-label'))
    expect(dex.textContent).toContain('発見 2／7')
    expect(labels()).toContain('No.2 ムキドラゴ')
    expect(labels()).toContain('No.4 未発見') // 進化していない形態の名前は伏せる
    expect(labels().some((l) => l?.includes('アシガメ'))).toBe(false)
    // 同じモンスターをもう1体、別の進化先に育てると、その形態も埋まる
    fake.store.owned = [...owned, { id: 'o3', defId: 'm1', nodeId: 'n3b', obtainedAt: 2 }]
    const dex2 = await render(<Dex go={go} />)
    expect(dex2.textContent).toContain('発見 3／7')
    const yami = dex2.querySelector<HTMLButtonElement>('.dex-cell[aria-label="No.4 ヤミムキドラ"]')!
    await act(async () => yami.click())
    expect(dex2.querySelector('.sheet')!.textContent).toContain('所持 2体')
    expect((await render(<Box go={go} />)).textContent).toContain('所持 2体')
    const shop = await render(<Shop go={go} />)
    await click('1回引く')
    expect(fake.store.hatchEgg).toHaveBeenCalledWith('default', 'eggs')
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
    expect(el.textContent).toContain('/120')
    expect(el.textContent).toContain('脚EXPで進化')
    expect(el.textContent).toContain('0/120')
    expect(el.textContent).not.toContain('進化の石')
    // ★2→★3：結晶6・核3・筋肉玉1。剛腕の核が2個しかないので、まだ進化できない
    expect(el.textContent).toContain('剛腕の核 2/3')
    expect(el.textContent).toContain('筋肉玉 2/1')
    await click('進化する')
    expect(fake.store.evolve).not.toHaveBeenCalled()
    // 無属性のモンスターは、いちばん多く持っている結晶を使う
    fake.store.state = { ...state, stones: { water: 9 }, cores: { chestArms: 3, none: 1 } }
    const el2 = await render(<MonsterDetail id="o1" go={go} />)
    expect(el2.textContent).toContain('水の結晶 9/6')
    await click('進化する')
    expect(fake.store.evolve).toHaveBeenCalledWith('o1', 'n3a')
  })



  it('モンスター詳細：同じモンスターをまとめて食べさせて運を上げる（＋の合体はない）', async () => {
    fake.store.owned = [
      { id: 'o1', defId: 'm1', nodeId: 'n3a', luck: 10, obtainedAt: 1 },
      { id: 'o3', defId: 'm1', nodeId: 'n1', luck: 10, obtainedAt: 3 },
      { id: 'o4', defId: 'm2', nodeId: 'n1', obtainedAt: 4 },
    ]
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).toContain('運 10')
    expect(el.textContent).not.toContain('合体（')
    await click('同じモンスター1体をまとめて食べさせる（運＋10）')
    await click('本当に1体まとめて食べさせる')
    expect(fake.store.feedLuck).toHaveBeenCalledWith('o1', ['o3'])
  })

  it('モンスター詳細：最終形態どうしでジョグレスすると隠しモンスターが生まれる', async () => {
    const hidden: MonsterDef = {
      id: 'h1', name: 'カイザードラ', attr: 'none', templateId: 'linear3', images: {}, recipe: ['m1', 'm2'], createdAt: 3,
    }
    fake.store.defs = [...defs, hidden]
    fake.store.defs = [{ ...defs[0], element: 'fire' }, { ...defs[1], element: 'water' }, hidden]
    fake.store.state = { ...state, coins: 1500, stones: { fire: 10, water: 10 } }
    fake.store.owned = [
      { id: 'o1', defId: 'm1', nodeId: 'n3a', obtainedAt: 1 },
      { id: 'o2', defId: 'm2', nodeId: 'n3', obtainedAt: 2 },
    ]
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).toContain('？？？（★4で誕生）← ムキドラ ＆ アシガメ：どちらも最終形態（★3以上）')
    await click('アシガメとジョグレス')
    await click('本当にジョグレスする（🪙600・筋肉玉×2・炎の結晶×10・水の結晶×10）')
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
    // 合体でいなくなった個体が見つけていた形態も残る。色違いも
    expect(dex.querySelector('.dex-cell[aria-label="No.4 ヤミムキドラ"] .shiny')).toBeNull() // 色違いはなくなった
    // 隠しモンスターは名前を伏せたまま、タップするとレシピと進み具合が見える
    const hidden = dex.querySelector<HTMLButtonElement>('.dex-cell[aria-label="No.8 未発見"]')!
    await act(async () => hidden.click())
    const sheet = dex.querySelector('.sheet')!.textContent
    expect(sheet).toContain('ジョグレスのレシピ')
    expect(sheet).toContain('いちばん育っているのは★2')
    expect(sheet).toContain('アシガメ未所持')
    expect(sheet).not.toContain('カイザードラ')
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
    await click('胸腕のEXPを注ぐ（+')
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

  it('ショップ：レア度ごとの確率が出る（モンストと同じ）。ノーマルとレアはどのガチャにも入る', async () => {
    fake.store.gachas = [gachas[0], gacha('g1', '脚まつり', { createdAt: 1 })]
    fake.store.state = { ...state, normalCount: 47 }
    fake.store.defs = [
      { ...defs[0], rarity: 'rare', gachas: ['g1'] },
      { ...defs[1], rarity: 'superRare', gachas: ['g1'] },
      { id: 'c1', name: 'ザコスラ', attr: 'none', templateId: 'early2', images: {}, rarity: 'hazure', createdAt: 3 },
      { id: 'c2', name: 'フツウドリ', attr: 'none', templateId: 'linear3', images: {}, createdAt: 4 },
      { id: 'r2', name: 'ツノウサ', attr: 'legs', templateId: 'linear3', images: {}, rarity: 'rare', gachas: ['g1'], createdAt: 5 },
    ]
    const el = await render(<Shop go={go} />)
    // 引けるガチャのうち、いちばん新しいものが選ばれている
    expect(el.querySelector('.gacha-tab.on')!.textContent).toBe('脚まつり')
    expect(el.textContent).toContain('全5種')
    // 以前の「レア」は激レア（そのガチャ限定）、以前のハズレはノーマル、以前のノーマルはレアとして数える
    expect(el.textContent).toContain('激レア 合計3.6%（3種）')
    expect(el.textContent).toContain('レア 合計8.4%（1種）')
    expect(el.textContent).toContain('ノーマル 合計88%（1種）')
    expect(el.textContent).toContain('ノーマルがあと3回出ると、🌟ホシ玉')
    expect(el.textContent).toContain('？？？') // まだ会っていないモンスターは名前を伏せる
    // 作ったガチャがあれば「いつものガチャ」は出さない
    expect([...el.querySelectorAll('.gacha-tab')].map((t) => t.textContent)).not.toContain('いつものガチャ')
    await click('1回引く')
    expect(fake.store.hatchEgg).toHaveBeenCalledWith('g1', 'eggs')
  })

  it('ショップ：ピックアップが3体そろっていないガチャは準備中', async () => {
    fake.store.gachas = [gachas[0], gacha('g1', '脚まつり', { createdAt: 1 })]
    fake.store.defs = [...defs, { id: 'r1', name: 'ツノウサ', attr: 'legs', templateId: 'linear3', images: {}, rarity: 'rare', gachas: ['g1'], createdAt: 5 }]
    const el = await render(<Shop go={go} />)
    expect(el.querySelector('.gacha-tab.on')!.textContent).toBe('脚まつり') // 作ったガチャだけが出る
    expect(el.textContent).toContain('準備中：ピックアップ（レア以上）があと2体')
    expect(el.textContent).not.toContain('1回引く')
  })

  it('ガチャ作成：シリーズでまとめて選ぶと、コラボガチャとして名前とキャッチコピーが自動で入る', async () => {
    fake.store.defs = [
      ...defs,
      ...[1, 2, 3].map((n) => ({
        id: `c${n}`, name: `オニ${n}`, attr: 'legs' as const, templateId: 'single', images: {}, rarity: 'superRare' as const, series: '鬼退治', createdAt: 10 + n,
      })),
    ]
    const el = await render(<GachaForm go={go} />)
    await click('＋鬼退治の激レアを全部（3体）')
    expect(el.textContent).toContain('「鬼退治」のコラボガチャとして扱います')
    await click('ガチャを作る')
    expect(fake.store.saveGacha).toHaveBeenCalledWith(
      expect.objectContaining({ name: '鬼退治コラボガチャ', catchphrase: '鬼退治コラボ開催中！', pickups: ['c1', 'c2', 'c3'] }),
    )
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
    expect(el.textContent).toContain('激レア 合計30%') // ノーマルがいないので、その分が回る（3.6 ÷ 12）
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
    expect(banner.classList.contains('tone-gold')).toBe(true) // 主役のツノウサ（無属性）は金
    const hero = banner.querySelector('.slide-hero')!
    expect(hero.textContent).toContain('脚まつり')
    expect(hero.textContent).toContain('伝説の脚竜、降臨！')
    expect(hero.textContent).toContain('激レア登場')
    expect(hero.textContent).toContain('ツノウサ')
    expect(banner.querySelector('.slide-pickups')!.textContent).toContain('カミドラ')
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
    // ムキドラはアークを持っている（誰かが持っているギミックだけが、おまかせの条件になる）
    fake.store.defs = [{ ...defs[0], abilities: ['バリア'] }, defs[1], { id: 'b1', name: 'アシリュウ', attr: 'legs', templateId: 'linear3', images: {}, questOnly: true, createdAt: 9 }]
    const el = await render(<QuestForm go={go} />)
    const type = async (input: HTMLInputElement, value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    await type(el.querySelector('input')!, '脚竜の巣')
    expect(el.textContent).toContain('アシリュウ') // クエスト限定のモンスターだけがボス候補
    expect([...el.querySelectorAll('option')].map((o) => o.textContent)).not.toContain('ムキドラ')
    // 新しいクエストは、おまかせで条件と弱点（ボスの部位＝脚の日の種目）が最初から入っている
    expect(el.textContent).toContain('おまかせ中')
    expect(el.textContent).toMatch(/持っている \d/)
    await click('胸腕：ダンベルカール')
    expect(el.textContent).not.toContain('おまかせ中') // 手で変えたら止まる
    // 新しいアビリティは、ギミック名とセットで作る
    await type(el.querySelector<HTMLInputElement>('input[aria-label="新しいスキル"]')!, 'ゾーン')
    await click('追加')
    await click('クエストを作る')
    expect(fake.store.saveQuest).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '脚竜の巣', bossDefId: 'b1', attr: 'legs',
        weakSlots: [expect.stringMatching(/^wed/), 'mon4'],
        requirements: expect.arrayContaining([expect.objectContaining({ tag: expect.stringMatching(/^ab:/), count: 2 }), { tag: 'ab:ゾーン', count: 2 }]),
        customGimmicks: { ゾーン: 'ゾーン' },
        hp: { easy: expect.any(Number), normal: expect.any(Number), hard: expect.any(Number) },
      }),
    )
  })

  it('クエスト作成：🎯活躍させたいモンスターを選ぶと条件ができ、手持ちで足りるか出る', async () => {
    const { QuestForm } = await import('./QuestForm')
    fake.store.defs = [{ ...defs[0], element: 'fire', rarity: 'rare', abilities: ['バリア'] }, defs[1]]
    const el = await render(<QuestForm go={go} />)
    const group = el.querySelector('[aria-label="活躍させたいモンスター"]')!
    await act(async () => [...group.querySelectorAll('button')].find((b) => b.textContent === 'ムキドラ')!.click())
    await click('体が刺さる条件にする')
    expect(el.textContent).toContain('🔥炎')
    expect(el.textContent).toContain('アーク')
    expect(el.textContent).toContain('持っている 1（今の手持ちだと×1.0に届かない）') // 炎3に対して手持ちは1
  })

  it('クエスト作成：ガチャのキャラがいなくても、ギミック2つや属性2つから条件を作れる', async () => {
    const { QuestForm } = await import('./QuestForm')
    const el = await render(<QuestForm go={go} />)
    await click('🧩 スキルを接待')
    const gim = el.querySelector('[aria-label="接待するスキル"]')!
    for (const name of ['アーク', 'ルーン'])
      await act(async () => [...gim.querySelectorAll('button')].find((b) => b.textContent === name)!.click())
    await click('このスキルの条件にする')
    expect(el.textContent).toContain('アークとルーンを両方')
    await click('🎨 属性')
    const els = el.querySelector('[aria-label="求める属性"]')!
    for (const name of ['炎', '水']) await act(async () => [...els.querySelectorAll('button')].find((b) => b.textContent === name)!.click())
    await click('この属性の条件にする')
    expect(el.textContent).toContain('🔥炎')
    expect(el.textContent).toContain('💧水')
  })

  it('クエスト詳細：効きやすい順にメンバーが並び、選んで挑戦できる', async () => {
    const { QuestDetail } = await import('./QuestDetail')
    const quest = {
      id: 'q1', name: '脚竜の巣', bossDefId: 'm2', attr: 'legs' as const, element: 'wood' as const, weakSlots: ['mon4'], gimmicks: ['バリア'],
      hp: { easy: 1000, normal: 3000, hard: 6000 }, catchphrase: '', theme: 'flame', createdAt: 1,
    }
    fake.store.quests = [quest]
    fake.store.defs = [{ ...defs[0], rarity: 'rare', favoriteSlot: 'mon4', abilities: ['バリア'], element: 'fire' }, defs[1]]
    fake.store.owned = [owned[0], { id: 'o2', defId: 'm2', nodeId: 'n1', obtainedAt: 2 }]
    const el = await render(<QuestDetail id="q1" go={go} />)
    expect(el.textContent).toContain('アーク0/2')
    expect(el.textContent).toContain('編成倍率 ×0.40')
    expect(el.textContent).toContain('ダンベルカール')
    const names = [...el.querySelectorAll('button.choice')].map((b) => b.textContent)
    expect(names[0]).toContain('ムキドラゴ') // 胸腕（脚に強い）・得意種目と特攻が弱点
    expect(names[0]).toContain('得意種目が弱点')
    expect(names[0]).toContain('アーク') // ボスのギミックに対応している
    expect(names[1]).not.toContain('アーク')
    // ボスクエストは難易度を選ばない。格（決めていなければ極）でHPと報酬が決まる
    expect(el.querySelector('[aria-label="難易度"]')).toBeNull()
    expect(el.textContent).toContain('HP 3,000・🔮12ドロップ アシガメ（運4）・ときどき木の結晶')
    await click('ムキドラゴ')
    expect(el.textContent).toContain('アーク1/2') // 選ぶとメーターが埋まる
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
    fake.store.defs = [{ ...defs[0], element: 'fire' }, defs[1]] // 零属性だと×1.2になるので
    // 開始前のセットは数えない。ムキドラゴ（胸腕・攻撃力7,500）がフロアプレス（弱点）を攻撃：2.5 × 2.5 × 2（部位一致）× 2（弱点）= 25
    fake.store.weekSets = [past(1, 10, 5, TODAY), past(2, 10, 20, TODAY)]
    const el = await render(<Quests go={go} />)
    expect(el.textContent).toContain('与えたダメージ 28 ／ HP 25') // レアの★2（攻撃力8,500）：2.5 × 2.83 × 2 × 2
    expect(el.textContent).toContain('討伐できる！')
    await click('報酬を受け取る')
    expect(fake.store.claimQuest).toHaveBeenCalled()
    expect(el.textContent).toContain('討伐成功！')
    // ボスクエストでも、ときどきボスの属性の結晶が落ちる（カードでめくれて出る）
    expect(el.querySelector('.drop-card')!.textContent).toBe('💠木の結晶×1')
    await click('会いに行く')
    expect(go).toHaveBeenCalledWith({ name: 'monster', id: 'o8' })
    // 出撃中は、トレーニング画面でボスに効く種目に印が付く（脚のボス：脚の種目は×1.3、弱点のフロアプレスは×2）
    const training = await render(<Training go={go} />)
    expect(training.textContent).toContain('🎯弱点 ×2')
    expect(training.textContent).toContain('⚔️ボスの部位 ×1.3')
  })

  it('クエスト：落ちたボスは、持っている同じ子の運にその場で食べさせられる', async () => {
    const { Quests } = await import('./Quests')
    const quest = {
      id: 'q1', name: '脚竜の巣', bossDefId: 'm2', attr: 'legs' as const, element: 'wood' as const, weakSlots: ['mon2'], gimmicks: [],
      hp: { easy: 25, normal: 25, hard: 25 }, catchphrase: '', theme: 'flame', createdAt: 1,
    }
    fake.store.quests = [quest]
    fake.store.state = { ...state, challenge: { date: TODAY, questId: 'q1', difficulty: 'easy', party: ['o1'], startTs: 10 } }
    fake.store.weekSets = [past(2, 10, 20, TODAY)]
    fake.store.owned = [owned[0], { id: 'k', defId: 'm2', nodeId: 'n1', luck: 95, obtainedAt: 2 }, { id: 'o8', defId: 'm2', nodeId: 'n1', luck: 4, obtainedAt: 3 }]
    fake.store.claimQuest = vi.fn(() => ({ monsterId: 'o8', defId: 'm2', drops: [], gold: 8, eggs: 0, towerFloor: null, luck: 4 }))
    fake.store.feedLuck = vi.fn(() => 10)
    const el = await render(<Quests go={go} />)
    await click('報酬を受け取る')
    expect(el.textContent).toContain('運 4 で手に入った')
    await click('持っているアシガメ（運95）に食べさせる')
    expect(fake.store.feedLuck).toHaveBeenCalledWith('k', ['o8'])
    expect(el.textContent).toContain('運極達成！！ 🟡トク玉×10')
    await click('会いに行く')
    expect(go).toHaveBeenCalledWith({ name: 'monster', id: 'k' })
  })

  it('クエスト：入口から選んで一覧へ。一覧は格の見出しで分かれ、バナーに格のリボンが付く', async () => {
    const { Quests } = await import('./Quests')
    const base = { bossDefId: 'm2', attr: 'legs' as const, weakSlots: [], hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: '', createdAt: 1 }
    fake.store.quests = [
      { ...base, id: 'a', name: 'ゆるい巣', grade: 'kiwami' as const },
      { ...base, id: 'b', name: '地獄の巣', grade: 'chozetsu' as const },
      { ...base, id: 'c', name: '修練場', kind: 'material' as const },
    ]
    fake.store.state = { ...state, clearedQuests: { b: 2 } }
    // まずは入口の一覧（Monstのように、選ぶと中のクエストが出る）
    const top = await render(<Quests go={go} />)
    expect([...top.querySelectorAll('.quest-entry strong')].map((e) => e.textContent)).toEqual([
      'クエスト', '零の孤城', '試練の塔', '素材クエスト', '神殿',
    ]) // 書庫は終わったコラボがあるときだけ
    expect(top.textContent).toContain('（1/2クリア）')
    await click('素材クエスト')
    expect(go).toHaveBeenCalledWith({ name: 'quests', category: 'material' })
    const mat = await render(<Quests go={go} category="material" />)
    expect([...mat.querySelectorAll('.quest-group-head')].map((h) => h.textContent)).toEqual(['素材 0/1'])
    const el = await render(<Quests go={go} category="boss" />)
    const heads = [...el.querySelectorAll('.quest-group-head')].map((h) => h.textContent)
    expect(heads).toEqual(['超絶 1/1', '極 0/1'])
    // アイコン表示（最初はこれ）：格の色の枠と、クリア済みの✓
    expect(el.querySelector('.quest-icon.frame-chozetsu .quest-cleared')).not.toBeNull()
    expect(el.querySelector('.quest-icon.frame-kiwami .quest-cleared')).toBeNull()
    await click('バナー')
    expect(el.querySelector('.quest-banner.frame-chozetsu .grade-ribbon')!.textContent).toBe('超絶')
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

  it('素材クエスト：倒すとくじの数だけ素材が落ちる（0個のこともある）', async () => {
    const { Quests } = await import('./Quests')
    const quest = {
      id: 'q2', name: '脚の修練場', kind: 'material' as const, bossDefId: 'm2', attr: 'legs' as const, weakSlots: [],
      gimmicks: [], hp: { easy: 10, normal: 1500, hard: 3000 }, catchphrase: '', theme: 'forest', createdAt: 1,
    }
    fake.store.quests = [quest]
    fake.store.state = { ...state, challenge: { date: TODAY, questId: 'q2', difficulty: 'easy', party: ['o1'], startTs: 0 } }
    fake.store.weekSets = [past(1, 10, 5, TODAY)]
    fake.store.claimQuest = vi.fn(() => ({ monsterId: null, drops: [{ icon: '💎', label: '健脚の核', count: 0 }], gold: 25 }))
    expect((await render(<Quests go={go} category="material" />)).textContent).toContain('💎 素材・健脚の核')
    const el = await render(<Quests go={go} />)
    await click('報酬を受け取る（健脚の核のくじ')
    expect(el.textContent).toContain('今回は健脚の核が落ちなかった')
    expect(el.textContent).not.toContain('会いに行く')
  })

  it('カスタマイズ枠：神殿のアイテムを付ける。付け直すと前のは消える（ステッキなら戻せる）', async () => {
    fake.store.state = { ...state, customItems: { atk1: 2, fav: 1, 'ab:シールド': 1 }, sticks: 1 }
    const el = await render(<MonsterDetail id="o1" go={go} />)
    expect(el.textContent).toContain('🛠 カスタマイズ枠')
    expect(el.textContent).toContain('空き')
    const row = (name: string) => [...el.querySelectorAll('.mini-list li')].find((li) => li.textContent?.includes(name))!
    // 得意種目の追加は、種目を選んでから付ける
    await act(async () => row('得意種目の追加').querySelector('button')!.click())
    await act(async () => el.querySelector<HTMLButtonElement>('[aria-label="得意種目にする種目"] button')!.click())
    await click('🥈 得意種目の追加 を付ける')
    expect(fake.store.attachCustom).toHaveBeenCalledWith('o1', 'fav', expect.any(String), false)
    // もう付いていれば、消すか、ステッキで戻すかを選ぶ
    fake.store.owned = [{ ...owned[0], custom: 'atk1' }]
    const el2 = await render(<MonsterDetail id="o1" go={go} />)
    expect(el2.textContent).toContain('🥉 攻撃力 +500')
    const row2 = [...el2.querySelectorAll('.mini-list li')].find((li) => li.textContent?.includes('アビリティ追加：ノヴァ'))!
    await act(async () => row2.querySelector('button')!.click())
    await click('前のを持ち物に戻して付ける')
    expect(fake.store.attachCustom).toHaveBeenCalledWith('o1', 'ab:シールド', undefined, true)
    await click('外して持ち物に戻す')
    expect(fake.store.removeCustom).toHaveBeenCalledWith('o1')
  })

  it('零の孤城：毎月16日〜月末、下から1階ずつ。全階の条件が見えて、最上階は零属性の城主', async () => {
    const { Castle } = await import('./Castle')
    const { castleFloors } = await import('../lib/castle')
    const king: MonsterDef = { id: 'king', name: 'ゼロキング', attr: 'legs', templateId: 'single', images: {}, questOnly: true, rarity: 'superRare', castleLord: true, createdAt: 9 }
    fake.store.defs = [...defs, king]
    fake.store.castle = castleFloors([...defs, king], [])
    fake.store.state = { ...state, castle: { month: '2026-10', cleared: 2 } }
    fake.store.today = '2026-10-20' // 孤城は16日〜月末
    const el = await render(<Castle go={go} />)
    expect(el.textContent).toContain('2／11階クリア・次は3階')
    expect(el.textContent).toContain('求む：') // 全部の階の条件が見える
    expect(el.textContent).toContain('ブースター詰め合わせ×3')
    expect(el.textContent).toContain('👑ゼロキング')
    const floors = [...el.querySelectorAll<HTMLButtonElement>('.tower-floor')]
    expect(floors.find((b) => b.textContent?.startsWith('3F'))!.textContent).toContain('挑戦')
    expect(floors.find((b) => b.textContent?.startsWith('4F'))!.textContent).toContain('🔒') // 上の階も開いて条件は見られる
    await act(async () => floors.find((b) => b.textContent?.startsWith('3F'))!.click())
    expect(go).toHaveBeenCalledWith({ name: 'quest', id: 'castle-3' })
  })

  it('コラボの管理：コラボ名をまとめて変えられる（表示の「コラボ」は二重にしない）', async () => {
    const { CollabAdmin } = await import('./CollabAdmin')
    fake.store.defs = [{ ...defs[0], series: '遊戯王コラボ' }, { ...defs[1], series: '遊戯王コラボ' }]
    const el = await render(<CollabAdmin go={go} />)
    expect(el.textContent).toContain('🤝 遊戯王コラボ 2体')
    const input = el.querySelector<HTMLInputElement>('input[aria-label="遊戯王コラボの新しい名前"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '遊戯王')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('2体まとめて変える')
    expect(fake.store.renameSeries).toHaveBeenCalledWith('遊戯王コラボ', '遊戯王')
  })

  it('その他：作る側のメニューは「つくる（開発者メニュー）」にまとまっている', async () => {
    const { More } = await import('./More')
    const el = await render(<More go={go} />)
    expect(el.textContent).toContain('つくる（開発者メニュー）')
    await click('ガチャの管理')
    expect(go).toHaveBeenCalledWith({ name: 'gachaAdmin' })
    await click('クエストの管理')
    expect(go).toHaveBeenCalledWith({ name: 'questAdmin' })
    await click('コラボの管理')
    expect(go).toHaveBeenCalledWith({ name: 'collabAdmin' })
  })

  it('獣神化：レシピの降臨の運を集めて★4に。合体の相手がいれば金の獣神化も', async () => {
    const sr: MonsterDef = { ...defs[0], id: 'sr', name: 'カミドラ', tier: 'superRare', element: 'fire', jogressPartner: 'sr2', templateId: 'linear3' }
    const sr2: MonsterDef = { ...defs[0], id: 'sr2', name: 'アクドラ', tier: 'superRare', element: 'dark', templateId: 'linear3' }
    const izanami: MonsterDef = { id: 'iz', name: 'イザナミ', attr: 'legs', templateId: 'single', images: {}, questOnly: true, bossGrade: 'chozetsu', element: 'fire', createdAt: 9 }
    fake.store.defs = [sr, sr2, izanami]
    const { shinkaRecipe } = await import('../lib/shinka')
    const recipe = shinkaRecipe(sr, [sr, sr2, izanami])
    expect(recipe.map((r) => r.defId)).toEqual(['iz'])
    const need = recipe[0].count * recipe[0].luck
    fake.store.owned = [
      { id: 'me', defId: 'sr', nodeId: 'n3', obtainedAt: 1 },
      { id: 'p', defId: 'sr2', nodeId: 'n3', obtainedAt: 2 },
      { id: 'f', defId: 'iz', nodeId: 'n1', luck: need, obtainedAt: 3 },
    ]
    fake.store.state = { ...state, coins: 1000 }
    const el = await render(<MonsterDetail id="me" go={go} />)
    expect(el.textContent).toContain(`イザナミ ×${recipe[0].count}体（運${recipe[0].luck}以上）`)
    expect(el.textContent).toContain(`運 ${need}/${need}`)
    await click('🥉 獣神化する')
    expect(fake.store.shinka).toHaveBeenCalledWith('me', false)
    await render(<MonsterDetail id="me" go={go} />)
    await click('アクドラと合体して')
    expect(fake.store.shinka).toHaveBeenCalledWith('me', true)
  })

  it('カスタマイズアイテムの一覧：持っているアイテムと、付けている子が見られる', async () => {
    const { CustomItems } = await import('./CustomItems')
    fake.store.state = { ...state, customItems: { atk1: 2, 'ab:シールド': 1, fav: 0 }, sticks: 3 }
    fake.store.owned = [{ ...owned[0], custom: 'atk3' }]
    const el = await render(<CustomItems go={go} />)
    expect(el.textContent).toContain('ワクワクステッキ 3本')
    expect(el.textContent).toContain('🥇 アビリティ追加：ノヴァ×1')
    expect(el.textContent).toContain('🥉 攻撃力 +500×2')
    expect(el.textContent).not.toContain('得意種目の追加') // 0個は出さない
    expect(el.textContent).toContain('付けている子（1体）')
    await click('ムキドラゴ')
    expect(go).toHaveBeenCalledWith({ name: 'monster', id: 'o1' })
  })

  it('所持アイテム：素材の数を見て、余った結晶・核はトク玉と交換できる', async () => {
    const { Items } = await import('./Items')
    fake.store.state = { ...state, stones: { fire: 20, water: 3 }, cores: { legs: 10, chestArms: 1, none: 4 } }
    const el = await render(<Items go={go} />)
    expect(el.textContent).toContain('筋肉玉4')
    const row = (name: string) => [...el.querySelectorAll('.mini-list li')].find((li) => li.textContent?.includes(name))!
    await act(async () => row('炎の結晶').querySelector('button')!.click())
    expect(fake.store.exchangeMaterial).toHaveBeenCalledWith('stone', 'fire')
    expect(row('水の結晶').querySelector('button')!.disabled).toBe(true)
    await act(async () => row('健脚の核').querySelector('button')!.click())
    expect(fake.store.exchangeMaterial).toHaveBeenCalledWith('muscle', 'legs')
    expect(row('剛腕の核').querySelector('button')!.disabled).toBe(true)
  })

  it('BOX：アイコンの一覧を並び替え・属性で絞り込みできる', async () => {
    fake.store.defs = [{ ...defs[0], element: 'fire' }, { ...defs[1], element: 'water' }]
    fake.store.owned = [owned[0], { id: 'o2', defId: 'm2', nodeId: 'n1', obtainedAt: 5 }]
    fake.store.state = { ...state, partners: { mon1: 'o1' } }
    const el = await render(<Box go={go} />)
    const names = () => [...el.querySelectorAll('.box-cell')].map((c) => c.getAttribute('aria-label'))
    expect(names()).toEqual(['アシガメ', 'ムキドラゴ']) // 入手が新しい順
    expect(el.querySelector('.box-cell[aria-label="ムキドラゴ"] .box-partner')).not.toBeNull() // 相棒マーク
    await click('攻撃力')
    expect(names()).toEqual(['ムキドラゴ', 'アシガメ'])
    const filter = el.querySelector('[aria-label="属性で絞り込み"]')!
    await act(async () => [...filter.querySelectorAll('button')].find((b) => b.textContent === '水')!.click())
    expect(names()).toEqual(['アシガメ'])
  })

  it('習慣：1分・3分から記録でき、タイマーでも計れる', async () => {
    const { HabitCard } = await import('../components/HabitCard')
    fake.store.state = { ...state, habitMode: 'minutes', habitLabel: '瞑想' }
    await render(<HabitCard />)
    await click('3分')
    expect(fake.store.recordHabit).toHaveBeenCalledWith(3)
    await click('タイマーではじめる')
    expect(container.textContent).toContain('終わる（0分を記録）')
    await click('やめる')
    expect(container.textContent).toContain('タイマーではじめる')
  })

  it('ショップ：オーブなら1回5個・10連50個で引ける（トク玉がなければオーブだけ）', async () => {
    fake.store.state = { ...state, eggs: 0, gold: 52 }
    fake.store.hatchMany = vi.fn(() => [])
    const el = await render(<Shop go={go} />)
    expect(el.textContent).not.toContain('🟡トク玉×1')
    expect(el.textContent).toContain('🔮5')
    expect(el.textContent).toContain('🔮50')
    await click('10連で引く')
    expect(fake.store.hatchMany).toHaveBeenCalledWith('default', 10, 'orbs')
    // 足りなければ、引けるぶんだけ
    fake.store.state = { ...state, eggs: 0, gold: 23 }
    await render(<Shop go={go} />)
    await click('4連で引く')
    expect(fake.store.hatchMany).toHaveBeenCalledWith('default', 4, 'orbs')
  })

  it('ショップ：まとめて引くと、結果が一覧で出る', async () => {
    fake.store.state = { ...state, eggs: 4 }
    fake.store.hatchMany = vi.fn(() => [
      { def: defs[0], monsterId: 'a', shiny: false, pity: false },
      { def: { ...defs[1], rarity: 'superRare' }, monsterId: 'b', shiny: false, pity: true },
    ])
    const el = await render(<Shop go={go} />)
    await click('4連で引く')
    expect(fake.store.hatchMany).toHaveBeenCalledWith('default', 4, 'eggs')
    expect(el.textContent).toContain('2連の結果')
    expect(el.querySelector('.multi-cell.rarity-superRare')!.textContent).toContain('激レア・確定')
    await act(async () => (el.querySelector('.multi-cell.rarity-superRare') as HTMLButtonElement).click())
    expect(go).toHaveBeenCalledWith({ name: 'monster', id: 'b' })
  })

  it('ショップ：ホシ玉で引くとレア以上が確定し、演出に出る', async () => {
    fake.store.hatchEgg = vi.fn(() => ({ def: { ...defs[1], tier: 'superRare' }, monsterId: 'o2', shiny: false, pity: true }))
    fake.store.state = { ...state, hoshi: 2 }
    const shop = await render(<Shop go={go} />)
    await click('ホシ玉で引く')
    expect(fake.store.hatchEgg).toHaveBeenCalledWith('default', 'hoshi')
    await click('スキップ')
    expect(shop.textContent).toContain('レア以上確定！')
    expect(shop.textContent).toContain('激レア！')
  })

  it('ショップ：タマゴが揺れて、光の色と星が順に出てからモンスターが出る', async () => {
    vi.useFakeTimers()
    try {
      fake.store.hatchEgg = vi.fn(() => ({ def: { ...defs[1], rarity: 'superRare' }, monsterId: 'o2', shiny: false, pity: false }))
      const shop = await render(<Shop go={go} />)
      await click('1回引く')
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

  it('ガチャ編集：中身をレア度ごとに見せ、名前を保存できる', async () => {
    fake.store.gachas = [gachas[0], gacha('g1', '脚まつり', { createdAt: 1 })]
    fake.store.defs = [{ ...defs[0], rarity: 'rare', gachas: ['g1'] }, { ...defs[1], rarity: 'superRare', gachas: ['g1'] }]
    const el = await render(<GachaForm id="g1" go={go} />)
    expect(el.textContent).toContain('全2種')
    expect(el.textContent).toContain('激レア 合計100%') // 以前の「レア」も激レア
    expect(el.textContent).not.toContain('色違い')
    await click('保存する')
    expect(fake.store.saveGacha).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1', name: '脚まつり' }))
    await click('このガチャを消す')
    await click('本当に消す')
    expect(fake.store.deleteGacha).toHaveBeenCalledWith('g1')
  })

  it('モンスター登録：足りないものが分かり、おすすめで埋められ、刺さるクエストが出る', async () => {
    fake.store.quests = [
      {
        id: 'q1', name: '脚竜の巣', bossDefId: 'm2', attr: 'legs', weakSlots: ['mon4'],
        requirements: [{ tag: 'el:fire', count: 3 }, { tag: 'ab:シールド', count: 2 }],
        hp: { easy: 1, normal: 1, hard: 1 }, catchphrase: '', theme: 'flame', createdAt: 1,
      },
    ]
    const el = await render(<MonsterForm go={go} />)
    await act(async () => el.querySelector('[aria-label="レア度"]')!.querySelectorAll('button')[2].click()) // レア（アビリティ1個）
    expect(el.textContent).toContain('胸腕 1体') // ムキドラ（最終形態に胸腕がある）
    expect(el.textContent).toContain('炎 0体／クエスト1不足')
    expect(el.textContent).toContain('ノヴァ 0体／クエスト1不足')
    // 新しく登録するときは、最初からおまかせで足りないものが選ばれている
    expect(el.textContent).toContain('おまかせ中')
    expect(el.textContent).toContain('◎ 脚竜の巣')
    // 自分で選ぶとおまかせは止まり、刺さらなくなったクエストは出さない
    const els = el.querySelector('[aria-label="属性"]')!
    await act(async () => [...els.querySelectorAll('button')].find((b) => b.textContent?.startsWith('水'))!.click())
    expect(el.textContent).not.toContain('おまかせ中')
    expect(el.textContent).not.toContain('🔥炎・')
    await click('足りないもので埋める')
    const favorite = [...el.querySelectorAll('select')].find((x) => x.textContent?.includes('プッシュアップ')) as HTMLSelectElement
    expect(favorite.value).toBe('mon4') // 弱点種目なのに得意なモンスターがいない（胸腕のモンスターなので胸腕の種目から）
    expect(favorite.textContent).not.toContain('ブルガリアンスクワット') // 部位の違う種目は選べない
    expect(el.querySelector('.fit-good')).not.toBeNull() // 胸腕・ノヴァ・得意種目が弱点 → ◎
    expect(el.textContent).toContain('脚竜の巣')
  })

  it('モンスター登録：降臨は格を選ぶだけ（星・アビリティの数・クエストの格が決まる）', async () => {
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
    const grades = el.querySelector('[aria-label="降臨の格"]')!
    expect(el.textContent).not.toContain('城主にする') // 城主は爆絶だけ
    await act(async () => [...grades.querySelectorAll('button')].find((b) => b.textContent === '爆絶')!.click())
    expect(el.textContent).toContain('城主にする')
    await act(async () => [...grades.querySelectorAll('button')].find((b) => b.textContent === '極')!.click())
    await click('保存する')
    expect(fake.store.saveMonsterDef).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'コウリンオー', templateId: 'single', questOnly: true, bossGrade: 'kiwami' }),
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
    await act(async () => el.querySelector('[aria-label="レア度"]')!.querySelectorAll('button')[2].click()) // レア（アビリティ1個）
    const picker = [...el.querySelectorAll('select')].find((x) => x.textContent?.includes('クエストを選ぶ'))!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(picker, 'q1')
      picker.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const on = [...el.querySelectorAll('button.chip.on')].map((b) => b.textContent)
    expect(on.some((t) => t?.startsWith('水'))).toBe(true)
    expect(on.some((t) => t?.startsWith('ノヴァ'))).toBe(true)
    expect(el.textContent).toContain('◎ 脚竜の巣')
  })

  it('登録・編集の一覧：未入手でも絵と名前が見え、未設定がバッジで出て、まとめておまかせできる', async () => {
    fake.store.defs = [
      { ...defs[0], element: 'fire', rarity: 'rare', images: { n1: 'img1' }, gachas: ['g1'] }, // 設定済み（ガチャにも入っている）
      defs[1], // アシガメ：未入手・画像なし・属性なし・レア度未設定
    ]
    const el = await render(<MonsterRegistry go={go} />)
    expect(el.querySelector('.monster-img.silhouette')).toBeNull()
    const tiles = [...el.querySelectorAll('.tile')].map((t) => t.textContent)
    expect(tiles[0]).toContain('アシガメ') // 未設定のものが上
    expect(tiles[0]).toContain('属性なし')
    expect(tiles[0]).toContain('レア度未設定')
    expect(tiles[0]).toContain('未入手')
    await click('まとめておまかせで埋める')
    expect(fake.store.autoTuneDefs).toHaveBeenCalledWith(expect.arrayContaining(['m2']))
    const filter = el.querySelector('[aria-label="絞り込み"]')!
    await act(async () => [...filter.querySelectorAll('button')].find((b) => b.textContent === '降臨')!.click())
    expect(el.querySelectorAll('.tile')).toHaveLength(0) // 降臨のモンスターはまだいない
    await click('＋ 降臨用')
    expect(go).toHaveBeenCalledWith({ name: 'monsterForm', preset: 'quest' })
  })

  it('モンスター登録：降臨用は、クエスト限定・1形態だけ・激レアで始まる', async () => {
    const el = await render(<MonsterForm preset="quest" go={go} />)
    expect(el.textContent).toContain('降臨モンスターの登録')
    expect((el.querySelector('select') as HTMLSelectElement).value).toBe('single')
    const questOnly = [...el.querySelectorAll('label.row')].find((l) => l.textContent?.includes('クエスト限定にする'))!
    expect(questOnly.querySelector('input')!.checked).toBe(true)
    expect(el.querySelector('[aria-label="降臨の格"] .on')!.textContent).toBe('超絶')
  })

  it('モンスター登録：入るガチャは3つまで', async () => {
    fake.store.gachas = [gachas[0], ...[1, 2, 3, 4].map((n) => gacha(`g${n}`, `ガチャ${n}`, { createdAt: n }))]
    const el = await render(<MonsterForm go={go} />)
    expect(el.textContent).not.toContain('ガチャ1') // ノーマルはどのガチャからも出るので選ばない
    await act(async () => el.querySelector('[aria-label="レア度"]')!.querySelectorAll('button')[2].click())
    expect(el.textContent).toContain('そのガチャ限定')
    for (const n of [1, 2, 3]) await click(`ガチャ${n}`)
    const g4 = [...el.querySelectorAll('button')].find((b) => b.textContent === 'ガチャ4')!
    expect(g4.disabled).toBe(true)
  })

  it('モンスター登録：名前を入れて保存', async () => {
    const el = await render(<MonsterForm go={go} />)
    expect(el.textContent).toContain('★1→★2 40EXP＋🪙30')
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
        rarity: 'rare',
      }),
    )
    expect(go).toHaveBeenCalledWith({ name: 'registry' })
  })
})
