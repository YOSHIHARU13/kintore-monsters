import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './lib/firebase'
import { CONFIG } from './config/gameConfig'
import { ATTRS, DAYS, type Attr, type FormAttr } from './data/exercises'
import { FIRST_NODE_ID, canChangeTemplate, getNode, getTemplate, pathTo } from './data/evolutionTemplates'
import { dateKey, prevDateKey, weekStartKey } from './lib/date'
import { evolutionCost, fusionCost, isExpFull, planPour } from './lib/evolution'
import { habitGoldOf, habitLabelOf, stepsGold } from './lib/rewards'
import { isWeekCleared } from './lib/week'
import { compressImage } from './lib/imageCompress'
import { draw, isPickupRarity, isPity, isReady, rarityOf, rateTable } from './lib/gacha'
import { questHits } from './lib/quest'
import { investedFor, isHidden, nodeAttr, type AttrExp, type Checkin, type Gacha, type Quest, type QuestDifficulty, type RarityKey, type ExpSource, type GameState, type MonsterDef, type OwnedMonster, type SetRecord, type Song } from './types'

const zeroExp = () => ({ trained: 0, bought: 0 })

function initialState(): GameState {
  return {
    gold: 0,
    eggs: CONFIG.shop.starterEggs,
    exp: { chestArms: zeroExp(), legs: zeroExp(), backShoulders: zeroExp() },
    lifetimeExp: { chestArms: 0, legs: 0, backShoulders: 0 },
    anyExp: 0,
    attendance: 0,
    lastAttendanceDate: null,
    totalSets: 0,
    beatCount: 0,
    weeklyClears: 0,
    lastClearWeek: null,
    habitStreak: 0,
    bestHabitStreak: 0,
    habitLabel: null,
    habitMode: 'check',
    lastCheckinDate: null,
    dexFound: {},
    dexShiny: {},
    pity: {},
    activeMonsterId: null,
    partners: {},
    challenge: null,
    questClears: 0,
  }
}

function toState(data: DocumentData): GameState {
  const init = initialState()
  return {
    ...init,
    ...data,
    exp: { ...init.exp, ...data.exp },
    lifetimeExp: { ...init.lifetimeExp, ...data.lifetimeExp },
  } as GameState
}

/** 朝の記録を読む。禁欲を記録していたころのデータも、習慣の記録として読む */
function toCheckin(data: DocumentData): Checkin {
  return {
    date: data.date,
    steps: data.steps ?? 0,
    habit: data.habit ?? data.abstained ?? false,
    habitLabel: data.habitLabel ?? (data.abstained !== undefined ? '禁欲' : ''),
    streak: data.streak ?? 0,
    stepsGold: data.stepsGold ?? 0,
    habitGold: data.habitGold ?? data.abstinenceGold ?? 0,
    ...(data.habitMinutes !== undefined ? { habitMinutes: data.habitMinutes } : {}),
    ts: data.ts ?? 0,
  }
}

export interface MonsterDefInput {
  id?: string
  name: string
  templateId: string
  attrs: Record<string, FormAttr> // nodeId → その形態の属性
  names: Record<string, string> // nodeId → その段階だけの名前
  files: Record<string, File> // nodeId → 新しくアップロードする画像
  recipe: string[] // 隠しモンスターのレシピ（2体の defId）。普通のモンスターは空
  gachas: string[] // 入るガチャのID（最大3つ。空なら「いつものガチャ」）
  rarity: RarityKey
  questOnly: boolean
  favoriteSlot: string // 得意種目の枠ID（なしは空）
  skill: string // 特攻スキル（なしは空）
}

export type QuestInput = Omit<Quest, 'id' | 'createdAt'> & { id?: string }

export interface GachaInput {
  id?: string
  name: string
  shinyRate: number
  catchphrase: string
  theme: string
  featured: string[]
  banner?: File
  removeBanner?: boolean // 画像をやめて自動バナーにする
  pickups?: string[] // ピックアップにするモンスター（レア以上）の defId。いつものガチャでは使わない // 新しいバナー画像
}

function toGacha(id: string, data: DocumentData | undefined): Gacha {
  const builtin = id === CONFIG.gacha.defaultId
  return {
    id,
    name: data?.name?.trim() || (builtin ? CONFIG.gacha.defaultName : '名前のないガチャ'),
    bannerImageId: data?.bannerImageId ?? null,
    shinyRate: data?.shinyRate ?? CONFIG.shop.shinyRate,
    catchphrase: data?.catchphrase ?? '',
    theme: data?.theme ?? 'royal',
    featured: data?.featured ?? [],
    createdAt: data?.createdAt ?? 0,
    builtin,
  }
}

