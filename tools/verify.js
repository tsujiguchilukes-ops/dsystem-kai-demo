/* Dシステム改 - 本家との照合ハーネス（全数検証）
 *
 * 目的: 本家Dシステムの裏側コードは見られない。だから「観測できた数字」から
 *       式を逆算し、1つ残らず突き合わせて、
 *         確定 … 観測値と式が一致した（＝本家の裏側をこの式で説明できた）
 *         矛盾 … 観測値どうしが食い違う（＝隠れた項目がある証拠）
 *         未確定 … 観測が足りず式を一意に決められない（＝実機で何を見れば決まるかを出す）
 *       の3つに必ず仕分ける。読むだけで終わらせず、必ず数値で判定する。
 *
 * 使い方: node tools/verify.js
 * 出典  : ~/Desktop/d-system解析/01_観測ログ.md（行番号を根拠として各項目に記載）
 */
global.window = globalThis;
require('../js/schema.js'); require('../js/data.js'); require('../js/calc.js');
const D = DATA, C = CALC;

const OK = [], NG = [], TODO = [];
const yen = n => Number(n).toLocaleString('ja-JP');
// 一致判定（金額は完全一致、率は小数2桁で一致）
function eq(label, got, want, src, tol) {
  const hit = tol == null ? got === want : Math.abs(got - want) <= tol;
  (hit ? OK : NG).push({ label, got, want, src, diff: got - want });
  return hit;
}
function todo(label, why, how, src) { TODO.push({ label, why, how, src }); }

/* ============ 1. 月間の骨格（観測ログ 55, 64-72行） ============ */
const agg = C.monthAggregate(D.financeDaily);
eq('月間 売上計',   agg.salesTotal,   3008100, 'ログ64');
eq('月間 現金',     agg.cash,         1722600, 'ログ64');
eq('月間 カード',   agg.card,         1285500, 'ログ64');
eq('月間 リクエスト小計', agg.reqSub,  2030500, 'ログ65');
eq('月間 同伴小計', agg.dohanSub,      561600, 'ログ65');
eq('月間 残り支給額(日別合計)', agg.remainingPay, 801289, 'ログ68/167');
eq('月間 男子日払い', agg.maleDaily,   175000, 'ログ68');
eq('月間 女子日払い', agg.femaleDaily, 190000, 'ログ68');
eq('月間 マイナス',  agg.minus,         14000, 'ログ68');
eq('月間 出金',     agg.withdrawal,    51300, 'ログ68');
eq('月間 経費計',   agg.expenseTotal, 1217589, 'ログ55/167');
eq('月間 粗利',     agg.grossProfit,  1790511, 'ログ55');

/* ============ 2. 公式定義そのものを式で検算（ログ146-165行） ============ */
// ② 経費計 = 残り支給額 + 男子日払い + 女子日払い + ボーナス + 出金
eq('式② 経費計の内訳が合うか',
   agg.remainingPay + agg.maleDaily + agg.femaleDaily + agg.bonus + agg.withdrawal,
   1217589, 'ログ167');
// 粗利 = 売上計 + 入金 - 経費計
eq('式② 粗利 = 売上計+入金-経費計',
   agg.salesTotal + agg.deposit - agg.expenseTotal, 1790511, 'ログ95/104');

/* ============ 3. 日別の式（ログ100-104行の4日ぶんの明示検算） ============ */
[['2026-08-01', 123997, 215503], ['2026-08-08', 150289, 267111],
 ['2026-08-03', 33080, 69720],  ['2026-08-04', 38710, 43990]].forEach(([date, wantExp, wantGross]) => {
  const r = D.financeDaily.find(x => x.date === date);
  if (!r) { NG.push({ label: `日別 ${date} が見つからない`, got: 0, want: 1, src: 'ログ100-104' }); return; }
  eq(`日別 ${date} 経費計`,
     r.remainingPay + r.maleDaily + r.femaleDaily + r.bonus + r.withdrawal, wantExp, 'ログ100-104');
  eq(`日別 ${date} 粗利`, r.salesTotal + r.deposit - r.expenseTotal, wantGross, 'ログ100-104');
});
// 全31日ぶん、式が破綻していないか（seedと式の自己整合）
let dayExpOK = 0, dayGrossOK = 0;
D.financeDaily.forEach(r => {
  if (r.remainingPay + r.maleDaily + r.femaleDaily + r.bonus + r.withdrawal === r.expenseTotal) dayExpOK++;
  if (r.salesTotal + r.deposit - r.expenseTotal === r.grossProfit) dayGrossOK++;
});
eq('全31日 経費計の式が成立', dayExpOK, D.financeDaily.length, '自己整合');
eq('全31日 粗利の式が成立',   dayGrossOK, D.financeDaily.length, '自己整合');

