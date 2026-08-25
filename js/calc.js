/* Dシステム改 - calc.js
 * 計算エンジン（本家と1円一致）。全式は 03_設計書 §3/§8 準拠。
 */
(function (global) {
  "use strict";
  const D = global.DATA;

  function productByName(name) {
    return D.products.find(function (p) { return p.name === name; });
  }

  // 商品バック（商品ごとに「1杯いくら」か「売価の何%」かを選べる。整数円で加算＝端数ドリフト防止）
  function drinkBack(drinks) {
    if (!drinks) return 0;
    return drinks.reduce(function (sum, d) {
      const p = productByName(d.name);
      if (!p) return sum;
      const qty = d.qty || 0;
      if (p.backMode === "rate") return sum + roundBy(p.price * qty * ((p.backRate || 0) / 100));
      return sum + (p.backAmt || 0) * qty;
    }, 0);
  }

  // ---- カスタマイズの土台 ----
  // 本家は店舗ごと・キャストごとに計算のしかたを変えられる。こちらも同じにする。
  // 決め方は必ず「キャスト個別 → 店舗の既定 → 出荷時の既定」の順。個別が null なら店舗に従う。
  function storeCfg() { return D.store || {}; }
  // 端数処理（店舗設定。既定は四捨五入＝本家の観測に一致）
  function roundBy(n, mode) {
    mode = mode || storeCfg().rounding || "round";
    if (mode === "floor") return Math.floor(n);
    if (mode === "ceil")  return Math.ceil(n);
    return Math.round(n);
  }
  // バックの決め方を1か所に集約。fixed=1回いくら / rate=売上の何%
  //   kind: "req" | "field" | "dohan"
  function backRule(cast, kind) {
    const s = storeCfg();
    const ov = (cast && cast.back && cast.back[kind]) || null;   // キャスト個別（null=店舗に従う）
    if (ov && ov.mode) return { mode: ov.mode, value: ov.value };
    const map = { req: "reqBack", field: "fieldBack", dohan: "dohanBack" };
    const amtKey = { req: "reqBackAmount", field: "fieldBackAmount", dohan: "dohanBackAmount" };
    const sd = s[map[kind]];
    // 金額だけの旧キー（設定画面・音声はこちらを更新する）が新しければ、そちらを正とする。
    // 二重に持つとどちらが効くのか分からなくなるので、fixed のときは必ず旧キーの金額を見る。
    if (sd && sd.mode === "rate") return { mode: "rate", value: sd.value };
    const amt = s[amtKey[kind]];
    if (amt != null) return { mode: "fixed", value: amt };
    if (sd && sd.mode) return { mode: sd.mode, value: sd.value };
    return { mode: "fixed", value: 0 };
  }
  // 率バックの元になる売上が取れなかった記録（画面で注意を出すため）
  let rateWarnings = [];
  function takeRateWarnings() { const w = rateWarnings; rateWarnings = []; return w; }
  // そのキャストの、その区分の売上（率バックの分母）。勤怠に無ければ当日の伝票から集める。
  function categorySales(castName, kind, bills) {
    bills = bills || (D.day0824 && D.day0824.bills) || [];
    let sum = 0;
    bills.forEach(function (b) {
      (b[kind] || []).forEach(function (x) {
        if (x.cast !== castName) return;
        // 区分の小計が伝票にあればそれを使う（無ければ指名料そのもの）
        const sub = (kind === "req" ? b.reqSub : kind === "dohan" ? b.dohanSub : b.fieldSub);
        sum += (sub != null ? sub : (x.amount || 0));
      });
    });
    return sum;
  }
  // 指名バック（キャスト個別の率/固定額に対応）
  function nominationBack(att, castObj, bills) {
    const cast = castObj || findCast(att.cast) || {};
    const kinds = ["req", "field", "dohan"];
    return kinds.reduce(function (sum, k) {
      const src = att[k] || {};
      const count = src.count || 0;
      if (!count) return sum;
      const r = backRule(cast, k);
      if (r.mode === "rate") {
        // 率のときは、その区分の売上に率をかける。
        // 勤怠に金額が入っていなければ伝票から集める（ここが0のまま計算すると給与が黙って0円になる）
        let base = (src.amount != null ? src.amount : (src.sub != null ? src.sub : null));
        if (base == null) base = categorySales(att.cast, k, bills);
        // 率バックなのに元になる売上が0＝黙って0円になる状態。気づけるように印を残す
        if (!base) {
          rateWarnings.push({ cast: att.cast, kind: k, rate: r.value });
        }
        return sum + roundBy((base || 0) * (r.value / 100));
      }
      return sum + count * r.value;   // 固定額 × 回数
    }, 0);
  }
  function findCast(name) { return (D.casts || []).find(function (c) { return c.name === name; }); }

  // 時給（1部/2部。2部の開始時刻は店舗設定。キャストごとに単価を持つ）
  function wagePayFor(cast, start, end) {
    const s = storeCfg();
    const w1 = cast.wage1 || 0, w2 = cast.wage2 || 0;
    if (!w2 || !s.part2Hour || !start || !end) return roundBy(workedHours(start, end) * w1);
    // 「開店から何分後か」に揃えて比べる。深夜0時をまたぐ店なので、生の時刻のままでは前後関係が壊れる。
    const open = (s.openHour || 0) * 60;
    const fromOpen = function (t) { let m = toMin(t) - open; if (m < 0) m += 1440; return m; };
    const sM = fromOpen(start); let eM = fromOpen(end); if (eM < sM) eM += 1440;
    const p2 = fromOpen(s.part2Hour);
    const h1 = Math.max(0, Math.min(eM, p2) - sM) / 60;   // 2部開始より前
    const h2 = Math.max(0, eM - Math.max(sM, p2)) / 60;   // 2部開始より後
    return roundBy(h1 * w1 + h2 * w2);
  }

  // キャスト1人の当日給与を算出
  function castPayroll(att) {
    const cast = findCast(att.cast) || { welfare: null, wage1: 0 };
    const back = nominationBack(att, cast) + drinkBack(att.drinks);
    const wagePay = wagePayFor(cast, att.start, att.end);
    const bonus = att.bonus || 0;
    const gross = back + wagePay + bonus;
    // 厚生費比率: キャスト個別 → 店舗設定 の順
    const wrate = (cast.welfare != null ? cast.welfare : (storeCfg().welfareRate * 100)) / 100;
    const welfare = roundBy(gross * wrate);
    const minus = att.minus || 0;
    const shikyu = gross - welfare - minus;        // 支給額
    const net = shikyu - (att.dailyPay || 0);      // 残り支給額
    return {
      cast: att.cast, back: back, wagePay: wagePay, bonus: bonus,
      gross: gross, welfare: welfare, minus: minus, shikyu: shikyu, dailyPay: att.dailyPay || 0, net: net,
    };
  }
  // スタッフ給与（日給ベース。キャストとは別計算）
  function staffPayroll(staff, row) {
    row = row || {};
    const bonus = row.bonus || 0;
    const gross = (staff.daily || 0) + bonus;   // 総支給＝日給＋賞与（キャストと同じく賞与込み）
    const welfare = roundBy(gross * ((staff.welfare || 0) / 100)); // 厚生費は総支給基準（賞与込み・castPayrollと統一）
    const minus = (row.late || 0) + (row.absent || 0) + (row.pickup || 0) + (row.fine || 0);
    const shikyu = gross - welfare - minus;
    const net = shikyu - (row.dailyPay || 0);
    return { back: 0, gross: gross, bonus: bonus, welfare: welfare, shikyu: shikyu, net: net, dailyPay: row.dailyPay || 0 };
  }

  function workedHours(start, end) {
    if (!start || !end) return 0;
    const s = toMin(start); let e = toMin(end);
    if (e < s) e += 24 * 60; // 深夜跨ぎ
    return (e - s) / 60;
  }
  // 夜の店は終了時刻を「25:00」「26:00」と書く（翌日2時の意味）。ここを弾くと現場で入力できない。
  // 0:00〜29:59 まで受ける。24以上はそのまま翌日として分に直す。
  function toMin(hhmm) {
    if (typeof hhmm !== "string") throw new Error("時刻が文字列ではありません: " + hhmm);
    const m = hhmm.trim().match(/^([0-2]?\d):([0-5]\d)$/);
    if (!m) throw new Error("時刻形式が不正です(HH:MM): " + hhmm);
    const h = +m[1];
    if (h > 29) throw new Error("時刻形式が不正です(HH:MM): " + hhmm);
    return h * 60 + (+m[2]);
  }

  // 客単価/組単価
  function unitPrice(salesTotal, guests) { return guests ? Math.round(salesTotal / guests) : 0; }

  // 給率（本家の公式定義・観測ログ148/156行）
  //   給率 = キャスト給与計 ÷ 売上計 、 キャスト給与計 = 残り支給額 + 女子日払い
  // ※画面に保存済みの数値を出さず必ずここを通す。保存値と式がズレたら検算で気づけるようにする。
  // 分子・分母は店舗設定で選べる（本家にも同じ設定がある）。既定は観測どおり。
  function payRateParts(row) {
    const s = storeCfg();
    const numer = {
      remainPlusFemaleDaily: function (r) { return r.remainingPay + r.femaleDaily; },  // 既定（観測に一致）
      remainOnly:            function (r) { return r.remainingPay; },
      laborTotal:            function (r) { return r.remainingPay + r.femaleDaily + r.maleDaily + r.bonus; },
    }[s.payRateNumerator] || function (r) { return r.remainingPay + r.femaleDaily; };
    const denom = {
      salesTotal: function (r) { return r.salesTotal; },   // 既定（観測に一致）
      honkei:     function (r) { return r.reqSub + r.dohanSub; },
      cash:       function (r) { return r.cash; },
    }[s.payRateDenominator] || function (r) { return r.salesTotal; };
    return { n: numer(row), d: denom(row) };
  }
  function payRate(row) {
    const p = payRateParts(row);
    if (!p.d) return 0;
    return Math.round(p.n / p.d * 10000) / 100;
  }
  // 月間の給率。日別に出ない月次補正（調整額・月給・源泉）は合計にだけ乗る（観測ログ③・151-153行）
  function payRateMonth(rows, monthlyAdjust) {
    const a = monthAggregate(rows);
    const p = payRateParts(a);
    if (!p.d) return 0;
    return Math.round((p.n + (monthlyAdjust || 0)) / p.d * 10000) / 100;
  }

  // ---- 当日集計（伝票と勤怠から導出）----
  // 画面に固定値を書かず必ずここを通す。伝票を1枚足したら当日の数字が全部動くのが本家の挙動。
  function billTotal(b) { return (b.cash || 0) + (b.card || 0) + (b.credit || 0); }
  function todayAggregate(bills, attendance) {
    bills = bills || []; attendance = attendance || [];
    const bucket = function (list) {
      const a = { sales: 0, cash: 0, card: 0, credit: 0, guests: 0, groups: 0, joshiSales: 0, reqHon: 0 };
      list.forEach(function (b) {
        a.sales += billTotal(b); a.cash += b.cash || 0; a.card += b.card || 0; a.credit += b.credit || 0;
        a.guests += b.guests || 0; a.groups += 1;
        // 女子売上＝本指名(リクエスト)が付いた伝票の売上（場内のみの伝票は含めない＝本家の観測に一致）
        if ((b.req || []).length) a.joshiSales += billTotal(b);
        a.reqHon += (b.req || []).reduce(function (s, x) { return s + (x.count || 0); }, 0);
      });
      a.perGuest = unitPrice(a.sales, a.guests);
      a.perGroup = unitPrice(a.sales, a.groups);
      return a;
    };
    const all = bucket(bills);
    const unsettled = bucket(bills.filter(function (b) { return !b.settled; }));
    const settled = bucket(bills.filter(function (b) { return !!b.settled; }));
    // 女子給料＝出勤キャストの残り支給額の合計
    const joshiPay = attendance.reduce(function (s, a) { return s + castPayroll(a).net; }, 0);
    return { all: all, unsettled: unsettled, settled: settled, joshiPay: joshiPay, castCount: attendance.length };
  }

  // 月間集計（financeDaily の合算）
  function monthAggregate(rows) {
    const acc = { cash:0, credit:0, card:0, salesTotal:0, reqSub:0, dohanSub:0,
      remainingPay:0, maleDaily:0, femaleDaily:0, bonus:0, minus:0,
      deposit:0, withdrawal:0, expenseTotal:0, grossProfit:0 };
    rows.forEach(function (r) {
      // 休業日も加算（全0のため結果不変・将来の月次入金等の取りこぼし防止）
      ["cash","credit","card","salesTotal","reqSub","dohanSub","remainingPay",
       "maleDaily","femaleDaily","bonus","minus","deposit","withdrawal","expenseTotal","grossProfit"]
      .forEach(function (k) { acc[k] += r[k] || 0; });
    });
    return acc;
  }

  // 折半（本家仕様を厳密に踏襲）：1明細＝単価÷人数の円未満切捨。余りは配賦しない。
  // 観測ログ346-349行「10,000円を3人→1人3,333円→合計9,999円で表示（1円ズレる）」
  // ※合計を元金額に合わせる“親切”をすると本家と数字が変わる＝完全再現でなくなるため、あえて踏襲する。
  //   代わりに lostYen（欠ける円）を返し、画面側で注意表示できるようにする（本家に無い改善）。
  function splitBill(originalPrice, splitCount) {
    const price = Number(originalPrice), count = Number(splitCount);
    if (!Number.isInteger(price) || price < 0) throw new Error("折半元金額は0以上の整数円: " + originalPrice);
    if (!Number.isInteger(count) || count <= 0) throw new Error("折半人数は1以上の整数: " + splitCount);
    // 既定は本家と同じ「切捨・余りを配らない」。店舗設定で「余りを先頭に配る」も選べる
    const unit = Math.floor(price / count);
    const rem = price - unit * count;
    const spread = storeCfg().splitSpreadRemainder === true;
    const shares = []; for (let i = 0; i < count; i++) shares.push(unit + (spread && i < rem ? 1 : 0));
    const total = shares.reduce(function (a, b) { return a + b; }, 0);
    return { unit: unit, shares: shares, displayedTotal: total, lostYen: price - total };
  }

  // ---- 検算（起動時に必ず走る。1件でも外れたら画面に赤バー） ----
  // 検算は「出荷時デフォルトのバック額」で行う（ユーザーが設定を変えても起動検算が誤爆しないように）
  function validateCalcFixtures() {
    const errs = [];
    // 検算は必ず「出荷時の値」で回す。
    // ユーザーが時給や厚生費を変えただけで「本家一致チェック失敗」の赤バーが出て
    // 画面が開かなくなるのを防ぐ（正しい設定変更を失敗として扱わない）。
    const seed = D.SEED;
    if (!seed) return _validate(errs);           // 保険：SEEDが無い環境ではそのまま検算
    const savedStore = D.store, savedCasts = D.casts;
    D.store = JSON.parse(JSON.stringify(seed.store));
    D.casts = JSON.parse(JSON.stringify(seed.casts));
    try { return _validate(errs); }
    finally { D.store = savedStore; D.casts = savedCasts; }
  }
  function _validate(errs) {
    // seed の形チェック（列ズレ→空表示 を防ぐ・ルールD）
    const need = global.SCHEMA.financeFields;
    D.financeDaily.forEach(function (r, i) {
      need.forEach(function (k) {
        if (!(k in r)) errs.push({ label: "seed列欠落 行" + (i + 1) + ":" + k, got: 0, want: 1, diff: -1 });
      });
    });
    const agg = monthAggregate(D.financeDaily);
    check(errs, "月間売上計", agg.salesTotal, 3008100);
    check(errs, "月間経費計", agg.expenseTotal, 1217589);
    check(errs, "月間粗利",   agg.grossProfit, 1790511);
    check(errs, "月間現金",   agg.cash, 1722600);
    check(errs, "月間カード", agg.card, 1285500);
    check(errs, "客単価",     unitPrice(D.monthSummary.salesTotal, D.monthSummary.guests), 20746);
    check(errs, "組単価",     unitPrice(D.monthSummary.salesTotal, D.monthSummary.groups), 30081);
    // 8/24 給与エンジン（勤怠報告の観測値）
    D.day0824.attendance.forEach(function (att) {
      const pay = castPayroll(att);
      const exp = D.day0824.expected.pay[att.cast];
      check(errs, "給与:" + att.cast + " バック計", pay.back, exp.back);
      check(errs, "給与:" + att.cast + " 総支給", pay.gross, exp.gross);
      check(errs, "給与:" + att.cast + " 厚生費", pay.welfare, exp.welfare);
      check(errs, "給与:" + att.cast + " 残り支給", pay.net, exp.net);
    });
    // 女子給料合計
    const joshi = D.day0824.attendance.reduce(function (s, a) { return s + castPayroll(a).net; }, 0);
    check(errs, "8/24 女子給料合計", joshi, D.day0824.expected.joshiPay);
    // 商品日別と月間の整合（列存在＋日別合計≤月間）ルールD
    if (D.itemDaily && D.itemDailyCols) {
      const cols = D.itemDailyCols, sums = cols.map(function () { return 0; });
      Object.keys(D.itemDaily).forEach(function (dt) {
        const arr = D.itemDaily[dt] || [];
        if (arr.length !== cols.length) errs.push({ label: "商品日別 列数不一致:" + dt, got: arr.length, want: cols.length, diff: arr.length - cols.length });
        arr.forEach(function (v, i) { sums[i] += (+v || 0); });
      });
      cols.forEach(function (name, i) {
        if (!(name in D.itemTotals)) errs.push({ label: "日別にあり月間に無い商品:" + name, got: sums[i], want: 0, diff: sums[i] });
        else if (sums[i] > D.itemTotals[name]) errs.push({ label: "商品日別が月間超過:" + name, got: sums[i], want: D.itemTotals[name], diff: sums[i] - D.itemTotals[name] });
      });
    }
    // itemTotals の商品が商品マスタに存在するか（ルールD：画面とデータの整合）
    Object.keys(D.itemTotals).forEach(function (name) {
      if (!productByName(name)) errs.push({ label: "月間商品が商品マスタに無い:" + name, got: 0, want: 1, diff: -1 });
    });
    // 当日集計が伝票から導出されて観測値と一致するか（画面の固定値をやめた分、ここで守る）
    const td = todayAggregate(D.day0824.bills, D.day0824.attendance);
    check(errs, "当日 総売上",   td.all.sales,        D.day0824.expected.totalSales);
    check(errs, "当日 未精算",   td.unsettled.sales,  D.day0824.expected.unsettled);
    check(errs, "当日 精算済",   td.settled.sales,    D.day0824.expected.settled);
    check(errs, "当日 女子給料", td.joshiPay,         D.day0824.expected.joshiPay);
    check(errs, "当日 現金",     td.all.cash,         47900);
    check(errs, "当日 カード",   td.all.card,         7300);
    check(errs, "当日 組数",     td.all.groups,       3);
    check(errs, "当日 客数",     td.all.guests,       4);
    check(errs, "当日 客単価",   td.all.perGuest,     13800);
    check(errs, "当日 未精算客単価", td.unsettled.perGuest, 15967);
    check(errs, "当日 精算済客単価", td.settled.perGuest,   7300);
    check(errs, "当日 女子売上", td.all.joshiSales,   47900);
    check(errs, "当日 女子売上(未精算)", td.unsettled.joshiSales, 47900);
    check(errs, "当日 女子売上(精算済)", td.settled.joshiSales,   0);
    // 折半：本家と同じく1人3,333円・合計9,999円（1円ズレる）を再現しているか
    const sp = splitBill(10000, 3);
    check(errs, "折半10000/3 1人あたり", sp.unit, 3333);
    check(errs, "折半10000/3 表示合計", sp.displayedTotal, 9999);
    check(errs, "折半10000/3 欠ける円", sp.lostYen, 1);
    return errs; // [] なら全一致
  }
  function check(errs, label, got, want) {
    if (got !== want) errs.push({ label: label, got: got, want: want, diff: got - want });
  }

  global.CALC = {
    staffPayroll: staffPayroll, todayAggregate: todayAggregate, backRule: backRule, roundBy: roundBy, wagePayFor: wagePayFor, payRateParts: payRateParts, categorySales: categorySales, takeRateWarnings: takeRateWarnings, payRate: payRate, payRateMonth: payRateMonth, billTotal: billTotal, drinkBack, nominationBack, castPayroll, workedHours, unitPrice,
    monthAggregate, splitBill, validateCalcFixtures, productByName,
  };
})(typeof window !== "undefined" ? window : globalThis);