interface Store {
  user: User
  state: GameState
  menu: Record<string, string>
  defs: MonsterDef[]
  owned: OwnedMonster[]
  songs: Song[]
  gachas: Gacha[] // 先頭が「いつものガチャ」、あとは作った順
  quests: Quest[] // 作った順
  weekCheckins: Checkin[] // 今週（月曜0時から）つけた朝の記録
  week: string // 今週の月曜の日付
  today: string
  weekSets: SetRecord[] // 今週（月曜はじまり）のセット記録
  todaySets: SetRecord[]
  yesterday: string // 朝の記録の対象日
  yesterdayCheckin: Checkin | null // 前日分の朝の記録（まだなら null）
  getHistory: (exerciseId: string) => Promise<SetRecord[]>
  /** セットを記録する。このセットで今週のタスクを全部消したら weekCleared が true */
  recordSet: (rec: Omit<SetRecord, 'id' | 'ts' | 'date'>, countsBeat: boolean) => { record: SetRecord; weekCleared: boolean }
  /** 前日の歩数と習慣を記録する。1日1回だけ */
  /** habit は○×のときの結果、minutes は分数で記録するときの分数 */
  recordMorning: (steps: number, habit: boolean, minutes?: number) => Checkin | null
  setHabitLabel: (label: string) => void
  setHabitMode: (mode: GameState['habitMode']) => void
  /** 種目の枠に相棒をセットする（null で外す）。同じモンスターは1つの枠にしか入れない */
  setPartner: (slotId: string, monsterId: string | null) => void
  saveQuest: (input: QuestInput) => void
  deleteQuest: (id: string) => void
  /** 今週のクエストに挑戦する（挑戦中のものがあれば、やめて選び直す） */
  startChallenge: (questId: string, difficulty: QuestDifficulty, party: string[]) => void
  quitChallenge: () => void
  /** 討伐の報酬を受け取る。手に入ったモンスターのID */
  claimQuest: () => string | null
  setSlot: (slotId: string, exerciseId: string) => void
  buyExp: (attr: Attr, amount: number) => void
  buyEgg: () => void
  /** タマゴを孵す。選んだガチャから、確率どおりに1体（ダブりあり） */
  hatchEgg: (gachaId: string) => { def: MonsterDef; monsterId: string; shiny: boolean; pity: boolean } | null
  /** ガチャを作る・編集する。保存したガチャのID */
  saveGacha: (input: GachaInput) => Promise<string>
  /** ガチャを消す（入っていたモンスターはそのガチャから外れる）。「いつものガチャ」は消せない */
  deleteGacha: (id: string) => void
  pourExp: (monsterId: string, toNodeId: string, from: ExpSource) => void
  evolve: (monsterId: string, toNodeId: string) => void
  /** 最終形態のモンスターに、次の＋に向けてEXPを注ぐ */
  pourPlusExp: (monsterId: string, from: ExpSource) => void
  /** foodId のモンスターを monsterId（最終形態）に食べさせて＋1にする（同じモンスター同士だけ） */
  fuse: (monsterId: string, foodId: string) => void
  /** ＋5の2体を合わせて隠しモンスターを生む。生まれた個体のID */
  jogress: (monsterId: string, partnerId: string, hiddenDefId: string) => string | null
  saveMonsterDef: (input: MonsterDefInput) => Promise<void>
  loadImage: (imageId: string) => Promise<string | null>
  saveSongs: (songs: Song[]) => void
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('StoreProvider の外で useStore が呼ばれました')
  return store
}

const imageCache = new Map<string, Promise<string | null>>()