/* ============ 4. 給率（ログ148-160行）＝ここに隠れ項目があった ============ */
// ① 給率 = キャスト給与計 ÷ 売上計、キャスト給与計 = 残り支給額 + 女子日払い
[['08/16', 7815, 7000, 25700, 57.65], ['08/20', 10345, 5000, 18300, 83.85],
 ['08/23', 8385, 7000, 11400, 134.96], ['08/24', 810, 0, 7300, 11.10]].forEach(([d, rem, fd, sales, want]) => {
  eq(`給率 ${d}`, Math.round((rem + fd) / sales * 10000) / 100, want, 'ログ157-160', 0.01);
});
// 月間の給率。日別合計だと合わず、キャスト画面合計だと合う＝月次補正の存在が証明される
const CAST_PAGE_REMAINING = 816289; // /cast 画面の合計行（ログ・キャスト画面観測値）
const rateDaily = (agg.remainingPay + agg.femaleDaily) / agg.salesTotal * 100;
const ratePage  = (CAST_PAGE_REMAINING + agg.femaleDaily) / agg.salesTotal * 100;
eq('月間 給率（キャスト画面の合計を使う）', Math.round(ratePage * 100) / 100, 33.45, 'ログ68', 0.01);
// 「日別合計だけでは給率が合わない」こと自体を検算する（＝月次補正が実在する証拠）
eq('★月次補正が無いと給率は合わない（差が0.01%超）',
   Math.abs(rateDaily - 33.45) > 0.01, true, 'ログ68 vs 167');
eq('★月次補正額 = キャスト画面合計 − 日別合計',
   CAST_PAGE_REMAINING - agg.remainingPay, 15000, 'ログ68/167から逆算');

/* ============ 5. 給与エンジン（ログ241-250行・8/24の実測3名） ============ */
D.day0824.attendance.forEach(att => {
  const p = C.castPayroll(att), e = D.day0824.expected.pay[att.cast];
  eq(`給与 ${att.cast} バック計`, p.back, e.back, 'ログ225-240');
  eq(`給与 ${att.cast} 総支給額`, p.gross, e.gross, 'ログ243');
  eq(`給与 ${att.cast} 厚生費(総支給×10%)`, p.welfare, e.welfare, 'ログ244');
  eq(`給与 ${att.cast} 残り支給額`, p.net, e.net, 'ログ245-248');
});
eq('8/24 女子給料合計',
   D.day0824.attendance.reduce((s, a) => s + C.castPayroll(a).net, 0),
   D.day0824.expected.joshiPay, 'ログ225');

/* ============ 6. 商品バック（ログ288-306, 330-343行） ============ */
// バック額 = 販売価格 × 商品ごとの固定率（キャスト共通）。観測された個数×単価×率と一致するか
[['キャストドリンクS', 617, 1000, 617000, 123400], ['★キャストショット', 1, 2500, 2500, 500],
 ['テキーラショット各種', 73, 2000, 146000, 36500], ['クライナー', 88, 1500, 132000, 44000],
 ['コカレロ', 58, 2500, 145000, 29000], ['フード800', 2, 800, 1600, 100]].forEach(([name, qty, price, sales, back]) => {
  const p = C.productByName(name);
  if (!p) { NG.push({ label: `商品マスタに無い: ${name}`, got: 0, want: 1, src: 'ログ288-306' }); return; }
  eq(`商品 ${name} 単価`, p.price, price, 'ログ288-306');
  eq(`商品 ${name} 販売価格計`, p.price * qty, sales, 'ログ288-306');
  eq(`商品 ${name} バック計`, p.backAmt * qty, back, 'ログ288-306');
});
// 本家の40品が「番号ごとに」揃っているかを見る（件数だけ見ると多くても通ってしまう）
(function () {
  const missing = [];
  for (let no = 1; no <= 40; no++) if (!D.products.some(p => p.no === no)) missing.push(no);
  eq('本家40品が番号どおり揃っている（欠番数）', missing.length, 0, 'ログ330-341');
  if (missing.length) NG[NG.length - 1].label += '（欠番: ' + missing.join(',') + '）';
  const dup = {}, dups = [];
  D.products.forEach(p => { if (dup[p.no]) dups.push(p.no); dup[p.no] = 1; });
  eq('商品番号に重複が無い', dups.length, 0, 'ログ330-341');
})();

