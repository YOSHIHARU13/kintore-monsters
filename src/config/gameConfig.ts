import type { Reward } from '../lib/missions'
import type { BoosterKey, RarityKey } from '../types'
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
    // 2周目：基本セットを終えた種目は、同じ週にもう基本セット数まで追加でやれる（EXPはこの割合）
    // 1部位あたり週10〜20セットまでは、セットを増やすほど筋肉が育ちやすい。それ以上は回復が追いつかないので2周まで
    extraRounds: 1,
    extraExpRatio: 0.5,
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
  },

  // 筋トレ1セットのEXP
  exp: {
    normal: 10,
    keep: 12,
    beat: 15,
  },

  // 腹筋ローラー（ボーナス枠）。1日3セットまで（日付が変わるとまた3セットできる）
  bonus: {
    goldPerSet: 2, // オーブ
    anyExpPerSet: 10, // 万能EXP：どの属性の進化にも注げる
  },

  // 朝の記録（前日の歩数）と、習慣（その場で記録）
  morning: {
    stepsPerGold: 1000, // この歩数ごとに1オーブ（段階なし。5000歩で5オーブ＝ガチャ1回）
    maxSteps: 100_000, // 入力できる歩数の上限
    habitGold: 5, // 習慣ができた日のオーブ（○×で記録するとき）
    // 習慣を分数で記録するときの、1分あたりのオーブ（端数は切り捨て）。1回に続けた分数が長いほど高い（5分で5オーブ＝ガチャ1回）
    habitRates: [
      { from: 1, perMinute: 0.5 },
      { from: 5, perMinute: 1 },
    ],
    habitMaxMinutes: 30, // 分数で記録するとき、オーブが出るのは1日の合計でこの分数まで
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
    // 選べるのは4種類だけ（多すぎると分かりにくいので）
    defaults: {
      バリア: 'アーク',
      シールド: 'ノヴァ',
      リジェネ: 'パルス',
      ミラー: 'ルーン',
    } as Record<string, string>,
    // 以前あったもの（選べないが、付けてあるモンスターやクエストの表示用に名前だけ残す）
    legacy: {
      フィールド: 'フィールドジャマー',
      フォース: 'フォースキャンセラー',
      ウォール: 'ウォールバスター',
      オーラ: 'オーライーター',
    } as Record<string, string>,
    // 持てるアビリティの数（レア度の格）。ジョグレスは jogress
    slots: { hazure: 0, normal: 1, uncommon: 1, superRare: 2, jogress: 3 },
    // 降臨（クエスト限定）のレア度は「どの格のボスか」：ハズレ＝上級、ノーマル＝極・究極、レア＝超絶・超究極、激レア＝爆絶・零の孤城の城主
    questSlots: { hazure: 0, normal: 1, uncommon: 2, superRare: 3 } as Record<RarityKey, number>,
  },

  // クエスト：出撃したら、その日のうちに倒す勝負。出撃してからのセットがそのままダメージになる（何回でも挑戦できる）
  // ダメージになるのは報酬が出るセットだけ（各種目は週に2周まで、ローラーは1日3セットまで）
  quest: {
    // 1回ぶんのダメージ = 基本値 × 攻撃するモンスターの攻撃力 ÷ attackUnit × 補正
    attackUnit: 3000,
    setDamage: 2.5, // 筋トレ1セット（全員が攻撃。セットの部位と一致するモンスターは × partMatch）
    partMatch: 2,
    rollerDamage: 4, // 腹筋ローラー1セット（全員で攻撃）
    weakSlot: 2, // ボスの弱点種目のセット（ボスの部位の補正にさらに掛かる）
    bossPart: 1.3, // ボスの部位（胸腕・脚・背肩）の種目のセットは、どれでもこの倍率。中でも弱点種目がいちばん効く
    offElementChozetsu: 0.5, // 超絶では、ボスの属性に有利な属性を持たないモンスターの攻撃はこの倍率
    offElementBakuzetsu: 1 / 3, // 爆絶ではこの倍率
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
      // gold はオーブ（進化コインはその coins.perOrb 倍）
      jokyu: { label: '上級', hpRatio: 0.45, gold: 5, plus: 0 }, // 育ちきっていなくても倒せる入門
      kiwami: { label: '極', hpRatio: 0.9, gold: 8, plus: 0 },
      kyukyoku: { label: '究極', hpRatio: 1.5, gold: 15, plus: 0 },
      chozetsu: { label: '超絶', hpRatio: 2.5, gold: 30, plus: 1 },
      chokyukyoku: { label: '超究極', hpRatio: 2.5, gold: 30, plus: 1 },
      bakuzetsu: { label: '爆絶', hpRatio: 3.5, gold: 50, plus: 1 }, // 超絶の上。孤城の1〜10階のボス // 主にコラボ用（因縁の強敵など、たまの例外にも）。強さと報酬は超絶と同じ
    },
    // 素材クエストの難易度：HPは「1回のトレーニングで与えるダメージの目安 × materials.hpRatio × hpRatio」
    // 上の難易度ほど編成の条件がきつくなるが、セットあたりのドロップは多くなる（そろえられるなら上を回るほうが得）
    difficulties: {
      easy: { label: '初級', plus: 0, gold: 3, hpRatio: 0.8 },
      normal: { label: '上級', plus: 1, gold: 6, hpRatio: 1.4 },
      hard: { label: '究極', plus: 2, gold: 10, hpRatio: 2 },
    },
    partySize: 6, // 出撃できる数
  },
  // おまかせのクエスト：基本は「弱点属性＋アビリティの持ち物検査」。格が上がるほど、どちらも増える
  // element：ボスに有利な属性の数、kinds：零属性のボスのときに求める属性の種類（ジョグレスの2属性は2種類）
  // abilities：アビリティの種類、abilityCount：1種類あたりの数（1体1つずつでよい。単アビの子も連れて行ける）
  // combo：1体で2つ同時に持つ子の数、weak：弱点種目の数
  // コラボのボスだけは、同じコラボの子が活躍する条件にする（超究極など）
  questAuto: {
    jokyu: { element: 2, kinds: 3, abilities: 0, abilityCount: 0, combo: 0, weak: 1 },
    kiwami: { element: 3, kinds: 3, abilities: 1, abilityCount: 2, combo: 0, weak: 1 },
    kyukyoku: { element: 3, kinds: 4, abilities: 1, abilityCount: 3, combo: 0, weak: 1 },
    chozetsu: { element: 4, kinds: 5, abilities: 2, abilityCount: 3, combo: 0, weak: 2 },
    bakuzetsu: { element: 5, kinds: 5, abilities: 3, abilityCount: 3, combo: 2, weak: 2 },
    chokyukyoku: { element: 4, kinds: 5, abilities: 2, abilityCount: 3, combo: 0, weak: 2 },
    // 素材クエストは難易度ごと（初級はほぼ縛りなし、究極でやっとアビリティ）
    material: {
      easy: { element: 0, kinds: 0, abilities: 0, abilityCount: 0, combo: 0, weak: 1 },
      normal: { element: 2, kinds: 3, abilities: 0, abilityCount: 0, combo: 0, weak: 1 },
      hard: { element: 3, kinds: 4, abilities: 1, abilityCount: 2, combo: 0, weak: 2 },
    },
  },
  // 神化：最終形態のガチャの激レアが、降臨モンスター1体（同じ属性）を素材に★4になる
  shinka: {
    coins: 300,
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
  boosters: {
    habit: { icon: '🧘', label: 'ブースター', price: 15, text: '次の記録のオーブが2倍、その日の上限もなし' },
    exp: { icon: '💪', label: '筋トレブースター', price: 30, text: '次の10セットのEXPが2倍', sets: 10 },
    quest: { icon: '⚔️', label: '討伐ブースター', price: 25, text: '次のクエスト報酬（オーブ・コイン・素材）が2倍' },
  },
  // 試練の塔：毎月10階を自動で作る。下から1階ずつ挑戦し、各階の報酬は月に1回だけ
  tower: {
    // 1〜10階：超絶・超究極のボスを、炎・水・木・光・闇の順に2周（図鑑の番号順）。11階：塔限定モンスターがボス
    floors: 11,
    elementOrder: ['fire', 'water', 'wood', 'light', 'dark'] as const,
    // HP：1回のトレーニングで与えるダメージの目安に対する倍率
    hpRatio: [0.6, 0.8, 1.0, 1.2, 1.4, 1.7, 2.0, 2.3, 2.7, 3.2, 3.6],
    gold: [10, 12, 15, 18, 22, 26, 30, 35, 40, 50, 60], // オーブ（進化コインはこの coins.perOrb 倍）
    eggs: { 2: 1, 4: 1, 7: 1, 8: 1 } as Record<number, number>, // その階でトク玉
    cores: {} as Record<number, number>, // その階でボスの部位の核
    boosters: { 3: 'habit', 6: 'exp', 9: 'quest' } as Record<number, 'habit' | 'exp' | 'quest'>, // その階でブースター
    sticks: { 5: 1, 10: 1 } as Record<number, number>, // その階でワクワクステッキ
    monsterFloors: [11], // 塔限定モンスターがボスになり、倒すともらえる階
    eggsInsteadOfMonster: 2, // 塔限定モンスターが登録されていないときはトク玉
    elementReqFrom: 3, // この階から「適正の属性」の編成条件
    abilityReqFrom: 6, // この階からアビリティの編成条件
    twoWeakFrom: 6, // この階から弱点種目が2つ
    kyukyokuFrom: 4, // この階から究極
    chozetsuFrom: 8, // この階から超絶（適正の属性以外は半減）
  },

  // 零の孤城：エンドコンテンツ。全11階を下から1階ずつ、報酬は各階1回だけ（作り直しはしない）
  // 1〜10階：爆絶のボス（爆絶級の降臨）を炎・水・木・光・闇の順に2周。11階：城主級の降臨が零属性の城主になる
  castle: {
    floors: 11,
    elementOrder: ['fire', 'water', 'wood', 'light', 'dark'] as const,
    hpRatio: [3, 3.2, 3.4, 3.6, 3.8, 4, 4.3, 4.6, 5, 5.5, 6.5], // 1回のトレーニングで与えるダメージの目安に対する倍率
    gold: [30, 30, 35, 35, 40, 40, 45, 50, 55, 60, 100], // オーブ（進化コインは coins.perOrb 倍）
    eggs: { 1: 3, 2: 3, 4: 5, 6: 5, 8: 5, 10: 10, 11: 30 } as Record<number, number>, // トク玉
    boosterPacks: {
      5: ['habit', 'exp', 'quest'],
      9: ['habit', 'exp', 'quest', 'exp', 'quest'],
    } as Record<number, BoosterKey[]>, // ブースター詰め合わせ
    sticks: { 3: 1, 7: 1, 11: 2 } as Record<number, number>, // ワクワクステッキ
    customs: { 4: 'atk2', 6: 'atk3', 8: 'fav', 10: 'atk3' } as Record<number, string>, // カスタマイズアイテム
    eggsInsteadOfBoss: 10, // 城主級の降臨が登録されていないときは、11階でトク玉
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

  // 運：同じモンスターを食べさせると、食べさせた子の運がそのまま足される（タダ）。最大99で「運極」
  // 運極のモンスターを出撃させると、1体につきクエスト報酬のオーブが増え、素材クエストのくじも増える
  // 降臨の運極：運極なしで25勝くらい（週4回で1か月半）、運極4体で出撃すると13勝くらい（3週間）
  luck: {
    max: 99,
    gachaStart: 10, // ガチャから出た子は運10（10体当てれば運極）
    questDrop: 4, // クエスト・試練の塔で落ちたボスの運
    perLuckMax: 1, // 出撃した運極1体ごとに、落ちたボスの運がさらに＋1
    perLuckMaxCap: 4, // ↑はここまで
    maxReward: { quest: 10, gacha: 5 }, // 運極ができたときのトク玉（降臨の子・ガチャの子）
    goldBonus: 0.2, // 運極1体につき報酬のオーブ +20%（素材のくじは materials.luckRolls）
  },

  // ジョグレス：レシピの2体を＋5（最終形態）まで育てて合わせると、隠しモンスターが生まれる
  jogress: {
    coins: 600, // 進化コイン
    balls: 2, // 筋肉玉
    stones: 10, // 素材2体の属性の結晶（それぞれ）
    superRareBonus: 1500, // 素材の激レア1体につき、攻撃力の上乗せ
  },

  // 進化素材：素材クエストで落ちる。毎回の抽選なので、落ちる数はばらつく（0個のときも、たくさんのときもある）
  // 抽選：rolls 回くじを引き、1回ごとに rate で当たり（当たり1回で amount 個）。運極が1体いるごとに、くじが luckRolls 回増える
  // 目安：★1→★3 に結晶8・核3・筋肉玉1。究極を回せれば4回くらい、運極がそろうと2回くらいで1体ぶん
  materials: {
    hpRatio: 0.5, // 素材クエストのHPは、ボスクエストのこの割合（× 難易度の hpRatio）
    luckRolls: 1,
    drops: {
      stone: {
        easy: { rolls: 3, rate: 0.5, amount: 1 },
        normal: { rolls: 5, rate: 0.6, amount: 1 },
        hard: { rolls: 7, rate: 0.7, amount: 1 },
      },
      muscle: {
        easy: { rolls: 2, rate: 0.45, amount: 1 },
        normal: { rolls: 3, rate: 0.55, amount: 1 },
        hard: { rolls: 5, rate: 0.65, amount: 1 },
      },
      ball: {
        easy: { rolls: 1, rate: 0.15, amount: 1 },
        normal: { rolls: 1, rate: 0.35, amount: 1 },
        hard: { rolls: 2, rate: 0.4, amount: 1 },
      },
      coins: {
        easy: { rolls: 3, rate: 0.7, amount: 30 },
        normal: { rolls: 4, rate: 0.7, amount: 60 },
        hard: { rolls: 5, rate: 0.7, amount: 100 },
      },
    },
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
    // uncommon（レア）：そのガチャの「中当たり」。当たりやすくて運極にしやすい、そこそこ強いやつ
    rarities: {
      hazure: { label: 'ハズレ', rate: 0.38, attackBonus: 0, everyGacha: true, hint: 'どのガチャからも出る。2段階で終わるような軽いやつ' },
      normal: { label: 'ノーマル', rate: 0.32, attackBonus: 1500, everyGacha: true, hint: 'どのガチャからも出る。3段階まで進化する普通のやつ' },
      uncommon: {
        label: 'レア',
        rate: 0.18,
        attackBonus: 3000,
        everyGacha: false,
        hint: 'そのガチャ限定の中当たり。当たりやすくて運極にしやすい、そこそこ強いやつ',
      },
      superRare: {
        label: '激レア',
        rate: 0.12,
        attackBonus: 4500,
        everyGacha: false,
        hint: 'そのガチャ限定。ジョグレスの素材になる、いちばんかっこいいやつ',
      },
    },
    questAttackBonus: { hazure: 0, normal: 1500, uncommon: 4500, superRare: 6000 } as Record<RarityKey, number>, // 降臨のレア度ごとの攻撃力の上乗せ
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
    // 天井：同じガチャで、激レアが出ないままこの回数目を引くと激レア確定
    pity: { rarity: 'superRare' as const, pulls: 30 },
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
    // ボーナス：腹筋ローラー
    abKnee: [null, 15],
    abWall: [null, 15],
    abKneeFull: [null, 15],
    abStanding: [null, 10],
  } as Record<string, [number | null, number]>,
}
