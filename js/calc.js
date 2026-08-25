/* Dシステム改 - calc.js
 * 計算エンジン（本家と1円一致）。全式は 03_設計書 §3/§8 準拠。
 */
(function (global) {
  "use strict";
  const D = global.DATA;

  function productByName(name) {
    return D.products.find(function (p) { return p.name === name; });
  }

  // 商品バック（整数円で加算＝端数ドリフト防止）
  function drinkBack(drinks) {
    if (!drinks) return 0;
    return drinks.reduce(function (sum, d) {
      const p = productByName(d.name);
      const per = p ? p.backAmt : 0;
      return sum + per * (d.qty || 0);
    }, 0);
  }

  // 指名バック（店舗固定額。将来キャスト個別上書き対応）
  function nominationBack(att, castObj) {
    const s = D.store;
    const reqAmt   = s.reqBackAmount;
    const fieldAmt = s.fieldBackAmount;
    const dohanAmt = s.dohanBackAmount;
    const req   = (att.req   && att.req.count)   || 0;
    const field = (att.field && att.field.count) || 0;
    const dohan = (att.dohan && att.dohan.count) || 0;
    return req * reqAmt + field * fieldAmt + dohan * dohanAmt;
  }

  // キャスト1人の当日給与を算出
  function castPayroll(att) {
    const cast = D.casts.find(function (c) { return c.name === att.cast; }) || { welfare: 10, wage1: 0 };
    const back = nominationBack(att, cast) + drinkBack(att.drinks);
    const hours = workedHours(att.start, att.end);
    const wagePay = Math.round(hours * (cast.wage1 || 0));
    const bonus = att.bonus || 0;
    const grossNoBonus = back + wagePay;   // ボーナス分離（二重計上防止）
    const gross = grossNoBonus + bonus;
    // 厚生費比率: キャスト個別優先、無ければ店舗設定をフォールバック
    const wrate = (cast.welfare != null ? cast.welfare : (D.store.welfareRate * 100)) / 100;
    const welfare = Math.round(gross * wrate);
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
    const welfare = Math.round(gross * ((staff.welfare || 0) / 100)); // 厚生費は総支給基準（賞与込み・castPayrollと統一）
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
  function toMin(hhmm) {
    if (typeof hhmm !== "string") throw new Error("時刻が文字列ではありません: " + hhmm);
    const m = hhmm.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) throw new Error("時刻形式が不正です(HH:MM): " + hhmm);
    return (+m[1]) * 60 + (+m[2]);
  }

  // 客単価/組単価
  function unitPrice(salesTotal, guests) { return guests ? Math.round(salesTotal / guests) : 0; }

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
    const unit = Math.floor(price / count);
    const shares = []; for (let i = 0; i < count; i++) shares.push(unit);
    const total = unit * count;
    return { unit: unit, shares: shares, displayedTotal: total, lostYen: price - total };
  }

  // ---- 検算（起動時に必ず走る。1件でも外れたら画面に赤バー） ----
  // 検算は「出荷時デフォルトのバック額」で行う（ユーザーが設定を変えても起動検算が誤爆しないように）
  const DEFAULT_BACK = { reqBackAmount: 500, fieldBackAmount: 500, dohanBackAmount: 2000 };
  function validateCalcFixtures() {
    const errs = [];
    const saved = { reqBackAmount: D.store.reqBackAmount, fieldBackAmount: D.store.fieldBackAmount, dohanBackAmount: D.store.dohanBackAmount };
    D.store.reqBackAmount = DEFAULT_BACK.reqBackAmount; D.store.fieldBackAmount = DEFAULT_BACK.fieldBackAmount; D.store.dohanBackAmount = DEFAULT_BACK.dohanBackAmount;
    try { return _validate(errs); } finally {
      D.store.reqBackAmount = saved.reqBackAmount; D.store.fieldBackAmount = saved.fieldBackAmount; D.store.dohanBackAmount = saved.dohanBackAmount;
    }
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
    staffPayroll: staffPayroll, todayAggregate: todayAggregate, billTotal: billTotal, drinkBack, nominationBack, castPayroll, workedHours, unitPrice,
    monthAggregate, splitBill, validateCalcFixtures, productByName,
  };
})(typeof window !== "undefined" ? window : globalThis);
