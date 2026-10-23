import type { Reward } from '../lib/missions'
import type { BoosterKey, QuestGrade, RarityKey } from '../types'
import type { FreePullEvent } from '../lib/events'
// ============================================================
// ゲームの数値はすべてこのファイルにまとめてあります。
// バランスを調整したいときは、ここの数字だけを書き換えてください。
// ============================================================

export const CONFIG = {
  // ダンベルの重さ
  weight: {
    minKg: 1,
    maxKg: 10,
    stepKg: 1,
    defaultKg: 3, // 記録がまだない種目の初期重量
  },

  // セットのルール
  sets: {
    perExercise: 3, // 1種目あたりの基本セット数
    minIntervalSec: 30, // 同じ種目でこの秒数より短い間隔のセットはEXP対象外
    restSec: 90, // 休憩タイマーの目安
    // 基本セットを終えても、追加のセットはEXP満額・ダメージも等倍（遊びのために追加でやれる）
  },

  // 今週のタスク（全種目×基本セット数）を全部消したときのボーナス
  weekly: {
    clearGold: 15, // オーブ
  },

  // プレイヤーランク：筋トレで稼いだEXP（ローラーの万能EXPも。買ったEXPは数えない）の積み上げで上がる
  // ランクrからr+1に必要なEXP = base + step ×（r − 1）。1回のトレーニングは約180EXP
  // ランク10まで10回くらい、30まで半年弱、50まで1年くらい
  rank: {
    base: 100,
    step: 20,
    reward: { eggs: 1 } as Reward, // ランクが上がるたびに
    milestoneEvery: 10,
    milestone: { eggs: 5 } as Reward, // 10ランクごとに追加で
  },

  // 重量アップ・上位種目の提案
  progression: {
    streak: 2, // 「基本セットがすべて回数上限」を何回連続で達成したら提案するか
  },

  // 目標回数の決め方
  target: {
    recentCount: 3, // 直近何回の平均を使うか
    plus: 1, // 平均に足す回数
    keepMargin: 1, // 目標からこの回数以内なら「キープ」
    secondsScale: 5, // 秒数の種目（プランクなど）は、足す数とキープの幅をこの倍に（＋5秒・5秒以内でキープ）
  },

  // 筋トレ1セットのEXP
  exp: {
    normal: 10,
    keep: 12,
    beat: 15,
  },

  // 全身枠（腹筋ローラー・プランク・全身種目）。オーブは全身枠ぜんぶで1日3セットまで（EXPは何セットでも）
  bonus: {
    goldPerSet: 2, // オーブ
    anyExpPerSet: 10, // 万能EXP：どの属性の進化にも注げる
  },

  // 朝の記録（前日の歩数）と、習慣（その場で記録）
  morning: {
    stepsPerGold: 500, // この歩数ごとに1オーブ（5000歩で10オーブ＝ガチャ2回）
    stepBonuses: [
      { steps: 8000, gold: 5 },
      { steps: 10000, gold: 10 },
    ], // 届いた中でいちばん上のボーナス（1万歩なら 20 + 10 = 30オーブ）
    maxSteps: 100_000, // 入力できる歩数の上限
    habitGold: 15, // 習慣ができた日のオーブ（○×で記録するとき）
    // 習慣を分数で記録するときの、1分あたりのオーブ（端数は切り捨て）。1回に続けた分数が長いほど高い（5分で15オーブ＝ガチャ3回）
    habitRates: [
      { from: 1, perMinute: 1.5 },
      { from: 5, perMinute: 3 },
    ],
    habitMaxMinutes: 30, // 分数で記録するとき、オーブが出るのは1日の合計でこの分数まで
    habitFullMinutes: 10, // 1日の最初のこの分数までは上の単価。そこから habitMaxMinutes までは habitLateRate（30分で50オーブ）
    habitLateRate: 1,
    // 2つ目の習慣（設定で1つ選ぶ）。goodThings は「昨日あった良いこと」を1つ書くごとに、1日 max 個まで
    habit2: {
      goodThings: { icon: '📝', label: '昨日あった良いことを書く', gold: 3, max: 3 },
      sunlight: { icon: '🌅', label: '朝、日の光を5分浴びる', gold: 10, max: 1 },
      stretch: { icon: '🧘', label: 'ストレッチを5分する', gold: 10, max: 1 },
      phone: { icon: '📵', label: '寝る1時間前にスマホを置く', gold: 10, max: 1 },
    } as Record<string, { icon: string; label: string; gold: number; max: number }>,
    habitDefaultLabel: 'ベッドでスマホを見なかった', // 習慣の名前（設定で変えられる）
  },

  // ショップ
  shop: {
    coinsPerExp: 5, // 1EXPを買うのに必要な進化コイン
    expBuyStep: 10, // EXP購入の±ボタン1回分
    boughtExpMaxRatio: 0.5, // 購入EXPで埋められるのは進化必要EXPのこの割合まで
    pullPrice: 5, // ガチャ1回のオーブ（トク玉なら1個で1回）。歩数5000歩・瞑想5分でちょうど1回
    shinyRate: 1 / 20, // ガチャから色違いが生まれる確率
    starterEggs: 1, // 開始時にもらえるトク玉
  },

  // 攻撃力 = 星の数 × perStar ＋ レア度の上乗せ
  attack: {
    perStar: 3000,
  },

  // 種目の相棒：枠ごとに1体セットすると、その種目のEXPが増える
  // 倍率 = 1 + 攻撃力 × perAttack（得意種目の枠なら、さらに × favorite）
  partner: {
    perAttack: 0.05 / 3000, // 星1つぶん（攻撃力3000）で +5%
    favorite: 1.2,
  },

  // アビリティ：クエストの編成の条件になる。名前はギミック（バリア）→ アビリティ（バリアブレイカー）の組で持つ
  gimmicks: {
    // アビリティ（スキル）の名前。クエストは「アーク 4体」のようにスキル名で募集する。
    // コラボキャラのイメージを壊さないよう、短くて抽象的な名前にしてある。左は内部の名前（変えないこと）
    // 2026-10-23 に4種類から7種類に（組み合わせを増やして、高難度の寿命を延ばす）
    defaults: {
      バリア: 'アーク',
      シールド: 'ノヴァ',
      リジェネ: 'パルス',
      ミラー: 'ルーン',
      ワープ: 'エッジ',
      ブロック: 'ヴェイル',
      ウィンド: 'ギア',
    } as Record<string, string>,
    // 以前あったもの（選べないが、付けてあるモンスターやクエストの表示用に名前だけ残す）
    legacy: {
      フィールド: 'フィールドジャマー',
      フォース: 'フォースキャンセラー',
      ウォール: 'ウォールバスター',
      オーラ: 'オーライーター',
    } as Record<string, string>,
    // 持てるアビリティの数（レア度の格）。ジョグレスは jogress
    slots: { normal: 1, rare: 2, superRare: 2, jogress: 3 },
  },

  // クエスト：出撃したら、その日のうちに倒す勝負。出撃してからのセットがそのままダメージになる（何回でも挑戦できる）
  // ダメージになるのは、前のセットから30秒以上あけたセット（何セット目でも）
  quest: {
    // 1回ぶんのダメージ = 基本値 × 攻撃するモンスターの攻撃力 ÷ attackUnit × 補正
    attackUnit: 3000,
    setDamage: 2.5, // 筋トレ1セット（全員が攻撃。セットの部位と一致するモンスターは × partMatch）
    partMatch: 2,
    rollerDamage: 4, // 全身枠1セット（全員で同じだけ攻撃）
    weakSlot: 2, // ボスの弱点種目のセット（ボスの部位の補正にさらに掛かる）
    bossPart: 1.3, // ボスの部位（胸腕・脚・背肩）の種目のセットは、どれでもこの倍率。中でも弱点種目がいちばん効く
    offElementChozetsu: 0.5, // 超絶では、ボスの属性に有利な属性を持たないモンスターの攻撃はこの倍率
    offElementBakuzetsu: 1 / 3, // 爆絶ではこの倍率
    abilityBonus: 0.25, // クエストの条件に合うアビリティ1つにつき、その子のダメージ +25%（2つなら×1.5）
    collabBonus: 1.5, // コラボの激レア・レアは、同じコラボのボスのクエストで攻撃がこの倍率（確定）
    zeroBonus: 1.2, // 零属性の子は、どのクエストでも攻撃がこの倍率（弱点はつけないが、半減もされない）
    favorite: 1.5, // 攻撃したモンスターの得意種目のセット
    maxWeakSlots: 2,
    // ボスの格：初級・中級・上級のHPとGが、まとめてこの倍率になる
    ranks: [
      { label: '雑魚', hp: 0.5, gold: 0.5 },
      { label: '普通', hp: 1, gold: 1 },
      { label: '強敵', hp: 1.6, gold: 1.5 },
      { label: '凶悪', hp: 2.5, gold: 2.2 },
      { label: '極', hp: 4, gold: 3.5 },
    ],
    // ボスクエストの格：難易度は1つだけで、クエストそのものに格がある（素材クエストは初級〜上級のまま）
    // hpRatio：1回のトレーニングで与えるダメージの目安に対するHPの倍率
    grades: {
      // gold はオーブ（進化コインはその coins.perOrb 倍）。頑張った分だけ増える報酬なので多め（週100連が目安）
      jokyu: { label: '上級', hpRatio: 0.45, gold: 8 }, // 育ちきっていなくても倒せる入門
      kiwami: { label: '極', hpRatio: 0.9, gold: 12 },
      kyukyoku: { label: '究極', hpRatio: 1.5, gold: 20 },
      chozetsu: { label: '超絶', hpRatio: 2.5, gold: 40 },
      chokyukyoku: { label: '超究極', hpRatio: 2.5, gold: 40 }, // 主にコラボ用。強さと報酬は超絶と同じ
      bakuzetsu: { label: '爆絶', hpRatio: 3.5, gold: 60 }, // 超絶の上。零の孤城の1〜10階のボス
    },
    // 降臨の格＝そのボスとして落ちる子の強さ：星・アビリティの数・攻撃力の上乗せ（爆絶は獣神化で★4）
    bossGrades: {
      jokyu: { stars: 1, abilities: 0, attack: 0 },
      kiwami: { stars: 2, abilities: 1, attack: 0 },
      // 降臨は「ギミックを埋める代役。殴る力はちょっと心許ない」。攻撃力（★×3000＋attack）は
      // 究極8,000・超絶9,500（レア★3の11,500より下）・爆絶13,000（激レア★3の15,000より少し下）。★4の爆絶は16,000
      kyukyoku: { stars: 3, abilities: 1, attack: -1000 },
      chozetsu: { stars: 3, abilities: 2, attack: 500 },
      chokyukyoku: { stars: 3, abilities: 2, attack: 500 },
      bakuzetsu: { stars: 3, abilities: 3, attack: 4000 },
    } as Record<QuestGrade, { stars: number; abilities: number; attack: number }>,
    // 素材クエストの難易度：HPは「1回のトレーニングで与えるダメージの目安 × materials.hpRatio × hpRatio」
    // 上の難易度ほど編成の条件がきつくなるが、セットあたりのドロップは多くなる（そろえられるなら上を回るほうが得）
    difficulties: {
      easy: { label: '初級', gold: 5, hpRatio: 0.8 },
      normal: { label: '上級', gold: 10, hpRatio: 1.4 },
      hard: { label: '究極', gold: 15, hpRatio: 2 },
    },
    partySize: 6, // 出撃できる数
    // どのクエストも3バトル（HPを3等分。1バトル目が道中、2バトル目が中ボス、3バトル目がボス）
    battles: 3,
  },
  // おまかせのクエスト：基本は「弱点属性＋アビリティの持ち物検査」。格が上がるほど、どちらも増える
  // element：ボスに有利な属性の数、kinds：零属性のボスのときに求める属性の種類（ジョグレスの2属性は2種類）
  // abilities：アビリティの種類、abilityCount：1種類あたりの数（1体1つずつでよい。単アビの子も連れて行ける）
  // combo：1体で2つ同時に持つ子の数、weak：弱点種目の数
  // コラボのボスだけは、同じコラボの子が活躍する条件にする（超究極など）
  questAuto: {
    jokyu: { element: 2, kinds: 3, abilities: 0, abilityCount: 0, combo: 0, weak: 1 },
    kiwami: { element: 3, kinds: 3, abilities: 1, abilityCount: 2, combo: 0, weak: 1 },
    kyukyoku: { element: 3, kinds: 4, abilities: 2, abilityCount: 2, combo: 0, weak: 1 },
    chozetsu: { element: 4, kinds: 5, abilities: 3, abilityCount: 3, combo: 0, weak: 2 },
    bakuzetsu: { element: 5, kinds: 5, abilities: 4, abilityCount: 3, combo: 2, weak: 2 },
    chokyukyoku: { element: 4, kinds: 5, abilities: 3, abilityCount: 3, combo: 0, weak: 2 },
    // 素材クエストは難易度ごと（初級はほぼ縛りなし、究極でやっとアビリティ）
    material: {
      easy: { element: 0, kinds: 0, abilities: 0, abilityCount: 0, combo: 0, weak: 1 },
      normal: { element: 2, kinds: 3, abilities: 0, abilityCount: 0, combo: 0, weak: 1 },
      hard: { element: 3, kinds: 4, abilities: 1, abilityCount: 2, combo: 0, weak: 2 },
    },
  },
  // 獣神化（★4）：格は金（激レア2体の合体）・銀（専用の絵）・銅（後光だけ）。素材はモンスターごとのレシピ（lib/shinka）
  // bonus：★が1つ増えるぶんとは別の攻撃力の上乗せ。爆絶の降臨の獣神化（銅）は questBonus（降臨なので少し弱い）
  // レシピの運：1種類あたり maxLuckPerItem まで、合計 maxLuckTotal まで（宝箱から1周で運4くらい集まる）
  shinka: {
    coins: 300,
    bonus: { gold: 6000, silver: 3000, bronze: 1500 },
    questBonus: 0,
    maxLuckPerItem: 15,
    maxLuckTotal: 30,
  },
  // 進化コイン：進化・ジョグレス・EXPの購入に使う（オーブはガチャとブースター用）。ボスクエストではオーブと同じだけもらえる
  coins: {
    perOrb: 10, // ボスクエスト・試練の塔では、もらえるオーブ1につき進化コインがこれだけ
  },
  // ミッション・ログインボーナス・図鑑の達成報酬・一度きりのプレゼント
  missions: {
    daily: { reward: { gold: 2 }, allReward: { eggs: 1 }, habitMinutes: 5 },
    weekly: { reward: { eggs: 1 }, days: 3, sets: 30, habitMinutes: 60 },
    // ログインした日数で7日周期（休んでもリセットされない）
    login: [
      { gold: 5 },
      { gold: 5 },
      { eggs: 1 },
      { gold: 5 },
      { booster: 'exp' },
      { gold: 5 },
      { eggs: 2 },
    ] as Reward[],
    // 運極の種類の数（同じモンスターの運極は1種類として数える）の区切りの報酬
    luckMax: [
      { count: 5, reward: { eggs: 5 } },
      { count: 10, reward: { eggs: 10 } },
      { count: 20, reward: { eggs: 15 } },
      { count: 30, reward: { eggs: 20 } },
      { count: 40, reward: { eggs: 25 } },
      { count: 50, reward: { eggs: 30 } },
      { count: 75, reward: { eggs: 40 } },
      { count: 100, reward: { eggs: 50 } },
    ] as { count: number; reward: Reward }[],
    dex: [
      { percent: 10, reward: { eggs: 3 } },
      { percent: 25, reward: { eggs: 5 } },
      { percent: 50, reward: { eggs: 10 } },
      { percent: 75, reward: { eggs: 10 } },
      { percent: 100, reward: { eggs: 20 } },
    ] as { percent: number; reward: Reward }[],
    // 一度だけのプレゼント（スタートダッシュ）
    gifts: [
      {
        id: 'startDash',
        label: 'スタートダッシュ記念',
        reward: { eggs: 30, gold: 50 },
        boosters: ['habit', 'exp', 'quest'],
      },
      // 最初はどのクエストもきついので、★3まで何体か育てられるぶんの素材（結晶8・核3・筋肉玉1で★1→★3が1体）
      {
        id: 'startMaterials',
        label: 'スタートダッシュ 素材セット',
        reward: { stones: 16, cores: 9, balls: 5, coins: 1000 },
      },
    ] as { id: string; label: string; reward: Reward; boosters?: BoosterKey[] }[],
  },
  // 無料ガチャのイベント：その日のうちに、好きなガチャで引ける（トク玉もオーブも減らない）
  events: {
    freePulls: [
      { id: 'thursday', label: '木曜の無料5連', pulls: 5, weekday: 4 },
      { id: 'monthStart', label: '月初めの無料10連', pulls: 10, monthDay: 1 },
      { id: 'monthMid', label: '15日の激レア確定ガチャ', pulls: 1, monthDay: 15, guaranteed: true },
    ] as FreePullEvent[],
  },
  // ブースター：回数制の道具。使うと次の1回（EXPは次の数セット）だけ効く。期限なし
  // coinPrice：ショップで買う値段（進化コインだけ。オーブはガチャに回す）
  boosters: {
    habit: { icon: '🧘', label: 'ブースター', coinPrice: 100, text: '次の記録のオーブが2倍、その日の上限もなし' },
    exp: { icon: '💪', label: '筋トレブースター', coinPrice: 150, text: '次の10セットのEXPが2倍', sets: 10 },
    quest: { icon: '⚔️', label: '討伐ブースター', coinPrice: 150, text: '次の降臨の宝箱の中身（素材クエストは落ちる素材）が2倍' },
  },
  // 試練の塔：毎月 openDays の日だけ開催。下から1階ずつ挑戦し、各階の報酬は月に1回だけ
  tower: {
    openDays: [1, 10] as [number, number],
    // 1〜10階：超絶・超究極のボスを、炎・水・木・光・闇の順に2周（図鑑の番号順）。11階：塔限定モンスターがボス
    floors: 11,
    elementOrder: ['fire', 'water', 'wood', 'light', 'dark'] as const,
    // HP：1回のトレーニングで与えるダメージの目安に対する倍率
    hpRatio: [0.6, 0.8, 1.0, 1.2, 1.4, 1.7, 2.0, 2.3, 2.7, 3.2, 3.6],
    gold: [10, 12, 15, 18, 22, 26, 30, 35, 40, 50, 60], // オーブ（進化コインはこの coins.perOrb 倍）。1つの塔で月に約300
    eggs: { 2: 1, 4: 1, 7: 1, 8: 1 } as Record<number, number>, // その階でトク玉
    cores: {} as Record<number, number>, // その階でボスの部位の核
    boosters: { 3: 'habit', 6: 'exp', 9: 'quest' } as Record<number, 'habit' | 'exp' | 'quest'>, // その階でブースター
    sticks: { 5: 1, 10: 1 } as Record<number, number>, // その階でワクワクステッキ
    monsterFloors: [11], // 塔限定モンスターがボスになり、倒すともらえる階
    patternShift: 3, // 月のパターンが1つ進むごとに、1〜10階のボスの並びをこれだけずらす（属性もボスも入れ替わる）
    eggsInsteadOfMonster: 2, // 塔限定モンスターが登録されていないときはトク玉
    elementReqFrom: 3, // この階から「適正の属性」の編成条件
    abilityReqFrom: 6, // この階からアビリティの編成条件
    partReqFrom: 6, // この階から「ボスと同じ部位の子」の編成条件
    twoWeakFrom: 6, // この階から弱点種目が2つ
    kyukyokuFrom: 4, // この階から究極
    chozetsuFrom: 8, // この階から超絶（適正の属性以外は半減）
  },

  // 零の孤城：エンドコンテンツ。全11階を下から1階ずつ、報酬は各階、月に1回
  // 1〜10階：爆絶のボス（爆絶級の降臨）を炎・水・木・光・闇の順に2周。11階：城主級の降臨が零属性の城主になる
  castle: {
    openDays: [21, 31] as [number, number], // 毎月21日〜月末。各階の報酬は月に1回
    // 各階は3バトル（quest.battles）。出撃は1回で、その日に削った分だけ突破する。突破したバトルぶんの報酬をもらえる
    battlesToNext: 2, // この数のバトルを突破すると、次の階が開く（最上階は1〜10階を全部突破してから）
    floors: 11,
    elementOrder: ['fire', 'water', 'wood', 'light', 'dark'] as const,
    // 1回のトレーニングで与えるダメージの目安に対する倍率。全員★4・条件全部の理想の編成（目安の8〜12倍削れる）で、
    // 上の階がぎりぎり1日で倒せるくらい。手持ちでは1バトルずつ突破していく
    hpRatio: [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 12],
    // 孤城はオーブ少なめ・激レアアイテム祭り（月にオーブ約150・トク玉30）
    gold: [8, 8, 10, 10, 12, 12, 14, 16, 18, 20, 22], // オーブ（進化コインは coins.perOrb 倍）
    eggs: { 2: 2, 4: 3, 6: 3, 8: 4, 10: 6, 11: 12 } as Record<number, number>, // トク玉
    boosterPacks: {
      5: ['habit', 'exp', 'quest'],
      9: ['habit', 'exp', 'quest', 'exp', 'quest'],
    } as Record<number, BoosterKey[]>, // ブースター詰め合わせ
    sticks: { 3: 1, 7: 1, 11: 2 } as Record<number, number>, // ワクワクステッキ
    customs: { 4: 'atk2', 6: 'atk3', 8: 'fav', 10: 'atk3' } as Record<number, string>, // カスタマイズアイテム
    eggsInsteadOfBoss: 10, // 城主級の降臨が登録されていないときは、11階でトク玉
    elementNeed: 4, // 1〜10階の有利な属性の数（爆絶のふつうは5）
    kindsNeed: 3, // 1〜10階の「属性の種類」（有利な属性だけでは1種類。2属性のモンスターで増える）
  },

  // 禁筋の獄：塔と孤城のあいだの高難度。毎月11〜20日、全10階を下から1階ずつ、各階の報酬は月に1回。ボスは落とさない
  // 報酬はオーブ多め（月に約400）＋ちょいレア（筋肉玉・銀のカスタマイズアイテム・ステッキ）
  kinkin: {
    openDays: [11, 20] as [number, number],
    floors: 10,
    bakuzetsuFrom: 6, // この階から爆絶（それまでは超絶）
    hpRatio: [3.5, 4, 4.5, 5, 5.5, 5.5, 6, 6.5, 7, 7.5], // 孤城よりやさしく、理想の編成なら全部1日で倒せる
    gold: [24, 28, 32, 36, 40, 40, 44, 48, 52, 56],
    balls: { 3: 1, 5: 2, 8: 2, 10: 3 } as Record<number, number>, // 筋肉玉
    customs: { 2: 'atk2', 4: 'fav', 6: 'atk2', 8: 'fav', 10: 'atk2' } as Record<number, string>, // 銀のカスタマイズアイテム
    sticks: { 5: 1, 10: 1 } as Record<number, number>,
  },

  // 編成：クエストの条件（炎が3、バリアブレイカーが3…）を出撃する6体の合計で満たす
  // 編成倍率 = base ＋（1 − base）× そろい具合 ＋ 条件を超えた数 × perExtra（上限 max）
  // 何もそろっていないと ×0.4、ちょうどそろうと ×1.0（普通にその日のメニューをやれば倒せる）
  formation: {
    base: 0.4,
    perExtra: 0.15,
    max: 2.5,
    maxRequirements: 6,
    elementIcon: { fire: '🔥', water: '💧', wood: '🌿', light: '✨', dark: '🌑' },
  },

  // 合体：最終形態に、同じモンスターか同じ属性のモンスター（段階は問わない）を食べさせると＋が上がる。＋が上がるほど枠が豪華になる
  // ＋ごとに、本体の属性のEXPを注いでゲージを満タンにしてから、ゴールドを払って食べさせる
  fusion: {
    maxPlus: 5,
    // 素材：同じ属性の別のモンスターで＋1（同じモンスターは運のほうに食べさせる）
    gain: { sameElement: 1 },
    costs: [
      { exp: 100, coins: 100 }, // ＋0→＋1
      { exp: 200, coins: 200 },
      { exp: 300, coins: 300 },
      { exp: 400, coins: 400 },
      { exp: 500, coins: 500 }, // ＋4→＋5
    ],
  },

  // コンテンツの寿命の目安（開発者メニュー）：零の孤城の全階が、最強の6体で1日ぶんのメニューで倒せる（easyRatio 以上）まで、
  // 激レアをあと何体足せばよいか。pool：1階あたりに見る候補の数（計算を軽くする）、maxAdds：数える上限、runs：「目安」を何通り試すか
  lifespan: {
    easyRatio: 1,
    pool: 30,
    maxAdds: 128,
    runs: 3,
  },

  // 降臨の宝箱：1周で base 個＋出撃した運極1体ごとに perLuckMax 個。1箱ごとに bossRate でボス（運1）、残りは均等に
  // amounts：ボス以外の1箱の中身（low＝究極以下、high＝超絶以上。high だけ筋肉玉も出る）
  // 神化素材のボスは、1箱で shinkaBodies 体・1体あたり運 shinkaLuck
  boxes: {
    base: 5,
    perLuckMax: 3,
    bossRate: 0.8,
    amounts: {
      low: { stone: 2, exp: 30, coins: 100, ball: 0 },
      high: { stone: 3, exp: 60, coins: 200, ball: 1 },
    },
    shinkaBodies: [1, 3] as [number, number],
    shinkaLuck: [1, 3] as [number, number],
  },

  // 運：同じモンスターを食べさせると、食べさせた子の運がそのまま足される（タダ）。最大99で「運極」
  // 運極のモンスターを出撃させると、1体につきクエスト報酬のオーブが増え、素材クエストのくじも増える
  // 降臨の運極：運極なしで25勝くらい（週4回で1か月半）、運極4体で出撃すると13勝くらい（3週間）
  luck: {
    max: 99,
    gachaStart: 10, // ガチャから出た子は運10（10体当てれば運極）
    questDrop: 4, // クエストで落ちたボスの運
    prizeDrop: 33, // 試練の塔の塔限定の子・零の孤城の城主の運（月に1回なので、3か月で運極）
    perLuckMax: 1, // 出撃した運極1体ごとに、落ちたボスの運がさらに＋1
    perLuckMaxCap: 4, // ↑はここまで
    maxReward: { quest: 10, gacha: 5 }, // 運極ができたときのトク玉（降臨の子・ガチャの子）
    goldBonus: 0.2, // 運極1体につき報酬のオーブ +20%（宝箱は boxes.perLuckMax 個増える）
  },

  // ジョグレス：レシピの2体を＋5（最終形態）まで育てて合わせると、隠しモンスターが生まれる
  jogress: {
    coins: 600, // 進化コイン
    balls: 2, // 筋肉玉
    stones: 10, // 素材2体の属性の結晶（それぞれ）
    superRareBonus: 1500, // 素材の激レア1体につき、攻撃力の上乗せ
  },

  // 進化素材：素材クエストは宝箱（降臨と同じ数：基本5個＋出撃した運極1体ごとに3個）。
  // 1箱ごとに rate でその素材（amount 個）、はずれの箱にも進化コインかEXP（consolation）が入っている
  // 目安：★1→★3 に結晶8・核3・筋肉玉1。究極を回せれば4回くらい、運極がそろうと2回くらいで1体ぶん
  materials: {
    hpRatio: 0.5, // 素材クエストのHPは、ボスクエストのこの割合（× 難易度の hpRatio）
    drops: {
      stone: {
        easy: { rate: 0.3, amount: 1 },
        normal: { rate: 0.6, amount: 1 },
        hard: { rate: 0.5, amount: 2 },
      },
      muscle: {
        easy: { rate: 0.2, amount: 1 },
        normal: { rate: 0.33, amount: 1 },
        hard: { rate: 0.65, amount: 1 },
      },
      ball: {
        easy: { rate: 0.03, amount: 1 },
        normal: { rate: 0.07, amount: 1 },
        hard: { rate: 0.16, amount: 1 },
      },
      coins: {
        easy: { rate: 0.4, amount: 30 },
        normal: { rate: 0.55, amount: 60 },
        hard: { rate: 0.7, amount: 100 },
      },
    },
    consolation: { coins: 20, exp: 10 }, // はずれの箱の中身（進化コインかEXP）
    ballPityMisses: 5, // 筋肉玉がこの回数続けて落ちなかったら、次は必ず1個
    // ボスクエストのおまけ：ボスの属性の結晶
    bossBonus: { rolls: 2, rate: 0.5, amount: 1 },
    // 余った素材はトク玉と交換できる（筋肉玉はできない）
    eggExchange: { stone: 20, muscle: 10 }, // この数でトク玉1個
  },

  // 神殿：カスタマイズアイテムが落ちる。5属性ぶんあって、難易度は「時の間」と「修羅場」の2つ（修羅場ほど、よいアイテムが出やすい）
  // アイテムは1体に1つだけ付けられる（カスタマイズ枠）。付け直すと前のは消える（ワクワクステッキを使うと持ち物に戻る）
  temple: {
    labels: { normal: '時の間', hard: '修羅場' } as Record<'normal' | 'hard', string>,
    // くじ：rolls 回、1回ごとに rate で1個。運極1体ごとに luckRate のくじが1回増える
    drops: {
      normal: { rolls: 1, rate: 1, amount: 1 },
      hard: { rolls: 2, rate: 0.75, amount: 1 },
    },
    luckRate: 0.3,
    // 銅・銀・金の出やすさ
    rarity: {
      normal: [0.6, 0.35, 0.05],
      hard: [0.3, 0.5, 0.2],
    },
    attack: [500, 1000, 2000], // 攻撃力アップ（銅・銀・金）
    silverFavorite: 0.3, // 銀のうち「得意種目の追加」の割合（残りは攻撃力）
    goldAbility: 0.5, // 金のうち「アビリティの追加」の割合（残りは攻撃力）
  },

  // 進化コスト（上から 1→2, 2→3, 3→4, 4→5）
  // 1体をじっくりより、たくさん育てる：その部位の日のトレーニング1回（約180EXP）で★1→★3まで届く
  // stones：そのモンスターの属性の結晶、muscle：進化先の部位の核、balls：筋肉玉（★2→★3に必ず要る）
  evolutionCosts: [
    { exp: 40, coins: 30, stones: 2, muscle: 0, balls: 0 },
    { exp: 120, coins: 60, stones: 6, muscle: 3, balls: 1 },
    { exp: 1200, coins: 750, stones: 15, muscle: 8, balls: 2 },
    { exp: 2500, coins: 1500, stones: 25, muscle: 12, balls: 3 },
  ],

  // 画像の圧縮
  image: {
    maxSidePx: 512,
    targetBytes: 100_000,
    bannerMaxSidePx: 1024, // ガチャのバナー画像
  },

  // ガチャ：いくつでも作れる。モンスターは最大3つのガチャに入れられる
  gacha: {
    calendarDays: 35, // ショップの開催予定で見せる日数
    minOpen: 2, // 開発側：いつでもこの数の期間限定ガチャが開いているように（足りない日をガチャの管理で知らせる）
    planDays: 60, // ↑を確かめる日数
    maxPerMonster: 3,
    minPickups: 3,
    bannerMonsters: 5, // 自動バナーに出すモンスターの数（優先度の上位から）
    // 自動バナーのテーマ色
    themes: {
      flame: '炎',
      ocean: '海',
      forest: '森',
      royal: '王',
      night: '夜',
    }, // 作ったガチャは、レア以上（ピックアップ）がこの数そろうとショップで引ける
    defaultId: 'default', // どのガチャにも入れていないモンスターが入るガチャ（消せない）
    defaultName: 'いつものガチャ',
    // レア度ごとの確率（合計1）。同じレア度のモンスターで山分けする
    // ハズレとノーマルはどのガチャからも出る。激レアはそのガチャ限定（ガチャの「顔」）
    // レア度（モンストと同じ確率）：ノーマル88%・レア8.4%・激レア3.6%。同じレア度のモンスターで山分けする
    // ノーマルとレアはどのガチャからも出る（コラボの子だけは、どのレア度でもそのコラボのガチャからだけ）。激レアはそのガチャ限定
    // maxStars：そのレア度の星の上限（激レアは獣神化で★4）
    rarities: {
      normal: { label: 'ノーマル', rate: 0.88, attackBonus: 0, everyGacha: true, maxStars: 2, hint: 'どのガチャからも出る。1→2で終わる軽いやつ' },
      rare: { label: 'レア', rate: 0.084, attackBonus: 2500, everyGacha: true, maxStars: 3, hint: 'どのガチャからも出る当たり。★3まで進化する' },
      superRare: {
        label: '激レア',
        rate: 0.036,
        attackBonus: 6000,
        everyGacha: false,
        maxStars: 3,
        hint: 'そのガチャ限定。獣神化で★4になる、いちばんかっこいいやつ',
      },
    } as Record<RarityKey, { label: string; rate: number; attackBonus: number; everyGacha: boolean; maxStars: number; hint: string }>,
    // ホシ玉：ガチャでノーマルが累計 normals 回出るたびに1個。引くとレア以上が確定（激レア superRareRate、残りはレア）
    hoshi: { normals: 50, superRareRate: 0.4 },
    // 星は進化形態だけで決まる（レア度は関係ない）：1段目が★1、進化するたびに1つ増える（最大 maxStars）
    // ジョグレスの隠しモンスターは、レシピで決めた「生まれるときの星」から（決めていなければ jogressDefaultBirth）
    // レア度は星には出さず、攻撃力の上乗せ（attackBonus）にだけ効く。ジョグレスは jogressAttackBonus
    formStarBase: 0,
    maxStars: 4, // 星はここまで（ジョグレスの★4が最上位）
    jogressDefaultBirth: 4,
    jogressBirthChoices: [3, 4],
    jogressAttackBonus: 4500,
    fixedStarsDefault: 3, // 進化しない降臨モンスターの星（★1〜★3で選べる）
    fixedStarsChoices: [1, 2, 3],
    shinyRateChoices: [1 / 50, 1 / 20, 1 / 10, 1 / 5], // ガチャごとに選べる色違いの確率
  },

  // 種目ごとの回数範囲 [下限, 上限]。下限 null は「上限だけ決まっている自重種目」
  repRanges: {
    // 胸腕
    pushup: [null, 20],
    pushupBar: [null, 20],
    pushupFeetUp: [null, 20],
    pushupOneLeg: [null, 15],
    floorPress: [8, 15],
    floorPressSlow: [8, 15],
    floorPressClose: [8, 15],
    floorPressOneArm: [8, 15],
    fly: [10, 15],
    flySlow: [10, 15],
    squeezePress: [10, 15],
    curl: [8, 15],
    hammerCurl: [8, 15],
    curlSlow: [8, 15],
    concentrationCurl: [8, 15],
    ohExtension: [10, 15],
    ohExtensionOneArm: [10, 15],
    lyingExtension: [10, 15],
    kickback: [10, 15],
    kickbackPause: [10, 15],
    // 脚
    bulgarian: [8, 15],
    bulgarianSlow: [8, 15],
    reverseLunge: [8, 15],
    gobletSlow: [8, 15],
    goblet: [8, 15],
    gobletPause: [8, 15],
    hipLift: [12, 20],
    hipLiftFeetUp: [12, 20],
    hipLiftOneLeg: [8, 15],
    rdl: [8, 15],
    rdlOneLeg: [8, 15],
    calfOneLeg: [12, 20],
    calfBoth: [12, 20],
    calfOneLegStep: [12, 20],
    // 背肩
    oneHandRow: [8, 15],
    oneHandRowPause: [8, 15],
    wideRow: [8, 15],
    wideRowPause: [8, 15],
    seatedRearRaise: [12, 20],
    seatedRearRaisePause: [12, 20],
    sideLyingReverseFly: [12, 20],
    sideLyingReverseFlyPause: [12, 20],
    bentOverRow: [8, 15],
    bentOverRowReverse: [8, 15],
    reverseFly: [12, 20],
    reverseFlyPause: [12, 20],
    shoulderPress: [8, 15],
    arnoldPress: [8, 15],
    shoulderPressOneArm: [8, 15],
    sideRaise: [12, 20],
    sideRaiseSlow: [12, 20],
    frontRaise: [12, 20],
    // 全身枠：体幹（プランクは秒）
    abKnee: [null, 15],
    abWall: [null, 15],
    abKneeFull: [null, 15],
    abStanding: [null, 10],
    plank: [30, 90],
    plankLegUp: [30, 60],
    sidePlank: [20, 60],
    // 全身枠：全身
    squatThrust: [null, 15],
    burpee: [null, 12],
    mountainClimber: [10, 20],
  } as Record<string, [number | null, number]>,
}