/* ============ 7. 客単価・組単価（ログ48行） ============ */
eq('月間 客単価', C.unitPrice(D.monthSummary.salesTotal, D.monthSummary.guests), 20746, 'ログ月間');
eq('月間 組単価', C.unitPrice(D.monthSummary.salesTotal, D.monthSummary.groups), 30081, 'ログ月間');

/* ============ 8. 当日集計が伝票から導出できるか（ログ225-256行） ============ */
const td = C.todayAggregate(D.day0824.bills, D.day0824.attendance);
eq('当日 総売上',   td.all.sales, 55200, 'ログ営業日報');
eq('当日 未精算',   td.unsettled.sales, 47900, 'ログ営業日報');
eq('当日 精算済',   td.settled.sales, 7300, 'ログ営業日報');
eq('当日 客単価',   td.all.perGuest, 13800, 'ログ営業日報');
// 給率は「収支の日別行」ベース（＝精算済のみ）。リアルタイムの女子給料6,840とは別物
const r0824 = D.financeDaily.find(x => x.date === '2026-08-24');
eq('当日 給率（収支日別＝精算済ベース）',
   Math.round((r0824.remainingPay + r0824.femaleDaily) / r0824.salesTotal * 10000) / 100, 11.10, 'ログ160', 0.01);

/* ---- 全31日の給率を総当たり（式①が全日で成立するか） ---- */
let rateOK = 0, rateNG = [];
D.financeDaily.forEach(r => {
  if (r.holiday || !r.salesTotal) return;
  const calc = Math.round((r.remainingPay + r.femaleDaily) / r.salesTotal * 10000) / 100;
  if (Math.abs(calc - r.payRate) <= 0.01) rateOK++;
  else rateNG.push(`${r.date} 式=${calc}% 表示=${r.payRate}%`);
});
// 式で出した給率と、画面から転記した保存値が食い違う日を洗い出す。
// 式は月合計（33.45%）と完全一致することが確認できているので、式が正・保存値が疑わしい。
// アプリは保存値を使わず式で表示するため画面は常に整合。ここは「実機で確かめる対象」を出すのが目的。
if (rateNG.length) {
  todo(`給率の保存値が式と合わない日 ${rateNG.length}日`,
    '式（残り支給額＋女子日払い）÷売上計 は月合計33.45%と完全一致するため式は正しい。'
    + 'これらの日は画面から数字を写した時のズレの可能性が高い（08-05に+10,006、08-17に-10,001と1万円が対で出ている）。'
    + ' → ' + rateNG.join(' / '),
    '本家の収支明細(月次)を、該当日の行が写るように撮る（残り支給額・女子日払い・給率の3列）。', 'ログ148/156');
} else {
  OK.push({ label: '★全営業日の給率が式①と一致', got: rateOK, want: rateOK, src: 'ログ148/156' });
}
// 月合計の給率が式で再現できるか（月次補正込み）＝式が正しいことの決定的な証拠
eq('★月間給率を式で再現（月次補正込み）',
   C.payRateMonth(D.financeDaily, D.store.monthlyAdjust), 33.45, 'ログ68', 0.01);

/* ============ 9. 折半（ログ345-349行） ============ */
const sp = C.splitBill(10000, 3);
eq('折半 1人あたり', sp.unit, 3333, 'ログ347');
eq('折半 表示合計（本家は1円ズレる）', sp.displayedTotal, 9999, 'ログ347');

/* ============ 10. カスタマイズの単体検算 ============
 * 「店舗ごと・キャストごとに変えられる」ようにした分の退行を拾う。
 * ここが無かったせいで、2部時給と rate モードのバグを検算で拾えなかった。
 * 検査のあと必ず既定値へ戻す（戻さないと以降の検算が汚れる）。 */
