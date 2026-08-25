/* Dシステム改 - data.js
 * 2026年8月「草加 Lua」の実データ（観測ログ 01 より・1円一致の元）
 * 表示値は原則そのまま observed をseed。計算エンジンは 8/24 の実伝票で検証。
 */
(function (global) {
  "use strict";

  // ---- 店舗設定（計算パラメータ・確定値） ----
  const store = {
    registerFloat: 30000,   // 前日から繰り越す釣銭（レジ精算の理論値に使う）
    // 月次補正: キャスト調整額・月給・スタッフ月給・源泉徴収の合計。日別行には出ず月合計にだけ乗る
    // （観測ログ③151-153行。金額15,000は「給率33.45%」と「経費計1,217,589」の差から逆算して確定）
    monthlyAdjust: 15000,
    name: "草加 Lua",
    openHour: 16,                 // 営業日境界
    joshiClosingDay: 99,          // 女子報酬締め日（99=月末）
    reqBackAmount: 500,           // リクエストバック金額(¥/回)
    fieldBackAmount: 500,         // 場内リクエストバック金額
    dohanBackAmount: 2000,        // 同伴バック金額
    welfareRate: 0.10,            // 厚生費比率 10%
    // ---- 給率の決め方（本家と同じく店舗ごとに選べる）----
    // 既定は観測どおり: 分子=残り支給額+女子日払い / 分母=売上計
    // 分子 remainPlusFemaleDaily | remainOnly | laborTotal
    // 分母 salesTotal | honkei(リクエスト+同伴) | cash
    payRateNumerator: "remainPlusFemaleDaily",
    payRateDenominator: "salesTotal",
    // ---- 端数処理（round=四捨五入 / floor=切捨 / ceil=切上）既定は観測どおり四捨五入 ----
    rounding: "round",
    // ---- 折半の余り（false=本家と同じで配らない＝合計が1円ズレる / true=先頭に配る）----
    splitSpreadRemainder: false,
    // ---- 2部時給の開始時刻（空なら2部を使わない）----
    part2Hour: "",
    // ---- 指名バックの決め方（mode: fixed=1回いくら / rate=その区分売上の何%）----
    // キャスト個別に上書きできる（キャスト側が null なら、ここに従う）
    reqBack:   { mode: "fixed", value: 500 },
    fieldBack: { mode: "fixed", value: 500 },
    dohanBack: { mode: "fixed", value: 2000 },
    target: 3500000,              // 月間目標（デモ用・現場改善機能）
  };

  // ---- 用語辞書（本家の名称変更を反映：全UIはこれ経由で表示） ----
  const terms = {
    "本指名": "リクエスト", "場内指名": "場内リクエスト", "同伴": "同伴", "指名": "指名",
    "会計伝票": "お会計", "キャスト": "キャスト", "お客さま": "お客さま", "折半": "折半",
    "出戻り": "出戻り", "ドリンク": "ドリンク", "ボトル": "ボトル", "フード": "フード", "日払い": "日払い",
  };
  function t(k) { return terms[k] || k; }

  // ---- キャスト（源氏名/ID/属性/時給1部/時給2部/厚生費%/指名バック個別） ----
  const casts = [
    { id: 110, name: "べる☆",   attr: "normal",   wage1: 2100, wage2: 0, welfare: 10 },
    { id: 180, name: "しずく🌙", attr: "normal",   wage1: 2000, wage2: 0, welfare: 10 },
    { id: 213, name: "はるか🌻", attr: "dispatch", wage1: 2000, wage2: 0, welfare: 10 },
    { id: 238, name: "みずき☆", attr: "normal",   wage1: 1800, wage2: 0, welfare: 10 },
    { id: 131, name: "リリ☆",   attr: "normal",   wage1: 1900, wage2: 0, welfare: 10 },
    { id: 241, name: "りん🔔",   attr: "normal",   wage1: 1600, wage2: 0, welfare: 10 },
    { id: 187, name: "ゆき❄️",   attr: "normal",   wage1: 1800, wage2: 0, welfare: 10 },
    { id: 244, name: "りく🎣",   attr: "normal",   wage1: 1700, wage2: 0, welfare: 10 },
    { id: 245, name: "れん🌹",   attr: "normal",   wage1: 1600, wage2: 0, welfare: 10 },
    { id: 230, name: "らん🍖",   attr: "normal",   wage1: 1500, wage2: 0, welfare: 10 },
  ];

  // ---- スタッフ ----
  const staff = [
    { id: 1, name: "たかひろ", daily: 10000, welfare: 0, since: "2025-05" },
    { id: 2, name: "けんたろう", daily: 10000, welfare: 0, since: "2026-07" },
  ];

  // ---- 商品（単価・バック額は整数円で保持＝端数ズレ防止） ----
  // 本家の商品マスタ全40品（観測ログ330-343行）。active=false は本家で「未使用」の品。
  // ★実績あり(今月数量あり)の品は price/backAmt が観測値。未観測の品は price 0 = 未登録扱い。
  const products = [
    { no: 1,  name: "オリシャンコンプリート",          price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 2,  name: "【D】ランボルギーニ プラチナ",    price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 3,  name: "【D】ランボルギーニ イエロー",    price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 4,  name: "キャストドリンクS",               price: 1000,  backAmt: 200,  cat: "drink",     active: true  },
    { no: 5,  name: "キャストドリンク W",              price: 0,     backAmt: 0,    cat: "drink",     active: false },
    { no: 6,  name: "★キャストショット",               price: 2500,  backAmt: 500,  cat: "shot",      active: true  },
    { no: 7,  name: "ゲストドリンク",                  price: 0,     backAmt: 0,    cat: "drink",     active: false },
    { no: 8,  name: "栓抜きドリンク",                  price: 0,     backAmt: 0,    cat: "drink",     active: false },
    { no: 9,  name: "ピッチャー",                      price: 0,     backAmt: 0,    cat: "drink",     active: false },
    { no: 10, name: "テキーラショット各種",            price: 2000,  backAmt: 500,  cat: "shot",      active: true  },
    { no: 11, name: "テキーラボール",                  price: 0,     backAmt: 0,    cat: "shot",      active: false },
    { no: 12, name: "クライナー",                      price: 1500,  backAmt: 500,  cat: "shot",      active: true  },
    { no: 13, name: "コカレロ",                        price: 2500,  backAmt: 500,  cat: "shot",      active: true  },
    { no: 14, name: "フード500",                       price: 500,   backAmt: 31,   cat: "food",      active: false },
    { no: 15, name: "フード800",                       price: 800,   backAmt: 50,   cat: "food",      active: true  },
    { no: 16, name: "フード1000",                      price: 1000,  backAmt: 63,   cat: "food",      active: false },
    { no: 17, name: "フード1500",                      price: 1500,  backAmt: 94,   cat: "food",      active: false },
    { no: 18, name: "フード2000",                      price: 2000,  backAmt: 125,  cat: "food",      active: false },
    { no: 19, name: "フード2500",                      price: 2500,  backAmt: 156,  cat: "food",      active: false },
    { no: 20, name: "フード3000",                      price: 3000,  backAmt: 188,  cat: "food",      active: false },
    { no: 21, name: "ポンパ各種",                      price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 22, name: "ミニカフェパ各種",                price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 23, name: "カフェパ各種",                    price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 24, name: "カフェパ季節限定",                price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 25, name: "プラチナム各種",                  price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 26, name: "マバム各種",                      price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 27, name: "フェリスタス",                    price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 28, name: "クワトロカヴァ",                  price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 29, name: "モエ白",                          price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 30, name: "モエロゼ",                        price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 31, name: "モエN.I.R",                       price: 35000, backAmt: 4000, cat: "champagne", active: true  },
    { no: 32, name: "モエネクター",                    price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 33, name: "モエアイスアンペリア",            price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 34, name: "ヴーヴ白",                        price: 28000, backAmt: 4000, cat: "champagne", active: true  },
    { no: 35, name: "ヴーヴイエロー",                  price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 36, name: "ヴーヴロゼ",                      price: 30000, backAmt: 4000, cat: "champagne", active: true  },
    { no: 37, name: "ベルエポック",                    price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 38, name: "クリュグ白",                      price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 39, name: "ベルエポックロゼ",                price: 0,     backAmt: 0,    cat: "champagne", active: false },
    { no: 40, name: "エンジェル",                      price: 0,     backAmt: 0,    cat: "champagne", active: false },
    // 商品別集計に実績として現れるが40品リストに番号が無い品（観測ログ266行）
    { no: 41, name: "ジャックダニエル",                price: 0,     backAmt: 0,    cat: "bottle",    active: true  },
  ];

  // ---- 入出金項目 ----
  const costItems = [
    { id: 13528, name: "消耗品",       kind: "out_cash_gross" },
    { id: 13529, name: "酒代",         kind: "out_cash_gross" },
    { id: 13530, name: "諸経費",       kind: "out_cash_gross" },
    { id: 13531, name: "テナント",     kind: "out_cash_gross" },
    { id: 13532, name: "補償金",       kind: "out_cash_gross" },
    { id: 17547, name: "公共料金",     kind: "out_cash_gross" },
    { id: 17548, name: "紹介料",       kind: "out_cash_gross" },
    { id: 17549, name: "交際費",       kind: "out_cash_gross" },
    { id: 13533, name: "資本金",       kind: "in_cash_gross"  },
    { id: 65827, name: "カード前期入金", kind: "in_monthly"    },
  ];

  // ---- 給与項目 ----
  const feeItems = [
    { no: 1, name: "遅刻",   target: "common", kind: "minus"    },
    { no: 2, name: "欠勤",   target: "common", kind: "minus"    },
    { no: 3, name: "送迎",   target: "common", kind: "minus"    },
    { no: 4, name: "ボーナス", target: "common", kind: "bonus"   },
    { no: 5, name: "日払い", target: "common", kind: "dailypay" },
  ];

  // ---- タグ（集客担当） ----
  const tags = [
    { id: 1, name: "たかひろ", color: "#3fb950", hall: true },
    { id: 2, name: "よも",     color: "#79c0ff", hall: true },
    { id: 3, name: "けんたろう", color: "#8b949e", hall: true },
  ];

  // ---- 顧客属性(31) / カスタム項目(7) / ランク基準 ----
  const customerAttributes = ["新規","リピート","常連","休眠","優良顧客","太客候補","高単価","中単価","低単価","本指名安定","場内多め","フリー中心","担当固定","複数キャスト来店","紹介客","SNS流入","店前来店","イベント来店","イベント強い","誕生日月","LINE反応あり","DM反応あり","要フォロー","呼び戻し候補","売掛あり","未収注意","支払い安定","クレーム注意","キャスト相性注意","出禁","延長見込み高"];
  const customerFields = [
    { no:1, label:"あだ名", type:"text" }, { no:2, label:"紹介元", type:"text" },
    { no:3, label:"生年月日", type:"date" }, { no:4, label:"会社名", type:"text" },
    { no:5, label:"役職", type:"text" }, { no:6, label:"結婚しているか", type:"select" },
    { no:7, label:"電話番号", type:"phone" },
  ];
  const rankThresholds = { S:20, A:10, B:5, C:1 }; // 直近3ヶ月の来店回数
  const keepDefaultMonths = 3;

  // ---- 収支明細（2026年8月・全日） ----
  // 各行: [date, dow, holiday, cash, credit, card, salesTotal, reqSub, dohanSub,
  //        remainingPay, payRate, maleDaily, femaleDaily, bonus, minus, deposit, withdrawal, expenseTotal, grossProfit]
  const F = [
    ["2026-08-01","土",0, 262400,0, 77100, 339500, 283000,  8700,  80697,29.66, 10000,20000,0, 500,0,13300, 123997, 215503],
    ["2026-08-02","日",0,  59000,0, 12600,  71600,      0,     0,  20110,48.20, 14400,10000,0, 500,0,    0,  44510,  27090],
    ["2026-08-03","月",0, 102800,0,     0, 102800,  85600, 13900,  27580,31.69,     0, 5000,0,   0,0,  500,  33080,  69720],
    ["2026-08-04","火",0,  82700,0,     0,  82700,  57200, 57200,  22710,34.72, 11000, 5000,0,   0,0,    0,  38710,  43990],
    ["2026-08-05","水",0,  26900,0,100400, 127300, 106000,     0,  28200,33.94, 10000, 5000,0,   0,0,    0,  43200,  84100],
    ["2026-08-06","木",0,  19300,0,112200, 131500,  89800, 39900,  36915,34.23, 11100, 7000,0,   0,0,    0,  55015,  76485],
    ["2026-08-07","金",0, 107600,0,143500, 251100, 185300,     0,  64242,27.58, 10000, 5000,0, 500,0,13700,  92942, 158158],
    ["2026-08-08","土",0, 163400,0,254000, 417400, 291100, 51400, 110289,31.69, 10000,22000,0,1000,0, 8000, 150289, 267111],
    ["2026-08-09","日",0,  17400,0, 81200,  98600,  67600, 29600,  20957,33.42,     0,12000,0, 500,0,    0,  32957,  65643],
    ["2026-08-10","月",0,  27000,0,     0,  27000,      0,     0,   8247,67.58,     0,10000,0,   0,0,    0,  18247,   8753],
    ["2026-08-11","火",0, 123900,0,     0, 123900,  91800, 91800,  38048,36.36, 10000, 7000,0, 500,0,    0,  55048,  68852],
    ["2026-08-12","水",1,      0,0,     0,      0,      0,     0,      0,    0,     0,    0,0,   0,0,    0,      0,      0],
    ["2026-08-13","木",0,  65100,0,  7600,  72700,  47900, 27300,  22597,42.77, 11500, 7000,0, 500,0,    0,  41097,  31603],
    ["2026-08-14","金",0, 166700,0,  5400, 172100, 111100,111100,  42692,30.62, 10000,10000,0,5500,0,    0,  62692, 109408],
    ["2026-08-15","土",0, 200300,0, 57700, 258000, 140700,     0,  55357,28.05, 10000,17000,0,1000,0,    0,  82357, 175643],
    ["2026-08-16","日",0,  19700,0,  6000,  25700,  16300,     0,   7815,57.65, 10000, 7000,0, 500,0,    0,  24815,    885],
    ["2026-08-17","月",0,  15500,0, 63000,  78500,  65400,     0,  34315,39.89,     0, 7000,0, 500,0,    0,  41315,  37185],
    ["2026-08-18","火",1,      0,0,     0,      0,      0,     0,      0,    0,     0,    0,0,   0,0,    0,      0,      0],
    ["2026-08-19","水",0,      0,0, 99000,  99000,  82500, 82500,  31630,31.95, 10000,    0,0, 500,0,    0,  41630,  57370],
    ["2026-08-20","木",0,  18300,0,     0,  18300,   4700,     0,  10345,83.85, 10000, 5000,0,   0,0,    0,  25345,  -7045],
    ["2026-08-21","金",0,  61100,0,244300, 305400, 181400,     0,  80580,31.62, 16000,10000,0, 500,0,15800, 122380, 183020],
    ["2026-08-22","土",0, 172100,0, 14200, 186300, 123100, 48200,  48768,33.16, 11000,12000,0,1000,0,    0,  71768, 114532],
    ["2026-08-23","日",0,      0,0,     0,  11400,      0,     0,   8385,134.96,    0, 7000,0, 500,0,    0,  15385,  -3985],
    ["2026-08-24","月",0,      0,0,  7300,   7300,      0,     0,    810,11.10,     0,    0,0,   0,0,    0,    810,   6490],
    ["2026-08-25","火",1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["2026-08-26","水",1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["2026-08-27","木",1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["2026-08-28","金",1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["2026-08-29","土",1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["2026-08-30","日",1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["2026-08-31","月",1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];
  const financeDaily = F.map(function (r) {
    // 現金は定義上 売上計 − カード − 売掛（手入力ミスを避け自動導出）
    const cash = (r[6] || 0) - (r[5] || 0) - (r[4] || 0);
    return {
      date:r[0], dow:r[1], holiday:!!r[2],
      cash:cash, credit:r[4], card:r[5], salesTotal:r[6],
      reqSub:r[7], dohanSub:r[8],
      remainingPay:r[9], payRate:r[10],
      maleDaily:r[11], femaleDaily:r[12], bonus:r[13], minus:r[14],
      deposit:r[15], withdrawal:r[16], expenseTotal:r[17], grossProfit:r[18],
    };
  });

  // ---- まとめ画面の月間サマリ（観測値・そのまま表示で1円一致） ----
  const monthSummary = {
    ym: "2026-08",
    guests: 145, groups: 100,
    custAvg: 20746, groupAvg: 30081,
    joshiHonkei: 2472500, tagTarget: 148500,
    salesTotal: 3008100, cash: 1722600, credit: 0, card: 1285500,
    expenseTotal: 1217589, laborFemale: 1006289, laborMale: 160000, misc: 51300,
    deposit: 0, grossProfit: 1790511,
  };

  // ---- 商品集計（月間・キャスト別／観測値） ----
  // 商品別集計(日別ビュー)の月間正値 ＝ 日別グリッドの列合計の正。
  const itemTotals = { // 個数
    "キャストドリンクS":619, "テキーラショット各種":80, "クライナー":90, "コカレロ":61,
    "ジャックダニエル":3, "ヴーヴロゼ":2, "モエN.I.R":1, "フード800":7, "ヴーヴ白":2, "★キャストショット":1,
  };

  // ---- 商品別・日別集計（商品×日 クロス表・観測値）----
  // 列順: [CDS, テキーラ, クライナー, コカレロ, ジャックダニエル, ヴーヴロゼ, モエN.I.R, フード800, ヴーヴ白, ★ショット]
  const itemDailyCols = ["キャストドリンクS","テキーラショット各種","クライナー","コカレロ","ジャックダニエル","ヴーヴロゼ","モエN.I.R","フード800","ヴーヴ白","★キャストショット"];
  const itemDaily = {
    "2026-08-01":[79,7,2,0,0,0,0,0,0,0], "2026-08-02":[17,7,2,0,0,0,0,0,0,0],
    "2026-08-03":[22,7,0,4,0,0,0,0,0,0], "2026-08-04":[15,0,4,3,1,0,0,0,0,0],
    "2026-08-05":[20,0,0,6,0,1,0,0,0,0], "2026-08-06":[25,0,1,13,0,0,0,0,0,0],
    "2026-08-07":[39,11,1,4,0,0,1,1,0,0], "2026-08-08":[88,11,10,10,0,0,0,1,1,0],
    "2026-08-09":[19,5,6,0,0,0,0,0,0,0], "2026-08-10":[10,0,0,0,0,0,0,0,0,0],
    "2026-08-11":[28,6,8,0,0,0,0,0,0,0], "2026-08-13":[18,2,0,0,0,0,0,0,0,0],
    "2026-08-14":[40,7,2,4,1,0,0,0,0,0], "2026-08-15":[59,11,1,0,0,1,0,0,0,1],
    "2026-08-16":[8,0,2,0,0,0,0,0,0,0], "2026-08-17":[17,0,0,6,0,0,0,1,0,0],
    "2026-08-19":[14,0,30,0,0,0,0,0,0,0], "2026-08-20":[3,0,0,0,0,0,0,0,0,0],
    "2026-08-21":[58,1,20,11,1,0,0,4,0,0],
    // 22〜24（一部見切れのため観測分。合計は月間itemTotalsを正とする）
  };

  // ---- 8/24 リアルタイム（実伝票＋勤怠＝給与エンジン検証用） ----
  const day0824 = {
    date: "2026-08-24",
    // 伝票（会計）
    bills: [
      { no:1, uuid:"FD3BCA02-EA2F-4D81-9B72-3B1DE95A1C1A", in:"21:30", out:"22:20", table:1, guests:1,
        field:[{cast:"ゆき❄️", count:1, amount:1000}], req:[], dohan:[],
        cash:0, card:7300, credit:0, service:1800, settled:true },
      { no:2, uuid:"A1000000-0000-0000-0000-000000000002", in:"21:55", out:"00:25", table:3, guests:2,
        req:[{cast:"しずく🌙", count:3, amount:3600}], dohan:[{cast:"しずく🌙", count:1, amount:3000}], field:[],
        reqSub:34100, cash:41000, card:0, credit:0, settled:false },
      { no:3, uuid:"A1000000-0000-0000-0000-000000000003", in:"23:15", out:"00:05", table:1, guests:1,
        req:[{cast:"しずく🌙", count:1, amount:1200}], dohan:[], field:[],
        reqSub:5700, cash:6900, card:0, credit:0, settled:false },
    ],
    // 勤怠（開始/終了・当日の商品バック明細）＝リアルタイム勤怠報告の観測状態
    attendance: [
      { cast:"ゆき❄️", start:"21:00", end:null,
        drinks:[{name:"キャストドリンクS", qty:5}],
        field:{count:1}, req:{count:0}, dohan:{count:0}, bonus:0, minus:0, dailyPay:0 },
      { cast:"しずく🌙", start:"21:00", end:null,
        drinks:[{name:"キャストドリンクS", qty:5}],
        req:{count:4}, dohan:{count:1}, field:{count:0}, bonus:0, minus:0, dailyPay:0 },
      { cast:"りん🔔", start:"21:00", end:null,
        drinks:[{name:"キャストドリンクS", qty:3},{name:"クライナー", qty:1}],
        req:{count:0}, dohan:{count:0}, field:{count:0}, bonus:0, minus:0, dailyPay:0 },
    ],
    // 観測された正解（リアルタイム勤怠報告＝検証用の期待値）
    expected: {
      totalSales:55200, unsettled:47900, settled:7300, joshiPay:6840,
      pay: { "ゆき❄️":{back:1500, gross:1500, welfare:150, net:1350},
             "しずく🌙":{back:5000, gross:5000, welfare:500, net:4500},
             "りん🔔":{back:1100, gross:1100, welfare:110, net:990} },
    },
  };

  // ---- デモ顧客・キープ（顧客管理/キープ管理の画面用・架空）----
  const customers = [
    { no: 1, name: "田中 様", rank: "S", visits: 24, last: "2026-08-22", first: "2025-03-10", avg: 42000, main: "しずく🌙", attrs: ["常連", "太客候補", "高単価"], phone: "090-xxxx-1234" },
    { no: 2, name: "佐藤 様", rank: "A", visits: 12, last: "2026-08-20", first: "2025-07-02", avg: 28000, main: "べる☆", attrs: ["リピート", "本指名安定"], phone: "090-xxxx-5678" },
    { no: 3, name: "鈴木 様", rank: "B", visits: 6, last: "2026-08-15", first: "2026-02-18", avg: 19000, main: "はるか🌻", attrs: ["場内多め"], phone: "" },
    { no: 4, name: "高橋 様", rank: "C", visits: 3, last: "2026-08-08", first: "2026-06-30", avg: 15000, main: "ゆき❄️", attrs: ["新規", "呼び戻し候補"], phone: "" },
    { no: 5, name: "伊藤 様", rank: "D", visits: 0, last: "2026-05-01", first: "2025-01-12", avg: 12000, main: "", attrs: ["休眠", "要フォロー"], phone: "" },
  ];
  const keeps = [
    { product: "ヴーヴロゼ", price: 30000, remain: "1/2本", start: "2026-08-08", expire: "2026-11-08", customer: "田中 様", nameTag: "T.T", memo: "誕生日用" },
    { product: "モエN.I.R", price: 35000, remain: "満量", start: "2026-08-21", expire: "2026-11-21", customer: "佐藤 様", nameTag: "S", memo: "" },
    { product: "ジャックダニエル", price: 15000, remain: "残少", start: "2026-06-01", expire: "2026-09-01", customer: "鈴木 様", nameTag: "SUZUKI", memo: "期限間近" },
  ];

  global.DATA = {
    customers: customers, keeps: keeps,
    // 出荷時の値の写し。ユーザーが設定を変えても検算はこれで回す（誤って赤バーを出さないため）
    SEED: JSON.parse(JSON.stringify({ store: store, casts: casts })),
    store, terms, t, casts, staff, products, costItems, feeItems, tags,
    customerAttributes, customerFields, rankThresholds, keepDefaultMonths,
    financeDaily, monthSummary, itemTotals, itemDaily, itemDailyCols, day0824,
  };
})(typeof window !== "undefined" ? window : globalThis);