export function StoreProvider({ user, children }: { user: User; children: ReactNode }) {
  const base = `users/${user.uid}`
  const [state, setState] = useState<GameState | null>(null)
  const [menu, setMenu] = useState<Record<string, string>>({})
  const [defs, setDefs] = useState<MonsterDef[]>([])
  const [owned, setOwned] = useState<OwnedMonster[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [gachaDocs, setGachaDocs] = useState<Gacha[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [weekCheckins, setWeekCheckins] = useState<Checkin[]>([])
  const [today, setToday] = useState(dateKey())
  const [weekSets, setWeekSets] = useState<SetRecord[]>([])
  const [yesterdayCheckin, setYesterdayCheckin] = useState<Checkin | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stateRef = useMemo(() => doc(db, base, 'meta', 'state'), [base])
  const menuRef = useMemo(() => doc(db, base, 'meta', 'menu'), [base])
  const musicRef = useMemo(() => doc(db, base, 'meta', 'music'), [base])

  const fail = useCallback((e: unknown) => {
    console.error(e)
    setError('保存に失敗しました。通信状態を確認してください。')
  }, [])

  // 日付が変わったら「今日」を更新する
  useEffect(() => {
    const tick = () => setToday(dateKey())
    const timer = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        stateRef,
        { includeMetadataChanges: true },
        (snap) => {
          if (snap.exists()) {
            setState(toState(snap.data()))
          } else if (!snap.metadata.fromCache) {
            // サーバーにも存在しないと確認できたときだけ初期データを作る（別端末のデータを上書きしないため）
            setDoc(stateRef, initialState()).catch(fail)
          }
        },
        fail,
      ),
      onSnapshot(menuRef, (snap) => setMenu((snap.data() as Record<string, string>) ?? {}), fail),
      onSnapshot(musicRef, (snap) => setSongs((snap.data()?.songs as Song[] | undefined) ?? []), fail),
      onSnapshot(
        collection(db, base, 'quests'),
        (snap) =>
          setQuests(
            snap.docs
              .map((d) => ({ ...(d.data() as Omit<Quest, 'id'>), id: d.id }))
              .sort((a, b) => a.createdAt - b.createdAt),
          ),
        fail,
      ),
      onSnapshot(
        collection(db, base, 'gachas'),
        (snap) => setGachaDocs(snap.docs.map((d) => toGacha(d.id, d.data()))),
        fail,
      ),
      onSnapshot(
        collection(db, base, 'monsterDefs'),
        (snap) =>
          setDefs(
            snap.docs
              .map((d) => ({ ...(d.data() as Omit<MonsterDef, 'id'>), id: d.id }))
              .sort((a, b) => a.createdAt - b.createdAt),
          ),
        fail,
      ),
      onSnapshot(
        collection(db, base, 'ownedMonsters'),
        (snap) =>
          setOwned(
            snap.docs
              // ダブりなしだったころのデータは、ドキュメントIDがそのままモンスターのID
              .map((d) => ({ defId: d.id, ...(d.data() as Omit<OwnedMonster, 'id' | 'defId'>), id: d.id }))
              .sort((a, b) => a.obtainedAt - b.obtainedAt),
          ),
        fail,
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [base, stateRef, menuRef, musicRef, fail])

  // 「いつものガチャ」は、保存していなくても必ずある
  const gachas = useMemo(() => {
    const builtin = gachaDocs.find((g) => g.builtin) ?? toGacha(CONFIG.gacha.defaultId, undefined)
    const others = gachaDocs.filter((g) => !g.builtin).sort((a, b) => a.createdAt - b.createdAt)
    return [builtin, ...others]
  }, [gachaDocs])

  const week = useMemo(() => weekStartKey(new Date(`${today}T12:00:00`)), [today])
  const todaySets = useMemo(() => weekSets.filter((s) => s.date === today), [weekSets, today])

  // 週が変わったら（月曜になったら）今週のタスクは空から始まる
  useEffect(() => {
    setWeekSets([])
    return onSnapshot(
      query(collection(db, base, 'sets'), where('date', '>=', week)),
      (snap) =>
        setWeekSets(
          snap.docs.map((d) => ({ ...(d.data() as Omit<SetRecord, 'id'>), id: d.id })).sort((a, b) => a.ts - b.ts),
        ),
      fail,
    )
  }, [base, week, fail])

  const yesterday = useMemo(() => prevDateKey(today), [today])

  // 今週（月曜0時から）つけた朝の記録。クエストのダメージに使う
  useEffect(() => {
    setWeekCheckins([])
    const start = new Date(`${week}T00:00:00`).getTime()
    return onSnapshot(
      query(collection(db, base, 'checkins'), where('ts', '>=', start)),
      (snap) => setWeekCheckins(snap.docs.map((d) => toCheckin(d.data())).sort((a, b) => a.ts - b.ts)),
      fail,
    )
  }, [base, week, fail])

  useEffect(() => {
    setYesterdayCheckin(null)
    return onSnapshot(
      doc(db, base, 'checkins', yesterday),
      (snap) => setYesterdayCheckin(snap.exists() ? toCheckin(snap.data()) : null),
      fail,
    )
  }, [base, yesterday, fail])

  const store = useMemo<Store | null>(() => {
    if (!state) return null

    const getHistory: Store['getHistory'] = async (exerciseId) => {
      const snap = await getDocs(query(collection(db, base, 'sets'), where('exerciseId', '==', exerciseId)))
      return snap.docs.map((d) => ({ ...(d.data() as Omit<SetRecord, 'id'>), id: d.id }))
    }

    const recordSet: Store['recordSet'] = (rec, countsBeat) => {
      const ref = doc(collection(db, base, 'sets'))
      const full = { ...rec, ts: Date.now(), date: dateKey() }
      const update: DocumentData = { totalSets: increment(1) }
      if (state.lastAttendanceDate !== full.date) {
        update.attendance = increment(1)
        update.lastAttendanceDate = full.date
      }
      // EXPは、その種目の部位の属性に入る
      if (rec.exp > 0 && rec.day !== 'bonus') {
        const attr = DAYS[rec.day].attr
        update[`exp.${attr}.trained`] = increment(rec.exp)
        update[`lifetimeExp.${attr}`] = increment(rec.exp)
      }
      // ボーナス枠（腹筋ローラー）のEXPは万能EXPに入る
      if (rec.exp > 0 && rec.day === 'bonus') update.anyExp = increment(rec.exp)
      if (rec.gold > 0) update.gold = increment(rec.gold)
      if (countsBeat) update.beatCount = increment(1)
      // このセットで今週のタスクを全部消したら、全消しボーナス（同じ週に2回は渡さない）
      const thisWeek = weekStartKey()
      const before = thisWeek === week ? weekSets : []
      const weekCleared =
        state.lastClearWeek !== thisWeek && !isWeekCleared(before) && isWeekCleared([...before, full])
      if (weekCleared) {
        update.gold = increment(rec.gold + CONFIG.weekly.clearGold)
        update.weeklyClears = increment(1)
        update.lastClearWeek = thisWeek
      }
      const batch = writeBatch(db)
      batch.set(ref, full)
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return { record: { ...full, id: ref.id }, weekCleared }
    }

    const recordMorning: Store['recordMorning'] = (steps, checked, minutes) => {
      if (state.lastCheckinDate === yesterday || yesterdayCheckin) return null
      const byMinutes = state.habitMode === 'minutes'
      const mins = Math.max(0, Math.floor(minutes ?? 0))
      const habit = byMinutes ? mins >= 1 : checked
      // 朝の記録をつけ忘れた日があっても、連続日数は途切れない（つけ忘れた日の分のゴールドは出ない）
      const streak = habit ? state.habitStreak + 1 : 0
      const record: Checkin = {
        date: yesterday,
        steps: Math.floor(Math.max(0, steps)),
        habit,
        habitLabel: habitLabelOf(state),
        streak,
        stepsGold: stepsGold(steps),
        habitGold: habitGoldOf(state.habitMode, checked, mins),
        ...(byMinutes ? { habitMinutes: mins } : {}),
        ts: Date.now(),
      }
      const batch = writeBatch(db)
      batch.set(doc(db, base, 'checkins', yesterday), record)
      batch.update(stateRef, {
        gold: increment(record.stepsGold + record.habitGold),
        habitStreak: streak,
        bestHabitStreak: Math.max(state.bestHabitStreak, streak),
        lastCheckinDate: yesterday,
      })
      batch.commit().catch(fail)
      return record
    }

    const setHabitLabel: Store['setHabitLabel'] = (label) => updateState({ habitLabel: label.trim() || null })

    const setHabitMode: Store['setHabitMode'] = (mode) => updateState({ habitMode: mode })

    const setPartner: Store['setPartner'] = (slotId, monsterId) => {
      const update: DocumentData = {}
      // 同じモンスターがほかの枠にいたら外す
      for (const [slot, id] of Object.entries(state.partners)) {
        if (monsterId && id === monsterId && slot !== slotId) update[`partners.${slot}`] = deleteField()
      }
      update[`partners.${slotId}`] = monsterId ?? deleteField()
      updateState(update)
    }

    const setSlot: Store['setSlot'] = (slotId, exerciseId) => {
      setDoc(menuRef, { [slotId]: exerciseId }, { merge: true }).catch(fail)
    }

    const updateState = (update: DocumentData) => {
      const batch = writeBatch(db)
      batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    const buyExp: Store['buyExp'] = (attr, amount) => {
      const cost = amount * CONFIG.shop.goldPerExp
      if (amount <= 0 || state.gold < cost) return
      updateState({ gold: increment(-cost), [`exp.${attr}.bought`]: increment(amount) })
    }

    const buyEgg: Store['buyEgg'] = () => {
      if (state.gold < CONFIG.shop.eggPrice || !defs.some((d) => !isHidden(d))) return
      updateState({ gold: increment(-CONFIG.shop.eggPrice), eggs: increment(1) })
    }

    const hatchEgg: Store['hatchEgg'] = (gachaId) => {
      const gacha = gachas.find((g) => g.id === gachaId)
      if (!gacha || state.eggs <= 0) return null
      // 隠しモンスターはタマゴからは生まれない（rateTable が外す）
      const table = rateTable(gacha.id, defs)
      if (!isReady(gacha, table)) return null
      const pulls = state.pity[gacha.id] ?? 0
      const pity = isPity(pulls, table)
      const def = draw(table, pulls, Math.random())
      if (!def) return null
      const shiny = Math.random() < gacha.shinyRate
      const ref = doc(collection(db, base, 'ownedMonsters'))
      const batch = writeBatch(db)
      batch.set(ref, {
        defId: def.id,
        nodeId: FIRST_NODE_ID,
        investedBy: {},
        investedFrom: {},
        shiny,
        obtainedAt: Date.now(),
      })
      const update: DocumentData = { eggs: increment(-1) }
      if (shiny) update[`dexShiny.${def.id}`] = true
      update[`pity.${gacha.id}`] = rarityOf(def) === CONFIG.gacha.pity.rarity ? 0 : pulls + 1
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return { def, monsterId: ref.id, shiny, pity }
    }

    const findMonster = (monsterId: string) => {
      const mon = owned.find((o) => o.id === monsterId)
      const def = mon && defs.find((d) => d.id === mon.defId)
      if (!mon || !def) return null
      const node = getNode(getTemplate(def.templateId), mon.nodeId)
      return { mon, def, node, cost: node.next.length > 0 ? evolutionCost(node.stage) : null }
    }

    // 進化先の形態の属性のEXPを注ぐ（無属性の進化先には、どの属性のEXPでも注げる。万能EXPはどこにでも注げる）
    const pourExp: Store['pourExp'] = (monsterId, toNodeId, from) => {
      const found = findMonster(monsterId)
      if (!found?.cost || !found.node.next.includes(toNodeId)) return
      const { mon, def, node, cost } = found
      const attr = nodeAttr(def, toNodeId)
      if (from !== 'any' && attr !== 'none' && attr !== from) return
      const pour = planPour(cost, investedFor(mon, toNodeId, node.next[0]), walletOf(from))
      if (pour.trained + pour.bought <= 0) return
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        [`investedBy.${toNodeId}.trained`]: increment(pour.trained),
        [`investedBy.${toNodeId}.bought`]: increment(pour.bought),
        [`investedFrom.${toNodeId}.${from}.trained`]: increment(pour.trained),
        [`investedFrom.${toNodeId}.${from}.bought`]: increment(pour.bought),
      })
      batch.update(stateRef, spendFrom(from, pour))
      batch.commit().catch(fail)
    }

    const walletOf = (from: ExpSource): AttrExp => (from === 'any' ? { trained: state.anyExp, bought: 0 } : state.exp[from])

    const spendFrom = (from: ExpSource, pour: AttrExp): DocumentData =>
      from === 'any'
        ? { anyExp: increment(-pour.trained) }
        : { [`exp.${from}.trained`]: increment(-pour.trained), [`exp.${from}.bought`]: increment(-pour.bought) }

    // 最終形態の属性のEXP（無属性ならどの属性でも）か、万能EXPを、次の＋のゲージに注ぐ
    const pourPlusExp: Store['pourPlusExp'] = (monsterId, from) => {
      const found = findMonster(monsterId)
      if (!found || found.node.next.length > 0) return
      const { mon, def } = found
      const cost = fusionCost(mon.plus ?? 0)
      const attr = nodeAttr(def, mon.nodeId)
      if (!cost || (from !== 'any' && attr !== 'none' && attr !== from)) return
      const pour = planPour(cost, mon.plusExp ?? zeroExp(), walletOf(from))
      if (pour.trained + pour.bought <= 0) return
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        'plusExp.trained': increment(pour.trained),
        'plusExp.bought': increment(pour.bought),
        [`plusFrom.${from}.trained`]: increment(pour.trained),
        [`plusFrom.${from}.bought`]: increment(pour.bought),
      })
      batch.update(stateRef, spendFrom(from, pour))
      batch.commit().catch(fail)
    }

    const evolve: Store['evolve'] = (monsterId, toNodeId) => {
      const found = findMonster(monsterId)
      if (!found?.cost || !found.node.next.includes(toNodeId)) return
      const { mon, def, node, cost } = found
      if (!isExpFull(cost, investedFor(mon, toNodeId, node.next[0])) || state.gold < cost.gold) return
      // 選ばなかった進化先に注いでいたEXPは、元の財布に返す
      const update: DocumentData = { gold: increment(-cost.gold) }
      const refund = newRefund()
      addRefund(refund, mon, def, node.next.filter((n) => n !== toNodeId))
      applyRefund(update, refund)
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        nodeId: toNodeId,
        investedBy: {},
        investedFrom: {},
        invested: zeroExp(),
      })
      batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    // 最終形態に同じモンスター（段階は問わない）を食べさせて＋1（食べさせた側の＋も引き継ぐ）
    // 食べさせた側に注いでいたEXPは財布に返し、見つけていた形態は図鑑に残す
    const fuse: Store['fuse'] = (monsterId, foodId) => {
      const found = findMonster(monsterId)
      const food = findMonster(foodId)
      if (!found || !food || monsterId === foodId || found.mon.defId !== food.mon.defId) return
      if (found.node.next.length > 0) return
      const plus = found.mon.plus ?? 0
      const cost = fusionCost(plus)
      if (!cost || !isExpFull(cost, found.mon.plusExp ?? zeroExp()) || state.gold < cost.gold) return
      const update: DocumentData = { gold: increment(-cost.gold) }
      consume(update, [food])
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        plus: Math.min(CONFIG.fusion.maxPlus, plus + 1 + (food.mon.plus ?? 0)),
        plusExp: zeroExp(),
        plusFrom: {},
      })
      batch.delete(doc(db, base, 'ownedMonsters', foodId))
      batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    // レシピの2体（どちらも最終形態の＋5）を合わせて、隠しモンスターを生む。2体はいなくなる
    const jogress: Store['jogress'] = (monsterId, partnerId, hiddenDefId) => {
      const a = findMonster(monsterId)
      const b = findMonster(partnerId)
      const hidden = defs.find((d) => d.id === hiddenDefId)
      if (!a || !b || !hidden?.recipe || monsterId === partnerId) return null
      const pair = [a.mon.defId, b.mon.defId].sort().join()
      if ([...hidden.recipe].sort().join() !== pair) return null
      const ready = (m: NonNullable<typeof a>) => m.node.next.length === 0 && (m.mon.plus ?? 0) >= CONFIG.fusion.maxPlus
      if (!ready(a) || !ready(b) || state.gold < CONFIG.jogress.gold) return null
      const shiny = Math.random() < CONFIG.shop.shinyRate
      const ref = doc(collection(db, base, 'ownedMonsters'))
      const update: DocumentData = { gold: increment(-CONFIG.jogress.gold) }
      consume(update, [a, b])
      if (shiny) update[`dexShiny.${hidden.id}`] = true
      const batch = writeBatch(db)
      batch.set(ref, { defId: hidden.id, nodeId: FIRST_NODE_ID, investedBy: {}, investedFrom: {}, shiny, obtainedAt: Date.now() })
      batch.delete(doc(db, base, 'ownedMonsters', monsterId))
      batch.delete(doc(db, base, 'ownedMonsters', partnerId))
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return ref.id
    }

    /** いなくなる個体のEXPを財布に返し、見つけていた形態と色違いを図鑑に残すよう update に足す */
    const consume = (update: DocumentData, gone: NonNullable<ReturnType<typeof findMonster>>[]) => {
      const refund = newRefund()
      const found: Record<string, Set<string>> = {}
      for (const { mon, def, node } of gone) {
        addRefund(refund, mon, def, node.next)
        for (const src of [...ATTRS, 'any'] as const) {
          refund[src].trained += mon.plusFrom?.[src]?.trained ?? 0
          refund[src].bought += mon.plusFrom?.[src]?.bought ?? 0
        }
        found[def.id] ??= new Set()
        for (const n of pathTo(getTemplate(def.templateId), mon.nodeId)) found[def.id].add(n)
        if (mon.shiny) update[`dexShiny.${def.id}`] = true
      }
      applyRefund(update, refund)
      for (const [defId, nodes] of Object.entries(found)) update[`dexFound.${defId}`] = arrayUnion(...nodes)
      // いなくなる個体は相棒の枠から外す
      const goneIds = new Set(gone.map((g) => g.mon.id))
      for (const [slot, id] of Object.entries(state.partners)) {
        if (goneIds.has(id)) update[`partners.${slot}`] = deleteField()
      }
    }

    type Refund = Record<ExpSource, AttrExp>
    const newRefund = (): Refund => ({
      chestArms: zeroExp(),
      legs: zeroExp(),
      backShoulders: zeroExp(),
      any: zeroExp(),
    })

    const applyRefund = (update: DocumentData, refund: Refund) => {
      for (const attr of ATTRS) {
        for (const kind of ['trained', 'bought'] as const) {
          if (refund[attr][kind] > 0) update[`exp.${attr}.${kind}`] = increment(refund[attr][kind])
        }
      }
      // 万能EXPはすべて筋トレEXP扱い
      const any = refund.any.trained + refund.any.bought
      if (any > 0) update.anyExp = increment(any)
    }

    /** nodeIds の進化先に注いでいたEXPを、注いだ元の財布ごとに refund に足す */
    const addRefund = (refund: Refund, mon: OwnedMonster, def: MonsterDef, nodeIds: string[]) => {
      const add = (attr: ExpSource, exp: { trained?: number; bought?: number } | undefined) => {
        refund[attr].trained += exp?.trained ?? 0
        refund[attr].bought += exp?.bought ?? 0
      }
      const firstNext = getNode(getTemplate(def.templateId), mon.nodeId).next[0]
      for (const other of nodeIds) {
        const sources = mon.investedFrom?.[other]
        for (const attr of [...ATTRS, 'any'] as const) add(attr, sources?.[attr])
        // 旧形式のデータ（注いだ元の記録がない分）は、その進化先の属性の財布に返す
        const otherAttr = nodeAttr(def, other)
        if (other === firstNext && otherAttr !== 'none') add(otherAttr, mon.invested)
        if (otherAttr !== 'none') {
          for (const kind of ['trained', 'bought'] as const) {
            const recorded = [...ATTRS, 'any' as const].reduce((sum, attr) => sum + (sources?.[attr]?.[kind] ?? 0), 0)
            add(otherAttr, { [kind]: Math.max(0, (mon.investedBy?.[other]?.[kind] ?? 0) - recorded) })
          }
        }
      }
    }

    const saveMonsterDef: Store['saveMonsterDef'] = async (input) => {
      const existing = input.id ? defs.find((d) => d.id === input.id) : undefined
      const defRef = existing ? doc(db, base, 'monsterDefs', existing.id) : doc(collection(db, base, 'monsterDefs'))
      const images: Record<string, string> = { ...(existing?.images ?? {}) }
      const batch = writeBatch(db)
      for (const [nodeId, file] of Object.entries(input.files)) {
        const data = await compressImage(file)
        const imageRef = doc(collection(db, base, 'images'))
        batch.set(imageRef, { data, createdAt: Date.now() })
        imageCache.set(imageRef.id, Promise.resolve(data))
        if (images[nodeId]) batch.delete(doc(db, base, 'images', images[nodeId]))
        images[nodeId] = imageRef.id
      }
      batch.set(defRef, {
        name: input.name,
        attr: input.attrs[FIRST_NODE_ID],
        attrs: input.attrs,
        templateId:
          existing && !canChangeTemplate(existing.templateId, input.templateId)
            ? existing.templateId
            : input.templateId,
        images,
        names: input.names,
        recipe: input.recipe,
        gachas: input.gachas.slice(0, CONFIG.gacha.maxPerMonster),
        rarity: input.rarity,
        common: false,
        favoriteSlot: input.favoriteSlot,
        questOnly: input.questOnly,
        skill: input.skill,
        createdAt: existing?.createdAt ?? Date.now(),
      })
      batch.commit().catch(fail)
    }

    const loadImage: Store['loadImage'] = (imageId) => {
      let cached = imageCache.get(imageId)
      if (!cached) {
        cached = getDoc(doc(db, base, 'images', imageId))
          .then((snap) => (snap.data()?.data as string | undefined) ?? null)
          .catch(() => {
            imageCache.delete(imageId)
            return null
          })
        imageCache.set(imageId, cached)
      }
      return cached
    }

    const saveGacha: Store['saveGacha'] = async (input) => {
      const current = input.id ? gachas.find((g) => g.id === input.id) : undefined
      const ref = input.id ? doc(db, base, 'gachas', input.id) : doc(collection(db, base, 'gachas'))
      const batch = writeBatch(db)
      let bannerImageId = current?.bannerImageId ?? null
      if (input.banner) {
        const data = await compressImage(input.banner, CONFIG.image.bannerMaxSidePx)
        const imageRef = doc(collection(db, base, 'images'))
        batch.set(imageRef, { data, createdAt: Date.now() })
        imageCache.set(imageRef.id, Promise.resolve(data))
        if (bannerImageId) batch.delete(doc(db, base, 'images', bannerImageId))
        bannerImageId = imageRef.id
      } else if (input.removeBanner && bannerImageId) {
        batch.delete(doc(db, base, 'images', bannerImageId))
        bannerImageId = null
      }
      batch.set(ref, {
        name: input.name.trim(),
        bannerImageId,
        shinyRate: input.shinyRate,
        catchphrase: input.catchphrase.trim(),
        theme: input.theme,
        featured: input.featured.slice(0, CONFIG.gacha.bannerMonsters),
        createdAt: current?.createdAt || Date.now(),
      })
      // ピックアップの出し入れは、モンスターの「入るガチャ」に書く（1体につき最大3つまで）
      if (input.pickups && !current?.builtin) {
        for (const def of defs.filter((d) => !isHidden(d) && isPickupRarity(rarityOf(d)))) {
          const has = def.gachas?.includes(ref.id) ?? false
          const want = input.pickups.includes(def.id)
          if (want && !has && (def.gachas?.length ?? 0) < CONFIG.gacha.maxPerMonster) {
            batch.update(doc(db, base, 'monsterDefs', def.id), { gachas: arrayUnion(ref.id) })
          } else if (!want && has) {
            batch.update(doc(db, base, 'monsterDefs', def.id), { gachas: arrayRemove(ref.id) })
          }
        }
      }
      batch.commit().catch(fail)
      return ref.id
    }

    const deleteGacha: Store['deleteGacha'] = (id) => {
      const gacha = gachas.find((g) => g.id === id)
      if (!gacha || gacha.builtin) return
      const batch = writeBatch(db)
      batch.delete(doc(db, base, 'gachas', id))
      if (gacha.bannerImageId) batch.delete(doc(db, base, 'images', gacha.bannerImageId))
      for (const def of defs.filter((d) => d.gachas?.includes(id))) {
        batch.update(doc(db, base, 'monsterDefs', def.id), { gachas: arrayRemove(id) })
      }
      batch.commit().catch(fail)
    }

    const saveQuest: Store['saveQuest'] = (input) => {
      const { id, ...data } = input
      const current = id ? quests.find((q) => q.id === id) : undefined
      const ref = id ? doc(db, base, 'quests', id) : doc(collection(db, base, 'quests'))
      setDoc(ref, {
        ...data,
        name: data.name.trim(),
        catchphrase: data.catchphrase.trim(),
        weakSlots: data.weakSlots.slice(0, CONFIG.quest.maxWeakSlots),
        createdAt: current?.createdAt ?? Date.now(),
      }).catch(fail)
    }

    const deleteQuest: Store['deleteQuest'] = (id) => {
      const batch = writeBatch(db)
      batch.delete(doc(db, base, 'quests', id))
      if (state.challenge?.questId === id && !state.challenge.cleared) batch.update(stateRef, { challenge: null })
      batch.commit().catch(fail)
    }

    const startChallenge: Store['startChallenge'] = (questId, difficulty, party) => {
      if (!quests.some((q) => q.id === questId)) return
      if (state.challenge?.week === week && state.challenge.cleared) return // 今週はもうクリアした
      const ids = party.filter((p) => owned.some((o) => o.id === p)).slice(0, CONFIG.quest.partySize)
      updateState({ challenge: { week, questId, difficulty, party: ids, startTs: Date.now(), cleared: false } })
    }

    const quitChallenge: Store['quitChallenge'] = () => {
      if (state.challenge && !state.challenge.cleared) updateState({ challenge: null })
    }

    const claimQuest: Store['claimQuest'] = () => {
      const c = state.challenge
      const quest = c && quests.find((q) => q.id === c.questId)
      const boss = quest && defs.find((d) => d.id === quest.bossDefId)
      if (!c || !quest || !boss || c.week !== week || c.cleared) return null
      const party = c.party.flatMap((id) => {
        const mon = owned.find((o) => o.id === id)
        const def = mon && defs.find((d) => d.id === mon.defId)
        return mon && def ? [{ mon, def }] : []
      })
      const sets = weekSets.filter((s) => s.ts >= c.startTs)
      const checkins = weekCheckins.filter((k) => k.ts >= c.startTs)
      const damage = questHits(quest, party, sets, checkins, () => '').reduce((sum, h) => sum + h.damage, 0)
      if (damage < quest.hp[c.difficulty]) return null
      const diff = CONFIG.quest.difficulties[c.difficulty]
      const shiny = Math.random() < CONFIG.shop.shinyRate
      const ref = doc(collection(db, base, 'ownedMonsters'))
      const batch = writeBatch(db)
      batch.set(ref, {
        defId: boss.id,
        nodeId: FIRST_NODE_ID,
        investedBy: {},
        investedFrom: {},
        plus: diff.plus,
        shiny,
        obtainedAt: Date.now(),
      })
      const update: DocumentData = {
        gold: increment(diff.gold),
        questClears: increment(1),
        'challenge.cleared': true,
      }
      if (shiny) update[`dexShiny.${boss.id}`] = true
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return ref.id
    }

    const saveSongs: Store['saveSongs'] = (next) => {
      setDoc(musicRef, { songs: next }).catch(fail)
    }

    return {
      user,
      state,
      menu,
      defs,
      owned,
      songs,
      today,
      weekSets,
      todaySets,
      yesterday,
      yesterdayCheckin,
      getHistory,
      recordSet,
      recordMorning,
      setHabitLabel,
      setHabitMode,
      setPartner,
      setSlot,
      buyExp,
      buyEgg,
      hatchEgg,
      pourExp,
      evolve,
      pourPlusExp,
      fuse,
      jogress,
      saveMonsterDef,
      loadImage,
      saveSongs,
      gachas,
      saveGacha,
      quests,
      weekCheckins,
      week,
      saveQuest,
      deleteQuest,
      startChallenge,
      quitChallenge,
      claimQuest,
      deleteGacha,
    }
  }, [user, base, state, menu, defs, owned, songs, gachas, quests, weekCheckins, today, yesterday, yesterdayCheckin, week, weekSets, todaySets, stateRef, menuRef, musicRef, fail])

  if (!store) {
    return (
      <div className="center-screen">
        <p>データを読み込んでいます…</p>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <StoreContext.Provider value={store}>
      {children}
      {error && (
        <div className="toast error" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </StoreContext.Provider>
  )
}