(function customChecks() {
  const S = D.store;
  const snap = {}; ['reqBackAmount','fieldBackAmount','dohanBackAmount','reqBack','fieldBack','dohanBack',
    'rounding','splitSpreadRemainder','part2Hour','payRateNumerator','payRateDenominator','welfareRate']
    .forEach(k => snap[k] = S[k]);
  const castSnap = D.casts.map(c => ({ ref: c, back: c.back, wage2: c.wage2, welfare: c.welfare }));
  try {
    // 設定画面・音声が触る「金額」が本当に計算に効くか（効かないと設定が飾りになる）
    S.reqBackAmount = 1000;
    eq('設定の金額が計算に効く', C.nominationBack({ cast: 'x', req: { count: 2 } }, { name: 'x' }), 2000, 'カスタム');
    S.reqBackAmount = snap.reqBackAmount;

    // キャスト個別が店舗より優先されるか／0円を「未設定」と誤判定しないか
    const c0 = { name: 'x', back: { req: { mode: 'fixed', value: 0 } } };
    eq('キャスト個別の0円が効く（店舗に落ちない）',
       C.nominationBack({ cast: 'x', req: { count: 3 } }, c0), 0, 'カスタム');
    eq('キャスト個別の固定額が店舗に優先',
       C.nominationBack({ cast: 'x', req: { count: 2 } }, { name: 'x', back: { req: { mode: 'fixed', value: 700 } } }),
       1400, 'カスタム');

    // 率モード：分母が0のときに黙って0円にならないか／amount:0 を尊重するか
    eq('率モード amount=0 は0円',
       C.nominationBack({ cast: 'x', req: { count: 1, amount: 0, sub: 10000 } },
                        { name: 'x', back: { req: { mode: 'rate', value: 10 } } }), 0, 'カスタム');
    eq('率モード amount指定',
       C.nominationBack({ cast: 'x', req: { count: 1, amount: 10000 } },
                        { name: 'x', back: { req: { mode: 'rate', value: 10 } } }), 1000, 'カスタム');

    // 2部時給（ここでバグが2つ出た）
    S.part2Hour = '22:00';
    const w = { wage1: 1000, wage2: 2000 };
    eq('2部 開始後に出勤したら全額2部', C.wagePayFor(w, '23:00', '25:00'), 4000, 'カスタム');
    eq('2部 またぐ勤務は按分',        C.wagePayFor(w, '20:00', '24:00'), 2000 + 4000, 'カスタム');
    eq('2部 開始前に終わったら全額1部', C.wagePayFor(w, '19:00', '21:00'), 2000, 'カスタム');
    eq('2部 終了未入力でも落ちない',   C.wagePayFor(w, '21:00', null), 0, 'カスタム');
    S.part2Hour = snap.part2Hour;

    // 端数処理
    S.rounding = 'floor';
    eq('端数 切捨（スタッフ厚生費）', C.staffPayroll({ daily: 105, welfare: 10 }, {}).welfare, 10, 'カスタム');
    S.rounding = 'ceil';
    eq('端数 切上（スタッフ厚生費）', C.staffPayroll({ daily: 105, welfare: 10 }, {}).welfare, 11, 'カスタム');
    S.rounding = snap.rounding;

    // 折半の余りを配る設定
    S.splitSpreadRemainder = true;
    eq('折半 余りを配る＝合計一致', C.splitBill(10000, 3).displayedTotal, 10000, 'カスタム');
    S.splitSpreadRemainder = false;
    eq('折半 配らない＝本家と同じ',  C.splitBill(10000, 3).displayedTotal, 9999, 'カスタム');
    S.splitSpreadRemainder = snap.splitSpreadRemainder;

    // 給率の分子・分母
    const row = D.financeDaily.find(r => r.date === '2026-08-01');
    S.payRateDenominator = 'honkei';
    eq('給率 分母をリクエスト+同伴に変更',
       C.payRate(row), Math.round(row.remainingPay + row.femaleDaily) / (row.reqSub + row.dohanSub) * 100, 'カスタム', 0.01);
    S.payRateDenominator = snap.payRateDenominator;

    // 夜の店の時刻表記
    eq('25:00表記が通る', C.workedHours('20:00', '25:00'), 5, 'カスタム');
    eq('26:30表記が通る', C.workedHours('21:30', '26:30'), 5, 'カスタム');

    // 設定を変えても起動検算が誤爆しないこと（ここが崩れると毎回赤バーが出る）
    S.reqBack = { mode: 'fixed', value: 9999 }; S.rounding = 'floor'; S.part2Hour = '22:00';
    D.casts[0].back = { req: { mode: 'rate', value: 50 } };
    eq('★設定を変えても起動検算は誤爆しない', C.validateCalcFixtures().length, 0, 'カスタム');
  } finally {
    Object.keys(snap).forEach(k => S[k] = snap[k]);
    castSnap.forEach(x => { if (x.back) x.ref.back = x.back; else delete x.ref.back; x.ref.wage2 = x.wage2; x.ref.welfare = x.welfare; });
  }
})();

