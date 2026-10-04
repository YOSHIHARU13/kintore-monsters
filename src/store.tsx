import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  collection,
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
import { FIRST_NODE_ID, canChangeTemplate, getNode, getTemplate } from './data/evolutionTemplates'
import { dateKey, weekStartKey } from './lib/date'
import { evolutionCost, isExpFull, planPour } from './lib/evolution'
import { cardioGold } from './lib/rewards'
import { isWeekCleared } from './lib/week'
import { compressImage } from './lib/imageCompress'
import { investedFor, nodeAttr, type Activity, type GameState, type MonsterDef, type OwnedMonster, type SetRecord, type Song } from './types'

const zeroExp = () => ({ trained: 0, bought: 0 })

function initialState(): GameState {
  return {
    gold: 0,
    eggs: CONFIG.shop.starterEggs,
    exp: { chestArms: zeroExp(), legs: zeroExp(), backShoulders: zeroExp() },
    lifetimeExp: { chestArms: 0, legs: 0, backShoulders: 0 },
    attendance: 0,
    lastAttendanceDate: null,
    totalSets: 0,
    beatCount: 0,
    weeklyClears: 0,
    lastClearWeek: null,
    activeMonsterId: null,
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

export interface MonsterDefInput {
  id?: string
  name: string
  templateId: string
  attrs: Record<string, FormAttr> // nodeId → その形態の属性
  names: Record<string, string> // nodeId → その段階だけの名前
  files: Record<string, File> // nodeId → 新しくアップロードする画像
}

interface Store {
  user: User
  state: GameState
  menu: Record<string, string>
  defs: MonsterDef[]
  owned: OwnedMonster[]
  songs: Song[]
  today: string
  weekSets: SetRecord[] // 今週（月曜はじまり）のセット記録
  todaySets: SetRecord[]
  todayActivities: Activity[]
  getHistory: (exerciseId: string) => Promise<SetRecord[]>
  /** セットを記録する。このセットで今週のタスクを全部消したら weekCleared が true */
  recordSet: (rec: Omit<SetRecord, 'id' | 'ts' | 'date'>, countsBeat: boolean) => { record: SetRecord; weekCleared: boolean }
  recordCardio: (kind: string, label: string, minutes: number) => void
  setSlot: (slotId: string, exerciseId: string) => void
  buyExp: (attr: Attr, amount: number) => void
  buyEgg: () => void
  /** タマゴを孵す。登録済みのモンスターからランダムで1体（ダブりあり） */
  hatchEgg: () => { def: MonsterDef; monsterId: string } | null
  pourExp: (monsterId: string, toNodeId: string, from: Attr) => void
  evolve: (monsterId: string, toNodeId: string) => void
  setActive: (monsterId: string) => void
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
  const [today, setToday] = useState(dateKey())
  const [weekSets, setWeekSets] = useState<SetRecord[]>([])
  const [todayActivities, setTodayActivities] = useState<Activity[]>([])
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

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        query(collection(db, base, 'activities'), where('date', '==', today)),
        (snap) =>
          setTodayActivities(
            snap.docs.map((d) => ({ ...(d.data() as Omit<Activity, 'id'>), id: d.id })).sort((a, b) => b.ts - a.ts),
          ),
        fail,
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [base, today, fail])

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

    const recordCardio: Store['recordCardio'] = (kind, label, minutes) => {
      const gold = cardioGold(minutes)
      if (gold <= 0) return
      const batch = writeBatch(db)
      batch.set(doc(collection(db, base, 'activities')), {
        kind,
        label,
        minutes: Math.floor(minutes),
        gold,
        date: dateKey(),
        ts: Date.now(),
      })
      batch.update(stateRef, { gold: increment(gold) })
      batch.commit().catch(fail)
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
      if (state.gold < CONFIG.shop.eggPrice || defs.length === 0) return
      updateState({ gold: increment(-CONFIG.shop.eggPrice), eggs: increment(1) })
    }

    const hatchEgg: Store['hatchEgg'] = () => {
      if (state.eggs <= 0 || defs.length === 0) return null
      const def = defs[Math.floor(Math.random() * defs.length)]
      const ref = doc(collection(db, base, 'ownedMonsters'))
      const batch = writeBatch(db)
      batch.set(ref, {
        defId: def.id,
        nodeId: FIRST_NODE_ID,
        investedBy: {},
        investedFrom: {},
        obtainedAt: Date.now(),
      })
      const update: DocumentData = { eggs: increment(-1) }
      if (!state.activeMonsterId) update.activeMonsterId = ref.id
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return { def, monsterId: ref.id }
    }

    const findMonster = (monsterId: string) => {
      const mon = owned.find((o) => o.id === monsterId)
      const def = mon && defs.find((d) => d.id === mon.defId)
      if (!mon || !def) return null
      const node = getNode(getTemplate(def.templateId), mon.nodeId)
      return { mon, def, node, cost: node.next.length > 0 ? evolutionCost(node.stage) : null }
    }

    // 進化先の形態の属性のEXPを注ぐ（無属性の進化先には、どの属性のEXPでも注げる）
    const pourExp: Store['pourExp'] = (monsterId, toNodeId, from) => {
      const found = findMonster(monsterId)
      if (!found?.cost || !found.node.next.includes(toNodeId)) return
      const { mon, def, node, cost } = found
      const attr = nodeAttr(def, toNodeId)
      if (attr !== 'none' && attr !== from) return
      const pour = planPour(cost, investedFor(mon, toNodeId, node.next[0]), state.exp[from])
      if (pour.trained + pour.bought <= 0) return
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        [`investedBy.${toNodeId}.trained`]: increment(pour.trained),
        [`investedBy.${toNodeId}.bought`]: increment(pour.bought),
        [`investedFrom.${toNodeId}.${from}.trained`]: increment(pour.trained),
        [`investedFrom.${toNodeId}.${from}.bought`]: increment(pour.bought),
      })
      batch.update(stateRef, {
        [`exp.${from}.trained`]: increment(-pour.trained),
        [`exp.${from}.bought`]: increment(-pour.bought),
      })
      batch.commit().catch(fail)
    }

    const evolve: Store['evolve'] = (monsterId, toNodeId) => {
      const found = findMonster(monsterId)
      if (!found?.cost || !found.node.next.includes(toNodeId)) return
      const { mon, def, node, cost } = found
      if (!isExpFull(cost, investedFor(mon, toNodeId, node.next[0])) || state.gold < cost.gold) return
      // 選ばなかった進化先に注いでいたEXPは、元の財布に返す
      const update: DocumentData = { gold: increment(-cost.gold) }
      const giveBack = (attr: Attr, exp: { trained?: number; bought?: number } | undefined) => {
        for (const kind of ['trained', 'bought'] as const) {
          const amount = exp?.[kind] ?? 0
          if (amount > 0) update[`exp.${attr}.${kind}`] = increment(amount)
        }
      }
      const refund: Record<Attr, { trained: number; bought: number }> = {
        chestArms: { trained: 0, bought: 0 },
        legs: { trained: 0, bought: 0 },
        backShoulders: { trained: 0, bought: 0 },
      }
      const add = (attr: Attr, exp: { trained?: number; bought?: number } | undefined) => {
        refund[attr].trained += exp?.trained ?? 0
        refund[attr].bought += exp?.bought ?? 0
      }
      for (const other of node.next.filter((n) => n !== toNodeId)) {
        const sources = mon.investedFrom?.[other]
        for (const attr of ATTRS) add(attr, sources?.[attr])
        // 旧形式のデータ（注いだ元の記録がない分）は、その進化先の属性の財布に返す
        const otherAttr = nodeAttr(def, other)
        if (other === node.next[0] && otherAttr !== 'none') add(otherAttr, mon.invested)
        if (otherAttr !== 'none') {
          for (const kind of ['trained', 'bought'] as const) {
            const recorded = ATTRS.reduce((sum, attr) => sum + (sources?.[attr]?.[kind] ?? 0), 0)
            add(otherAttr, { [kind]: Math.max(0, (mon.investedBy?.[other]?.[kind] ?? 0) - recorded) })
          }
        }
      }
      for (const attr of ATTRS) giveBack(attr, refund[attr])
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

    const setActive: Store['setActive'] = (monsterId) => updateState({ activeMonsterId: monsterId })

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
      todayActivities,
      getHistory,
      recordSet,
      recordCardio,
      setSlot,
      buyExp,
      buyEgg,
      hatchEgg,
      pourExp,
      evolve,
      setActive,
      saveMonsterDef,
      loadImage,
      saveSongs,
    }
  }, [user, base, state, menu, defs, owned, songs, today, week, weekSets, todaySets, todayActivities, stateRef, menuRef, musicRef, fail])

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
