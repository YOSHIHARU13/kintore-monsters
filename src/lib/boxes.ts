import { CONFIG } from '../config/gameConfig'
import { ATTR_LABEL } from '../data/exercises'
import { BALL_LABEL, CORE_LABEL, STONE_LABEL, type LotDrop } from './cores'
import { gradeOf } from './quest'
import { canShinkaDef, shinkaRecipe } from './shinka'
import type { MonsterDef, Quest, QuestDifficulty } from '../types'

/**
 * 降臨の宝箱（モンスト式）。1周で base 個、出撃した運極1体ごとに perLuckMax 個増える。
 * 1箱ごとに bossRate でボス（運1）。残りはボス以外の報酬を均等に。
 * 神化素材のボスは、1箱で1〜3体・それぞれ運1〜3。討伐ブースターは中身の数を2倍にする（箱の数は増えない）
 */
export type BoxKind = 'boss' | 'stone' | 'core' | 'exp' | 'coins' | 'ball'

export interface BoxItem {
  kind: BoxKind
  count: number // ボスなら体数
  luck?: number // ボスの運（合計）
}

/** 宝箱の中身の段：究極以下（low）か、超絶以上（high：筋肉玉も入る） */
export function boxTier(quest: Pick<Quest, 'grade' | 'rank'>): 'low' | 'high' {
  return ['chozetsu', 'chokyukyoku', 'bakuzetsu'].includes(gradeOf(quest)) ? 'high' : 'low'
}

/** 宝箱の数：基本＋運極1体ごとに追加 */
export function boxCount(luckMaxCount: number): number {
  return CONFIG.boxes.base + CONFIG.boxes.perLuckMax * luckMaxCount
}

/** そのボスが、どれかの激レア（爆絶の降臨）の獣神化の素材か */
export function isShinkaMaterial(boss: MonsterDef, defs: MonsterDef[]): boolean {
  return defs.some((d) => canShinkaDef(d) && shinkaRecipe(d, defs).some((i) => i.defId === boss.id))
}

/** ボス以外で出るもの（零属性のボスは結晶が出ない） */
export function boxPool(quest: Pick<Quest, 'grade' | 'rank' | 'element'>): Exclude<BoxKind, 'boss' | 'core'>[] {
  const kinds: Exclude<BoxKind, 'boss' | 'core'>[] = ['stone', 'exp', 'coins']
  if (boxTier(quest) === 'high') kinds.push('ball')
  return kinds.filter((k) => k !== 'stone' || !!quest.element)
}

export function rollBoxes(
  quest: Pick<Quest, 'grade' | 'rank' | 'element'>,
  opts: { luckMaxCount: number; shinkaMaterial: boolean; boosted: boolean },
  random: () => number,
): BoxItem[] {
  const b = CONFIG.boxes
  const amounts = b.amounts[boxTier(quest)]
  const pool = boxPool(quest)
  const times = opts.boosted ? 2 : 1
  return Array.from({ length: boxCount(opts.luckMaxCount) }, (): BoxItem => {
    if (random() < b.bossRate) {
      if (!opts.shinkaMaterial) return { kind: 'boss', count: times, luck: times }
      const pick = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1))
      const count = pick(b.shinkaBodies[0], b.shinkaBodies[1])
      let luck = 0
      for (let i = 0; i < count; i++) luck += pick(b.shinkaLuck[0], b.shinkaLuck[1])
      return { kind: 'boss', count: count * times, luck: luck * times }
    }
    const kind = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
    return { kind, count: amounts[kind] * times }
  })
}

export const BOX_ICON: Record<BoxKind, string> = { boss: '👾', stone: '💠', core: '💎', exp: '💪', coins: '🪙', ball: '🟣' }

/** 宝箱の中身の名前 */
export function boxLabel(kind: BoxKind, quest: Pick<Quest, 'element' | 'attr'>, bossName = 'ボス'): string {
  if (kind === 'boss') return bossName
  if (kind === 'stone') return quest.element ? STONE_LABEL(quest.element) : '結晶'
  if (kind === 'core') return quest.attr === 'none' ? BALL_LABEL : CORE_LABEL[quest.attr]
  if (kind === 'exp') return quest.attr === 'none' ? '万能EXP' : `${ATTR_LABEL[quest.attr]}のEXP`
  if (kind === 'coins') return '進化コイン'
  return '筋肉玉'
}

/** 宝箱の中身をまとめる（同じ種類を足す） */
export function sumBoxes(items: BoxItem[]): Record<BoxKind, number> & { luck: number } {
  const sum = { boss: 0, stone: 0, core: 0, exp: 0, coins: 0, ball: 0, luck: 0 }
  for (const it of items) {
    sum[it.kind] += it.count
    if (it.kind === 'boss') sum.luck += it.luck ?? it.count
  }
  return sum
}

/** 素材クエストの宝箱で、当たりになる中身（部位のない素材クエストの核は筋肉玉） */
export function materialBoxKind(kind: LotDrop, quest: Pick<Quest, 'attr'>): BoxKind {
  if (kind === 'muscle') return quest.attr === 'none' ? 'ball' : 'core'
  return kind
}

/**
 * 素材クエストの宝箱：数は降臨と同じ（基本＋運極1体ごとに追加）。1箱ごとに rate でその素材、はずれの箱は進化コインかEXP。
 * 筋肉玉は、続けて落ちないと（misses が天井の回数に届くと）最後の箱が必ず筋肉玉。討伐ブースターは中身の数を2倍
 */
export function rollMaterialBoxes(
  kind: LotDrop,
  quest: Pick<Quest, 'attr'>,
  difficulty: QuestDifficulty,
  opts: { luckMaxCount: number; boosted: boolean; misses: number },
  random: () => number,
): { boxes: BoxItem[]; pity: boolean } {
  const m = CONFIG.materials
  const d = m.drops[kind][difficulty]
  const main = materialBoxKind(kind, quest)
  const times = opts.boosted ? 2 : 1
  const boxes = Array.from({ length: boxCount(opts.luckMaxCount) }, (): BoxItem => {
    if (random() < d.rate) return { kind: main, count: d.amount * times }
    const other = kind === 'coins' || random() < 0.5 ? 'exp' : 'coins'
    return { kind: other, count: m.consolation[other] * times }
  })
  if (kind === 'ball' && !boxes.some((b) => b.kind === 'ball') && opts.misses + 1 >= m.ballPityMisses) {
    boxes[boxes.length - 1] = { kind: 'ball', count: times }
    return { boxes, pity: true }
  }
  return { boxes, pity: false }
}