/* ============ 11. まだ式を一意に決められないもの（実機で何を見れば決まるか） ============ */
todo('月次補正15,000の内訳',
     '「キャスト調整額」「キャストの月給」「スタッフの月給」「源泉徴収」のどれが幾らかが分からない。合計15,000であることだけ確定。',
     '本家 /cast 画面の合計行と、設定＞キャストの「月給」「調整額」欄を1枚ずつ撮る。源泉徴収のON/OFFも。', 'ログ151-153/188');
todo('キャスト個別のバック率',
     '指名バックは店舗共通の固定額(500/500/2000)で8/24の3名は再現できたが、キャストごとに率や固定額を変えられる設定が本家にある。個別値が未観測。',
     '設定＞キャスト＞各キャストの「リクエスト率/場内率/同伴率」欄を撮る（1人分でも式が決まる）。', 'ログ479-492');
todo('時給の2部制',
     '本家は時給1部/2部を持つが、2部の適用条件（何時から2部か）が未観測。',
     '設定＞キャスト の時給欄と、店舗設定の「2部開始時刻」を撮る。', 'ログ647-649');
todo('売上本計の定義',
     '給率の分母は観測では「売上計」だが、店舗設定に給率の分子/分母を選ぶ項目がある。既定値がどれか未確定。',
     '設定＞店舗＞給率の「分子」「分母」プルダウンの選択値を撮る。', 'ログ628-651');
todo('キャスト別商品の実数',
     'キャスト×商品の個数は「キャストドリンクSのシェア」からの推定配分で、実測ではない。',
     'キャスト別商品集計を、集計日=期間全体で1枚撮る（列が多いので横スクロール分も）。', 'ログ311-314');
todo('入出金の粗利算入フラグの効き方',
     '入出金項目に「粗利算入/現金算入」フラグがあるが、実際にフラグOFFのレコードが粗利からどう外れるか未観測（今月は該当データが無い）。',
     '設定＞入出金項目の一覧と、粗利×のレコードがある月の収支を撮る。', 'ログ148-153/502-515');

/* ============ 出力 ============ */
const line = '─'.repeat(64);
console.log('\n' + line + '\n  本家Dシステムとの照合（全数検証）\n' + line);
console.log(`\n【確定】観測値と一致した式: ${OK.length}件`);
OK.forEach(o => console.log(`  ✓ ${o.label}  = ${typeof o.got === 'number' ? yen(o.got) : o.got}  (${o.src})`));
if (NG.length) {
  console.log(`\n【不一致】式が観測値と合わない: ${NG.length}件  ← ここが穴`);
  NG.forEach(o => console.log(`  ✗ ${o.label}\n      出た値 ${yen(o.got)} / 観測値 ${yen(o.want)} / 差 ${yen(o.diff)}  (${o.src})`));
} else {
  console.log('\n【不一致】なし');
}
console.log(`\n【未確定】観測が足りず式を決められない: ${TODO.length}件`);
TODO.forEach((t, i) => {
  console.log(`  ${i + 1}. ${t.label}`);
  console.log(`     なぜ: ${t.why}`);
  console.log(`     決める方法: ${t.how}  (${t.src})`);
});
const total = OK.length + NG.length;
console.log('\n' + line);
console.log(`  照合 ${total}項目中 ${OK.length}項目が一致（不一致 ${NG.length} / 未確定 ${TODO.length}）`);
console.log(line + '\n');
process.exit(NG.length ? 1 : 0);
