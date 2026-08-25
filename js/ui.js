/* Dシステム改 - ui.js : 全画面のレンダラ（本家超えデザイン） */
(function (global) {
  "use strict";
  const D = global.DATA, C = global.CALC;
  let _hideZeroCast = false; // キャスト別商品集計「0個を除外」の状態
  const yen = function (n) { if (!Number.isFinite(n)) return "計算エラー"; return "¥" + n.toLocaleString("ja-JP"); };
  const num = function (n) { if (!Number.isFinite(n)) return "計算エラー"; return n.toLocaleString("ja-JP"); };
  const esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };
  const t = function (k) { return esc(D.t(k)); };

  // ---------- SVG 複合グラフ（棒＝売上/経費、線＝粗利累計。適正スケール1軸系） ----------
  function salesChart(rows) {
    const days = rows.filter(function (r) { return !r.holiday && r.salesTotal >= 0; });
    const W = 980, H = 320, padL = 52, padR = 16, padT = 18, padB = 28;
    const iw = W - padL - padR, ih = H - padT - padB;
    const maxBar = Math.max.apply(null, days.map(function (r) { return Math.max(r.salesTotal, r.expenseTotal); }).concat([1]));
    let cum = 0; const cumPts = [];
    const maxCum = days.reduce(function (s, r) { return s + r.grossProfit; }, 0) || 1;
    const n = days.length, bw = Math.min(11, iw / n * 0.36), rx = bw / 2;
    let bars = "", grid = "";
    // 薄いグリッド（明るい背景用）
    for (let i = 0; i <= 4; i++) {
      const y = padT + ih * i / 4; const val = Math.round(maxBar * (4 - i) / 4);
      grid += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#ece7db"/>'
           + '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" fill="#a6a091" font-size="10" text-anchor="end">' + (val / 1000) + 'k</text>';
    }
    days.forEach(function (r, i) {
      const cx = padL + iw * (i + 0.5) / n;
      const hs = ih * r.salesTotal / maxBar, he = ih * r.expenseTotal / maxBar;
      bars += '<rect x="' + (cx - bw - 1) + '" y="' + (padT + ih - hs) + '" width="' + bw + '" height="' + Math.max(hs,0) + '" rx="' + rx + '" fill="url(#gSales)"/>';
      bars += '<rect x="' + (cx + 1) + '" y="' + (padT + ih - he) + '" width="' + bw + '" height="' + Math.max(he,0) + '" rx="' + rx + '" fill="url(#gCost)"/>';
      cum += r.grossProfit;
      cumPts.push([cx, padT + ih - ih * cum / maxCum]);
    });
    const line = cumPts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    const areaGP = 'M' + cumPts[0][0].toFixed(1) + ' ' + (padT + ih) + ' ' + line.replace('M', 'L') + ' L' + cumPts[cumPts.length - 1][0].toFixed(1) + ' ' + (padT + ih) + ' Z';
    const dots = cumPts.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#fff" stroke="#1f9d57" stroke-width="2"/>'; }).join("");
    const labels = days.map(function (r, i) {
      const cx = padL + iw * (i + 0.5) / n; const d = +r.date.slice(-2);
      return (d % 3 === 1) ? '<text x="' + cx + '" y="' + (H - 8) + '" fill="#a6a091" font-size="9" text-anchor="middle">' + d + '</text>' : "";
    }).join("");
    const defs = '<defs>'
      + '<linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a9eff"/><stop offset="1" stop-color="#8fc3ff"/></linearGradient>'
      + '<linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0862c"/><stop offset="1" stop-color="#f7b787"/></linearGradient>'
      + '<linearGradient id="gGP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f9d57" stop-opacity=".18"/><stop offset="1" stop-color="#1f9d57" stop-opacity="0"/></linearGradient>'
      + '</defs>';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">'
      + defs + grid + '<path d="' + areaGP + '" fill="url(#gGP)"/>' + bars
      + '<path d="' + line + '" fill="none" stroke="#1f9d57" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' + dots + labels + '</svg>'
      + '<div class="legend"><span><i style="background:#4a9eff"></i>売上</span><span><i style="background:#f0862c"></i>経費</span><span><i style="background:#1f9d57"></i>粗利(累計)</span></div>';
  }

  // ---------- まとめ ----------
  function summary() {
    const m = D.monthSummary;
    // 前月比はデモ（前月データ無し→目標達成率で価値表現）
    const achieve = Math.round(m.salesTotal / D.store.target * 100);
    const d0824 = D.financeDaily.find(function (r) { return r.date === "2026-08-24"; });
    const card = function (title, cap, big, unit, kvs) {
      return '<div class="card" style="flex:1;min-width:240px"><h3><span class="cap" style="background:' + cap + '"></span>' + title + '</h3>'
        + '<div class="big xl">' + big + (unit ? '<span class="unit">' + unit + '</span>' : '') + '</div>'
        + kvs.map(function (k) { return '<div class="kv"><span class="k">' + k[0] + '</span><span class="v">' + k[1] + '</span></div>'; }).join("") + '</div>';
    };
    const vErr = C.validateCalcFixtures();
    let h = vErr.length === 0
      ? '<div class="okbar" id="verifyBar">✅ 本家一致チェック: 全項目 1円一致（売上 / 経費 / 粗利 / 客単価 / 給与）</div>'
      : '<div class="errbar" id="verifyBar">⚠️ 本家一致チェックに差異（' + vErr.length + '件）: ' + esc(vErr[0].label) + ' 実測' + vErr[0].got + '/期待' + vErr[0].want + '</div>';
    h += '<div class="section-title">月間 <span class="pill">2026年8月</span> <span class="pill ' + (achieve >= 100 ? 'up' : '') + '">目標達成率 ' + achieve + '%</span></div>';
    h += '<div class="row">'
      + card('店舗状況', '#8b5cf6', num(m.guests) + '<span class="unit">人</span> / ' + num(m.groups) + '<span class="unit">組</span>', '',
          [['客単価', yen(m.custAvg)], ['組単価', yen(m.groupAvg)], [t('本指名') + '本計', yen(m.joshiHonkei)], ['タグ対象額', yen(m.tagTarget)]])
      + card('売上累計', '#4a9eff', yen(m.salesTotal), '',
          [['現金', yen(m.cash)], ['売掛', yen(m.credit)], ['カード', yen(m.card)]])
      + card('経費累計', '#ff5c5c', yen(m.expenseTotal), '',
          [['人件費-女子', yen(m.laborFemale)], ['人件費-男子', yen(m.laborMale)], ['諸経費', yen(m.misc)]])
      + card('入金累計', '#f0c020', yen(m.deposit), '',
          [['粗利', '<span class="pos">' + yen(m.grossProfit) + '</span>']])
      + '</div>';
    // 当日は伝票から導出（固定値を置かない＝伝票を1枚足せば全部動く）
    const TD = C.todayAggregate(D.day0824.bills, D.day0824.attendance);
    const st = TD.settled;
    h += '<div class="section-title">当日 <span class="pill">2026/8/24(月)</span></div>';
    h += '<div class="row">'
      + card('店舗状況', '#8b5cf6', st.guests + '<span class="unit">人</span> / ' + st.groups + '<span class="unit">組</span>', '',
          [['客単価', yen(st.perGuest)], ['組単価', yen(st.perGroup)], [t('本指名') + '本計', yen(st.reqHon)],
           ['<span class="mut" style="font-size:11px">※精算済のみ</span>', '<span class="mut" style="font-size:11px">未精算' + yen(TD.unsettled.sales) + 'はリアルタイム</span>']])
      + card('売上', '#4a9eff', yen(st.sales), '', [['現金', yen(st.cash)], ['カード', yen(st.card)]])
      + card('経費', '#ff5c5c', yen(d0824.expenseTotal), '', [['人件費-女子', yen(TD.joshiPay)]])
      + card('入金', '#f0c020', yen(d0824.deposit || 0), '', [['粗利', '<span class="pos">' + yen(st.sales + (d0824.deposit || 0) - d0824.expenseTotal) + '</span>']])
      + '</div>';
    h += '<div class="card" style="margin-top:16px"><h3><span class="cap" style="background:#3fb950"></span>売上推移</h3>' + salesChart(D.financeDaily) + '</div>';
    return h;
  }

  // ---------- 収支明細（月次） ----------
  function balance() {
    const rows = D.financeDaily;
    const agg = C.monthAggregate(rows);
    const biz = rows.filter(function (r) { return !r.holiday; });
    const ser = function (k) { return biz.map(function (r) { return r[k]; }); };
    let h = '<div class="row" style="margin-bottom:16px">'
      + kpi('売上', yen(agg.salesTotal), '#4a9eff', ser('salesTotal')) + kpi('入金', yen(agg.deposit), '#f0c020', ser('deposit'))
      + kpi('経費', yen(agg.expenseTotal), '#ff5c5c', ser('expenseTotal')) + kpi('粗利', yen(agg.grossProfit), '#3fb950', ser('grossProfit')) + '</div>';
    h += '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">'
      + '<div class="seg"><button class="on">月次</button><button onclick="APP.toast(\'日次は準備中です\')">日次</button></div>'
      + '<div><button class="btn sm" onclick="APP.exportCSV(&#39;balance&#39;)">Excel</button> <button class="btn sm" onclick="APP.exportCSV(&#39;balance&#39;)">Excel(All)</button> <button class="btn sm ghost" onclick="APP.exportCSV(&#39;balance&#39;)">旧Excel</button></div></div>';
    // ヒートマップ（粗利）
    h += '<div class="card" style="margin-bottom:16px"><h3>曜日別 粗利ヒートマップ</h3>' + heatmap(rows) + '</div>';
    // テーブル
    const cols = ['日付', '現金', '売掛', 'カード', '売上計', 'リクエスト小計', '同伴小計', '残り支給額', '給率', '男子日払い', '女子日払い', 'マイナス', '入金', '出金', '経費計', '粗利'];
    let tb = '<div class="tablewrap"><table><thead><tr>' + cols.map(function (c, i) { return '<th class="' + (i === 0 ? 'l stickyc' : '') + '">' + c + '</th>'; }).join("") + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      if (r.holiday) { tb += '<tr class="holiday"><td class="l stickyc">' + fmtDate(r) + '</td><td colspan="15" class="l" style="color:var(--muted)">休み</td></tr>'; return; }
      const neg = r.grossProfit < 0;
      tb += '<tr' + (neg ? ' class="neg-row"' : '') + '>'
        + '<td class="l stickyc">' + fmtDate(r) + '</td>'
        + cell(r.cash) + cell(r.credit) + cell(r.card) + cell(r.salesTotal) + cell(r.reqSub) + cell(r.dohanSub)
        + cell(r.remainingPay) + '<td>' + (r.payRate ? r.payRate.toFixed(2) + '%' : '--') + '</td>'
        + cell(r.maleDaily) + cell(r.femaleDaily) + cell(r.minus) + cell(r.deposit) + cell(r.withdrawal) + cell(r.expenseTotal)
        + '<td class="' + (neg ? 'neg' : 'pos') + '">' + num(r.grossProfit) + '</td></tr>';
    });
    tb += '<tr class="total"><td class="l stickyc">合計</td>' + cell(agg.cash) + cell(agg.credit) + cell(agg.card) + cell(agg.salesTotal)
      + cell(agg.reqSub) + cell(agg.dohanSub) + cell(agg.remainingPay) + '<td>' + (D.monthSummary.salesTotal ? (D.monthSummary.laborFemale / D.monthSummary.salesTotal * 100).toFixed(2) + '%' : '--') + '</td>'
      + cell(agg.maleDaily) + cell(agg.femaleDaily) + cell(agg.minus) + cell(agg.deposit) + cell(agg.withdrawal) + cell(agg.expenseTotal)
      + '<td class="pos">' + num(agg.grossProfit) + '</td></tr>';
    tb += '</tbody></table></div>';
    h += tb + '<div class="muted-note">赤字日は赤背景でハイライト。ヒートマップの濃さ＝粗利の大きさ。</div>';
    return h;
  }
  function fmtDate(r) {
    const d = +r.date.slice(-2); const cls = r.dow === '日' ? 'sun' : r.dow === '土' ? 'sat' : '';
    return '<span class="' + cls + '">' + ('08/' + String(d).padStart(2, '0')) + ' ' + r.dow + '</span>';
  }
  function cell(v) { return '<td>' + (v ? num(v) : '--') + '</td>'; }
  function kpi(label, val, color, series) {
    const spark = series ? sparkline(series, color) : '';
    return '<div class="card" style="flex:1;min-width:150px"><h3><span class="cap" style="background:' + color + '"></span>' + label + '</h3><div class="big">' + val + '</div>' + spark + '</div>';
  }
  // Pinterest定番: KPIカードのスパークライン（日次の推移を小さく）
  function sparkline(vals, color) {
    const v = vals.filter(function (x) { return typeof x === 'number'; });
    if (!v.length) return '';
    const W = 240, H = 40, min = Math.min.apply(null, v), max = Math.max.apply(null, v), rng = (max - min) || 1;
    const step = W / (v.length - 1 || 1);
    const pts = v.map(function (x, i) { return [i * step, H - ((x - min) / rng) * (H - 6) - 3]; });
    const line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    const area = 'M0 ' + H + ' ' + line.replace('M', 'L') + ' L' + W + ' ' + H + ' Z';
    const gid = 'g' + Math.round(min + max + v.length);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:38px;margin-top:8px;display:block">'
      + '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".28"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>'
      + '<path d="' + area + '" fill="url(#' + gid + ')"/><path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
  }
  function heatmap(rows) {
    const dows = ['日', '月', '火', '水', '木', '金', '土'];
    let h = '<div class="heat">' + dows.map(function (d) { return '<div style="text-align:center;color:var(--muted);font-size:11px">' + d + '</div>'; }).join("");
    const max = Math.max.apply(null, rows.map(function (r) { return r.grossProfit; }).concat([1]));
    // 先頭の空白（8/1は土曜）
    const first = rows[0]; let pad = dows.indexOf(first.dow);
    for (let i = 0; i < pad; i++) h += '<div></div>';
    rows.forEach(function (r) {
      if (r.holiday) { h += '<div class="d" style="background:#f0ece2;color:#b3ad9d">' + (+r.date.slice(-2)) + '</div>'; return; }
      const ratio = Math.max(0, r.grossProfit) / max;
      const bg = r.grossProfit < 0 ? '#ff5c5c' : 'rgba(31,157,87,' + (0.30 + ratio * 0.70).toFixed(2) + ')';
      h += '<div class="d" title="' + r.date + ' ' + yen(r.grossProfit) + '" style="background:' + bg + '"><span>' + (+r.date.slice(-2)) + '</span><span style="font-size:9px">' + Math.round(r.grossProfit / 1000) + 'k</span></div>';
    });
    return h + '</div>';
  }

  // ---------- リアルタイム集計（給与エンジン実演） ----------
  function realtime() {
    const d = D.day0824;
    let h = '<div class="okbar">🟢 営業中モード（2026/8/24 月）— 未精算も含むライブ集計</div>';
    // 営業日報
    h += '<div class="row" style="margin-bottom:16px">'
      + kpi('総売上', yen(C.todayAggregate(d.bills, d.attendance).all.sales), '#4a9eff')
      + kpi('未精算', yen(C.todayAggregate(d.bills, d.attendance).unsettled.sales), '#f0a02c')
      + kpi('精算済', yen(C.todayAggregate(d.bills, d.attendance).settled.sales), '#3fb950')
      + kpi('女子給料', yen(C.todayAggregate(d.bills, d.attendance).joshiPay), '#ff8fbf') + '</div>';
    // 営業日報（当日/未精算/精算済 の3列比較・本家同等）
    const A = C.todayAggregate(d.bills, d.attendance), U = A.unsettled, S = A.settled;
    const report3 = [
      ['総売上', A.all.sales, U.sales, S.sales], ['現金売上', A.all.cash, U.cash, S.cash],
      ['カード売上', A.all.card, U.card, S.card], ['売掛', A.all.credit, U.credit, S.credit],
      ['女子売上', A.all.joshiSales, U.joshiSales, S.joshiSales], ['女子給料', A.joshiPay, 0, 0],
    ];
    h += '<div class="card" style="margin-bottom:16px"><h3>営業日報</h3><div class="tablewrap"><table><thead><tr><th class="l">項目</th><th>当日</th><th>未精算</th><th>精算済</th></tr></thead><tbody>'
      + report3.map(function (r) { return '<tr><td class="l">' + r[0] + '</td><td>' + yen(r[1]) + '</td><td>' + yen(r[2]) + '</td><td>' + yen(r[3]) + '</td></tr>'; }).join('')
      + '<tr><td class="l">客組人数</td><td>' + A.all.groups + '組' + A.all.guests + '名</td><td>' + U.groups + '組' + U.guests + '名</td><td>' + S.groups + '組' + S.guests + '名</td></tr>'
      + '<tr><td class="l">客単価</td><td>' + yen(A.all.perGuest) + '</td><td>' + yen(U.perGuest) + '</td><td>' + yen(S.perGuest) + '</td></tr>'
      + '<tr><td class="l">キャスト数</td><td>出勤' + A.castCount + '人</td><td>店内客' + U.guests + '人</td><td>待機—</td></tr>'
      + '</tbody></table></div><div class="muted-note">「まとめ」は精算済ベース、リアルタイムは未精算(進行中の伝票)も含む。</div></div>';
    // 出勤キャスト
    h += '<div class="card" style="margin-bottom:16px"><h3>現在出勤キャスト</h3><div class="row">'
      + d.attendance.map(function (a) {
        return '<div class="tag" style="font-size:14px;padding:8px 14px">🟢 ' + a.cast + ' <span class="mut" style="font-size:12px">' + a.start + '〜</span></div>';
      }).join("") + '</div></div>';
    // 伝票一覧
    let bl = '<div class="card" style="margin-bottom:16px"><h3>伝票一覧（当日）</h3><div class="tablewrap"><table><thead><tr>'
      + '<th class="l">№</th><th>入店</th><th>退店</th><th>卓</th><th>客数</th><th class="l">指名</th><th>現金</th><th>カード</th><th>合計</th><th>状態</th></tr></thead><tbody>';
    d.bills.forEach(function (b) {
      const nm = (b.req || []).map(function (x) { return t('本指名') + ':' + esc(x.cast) + '(' + x.count + ')'; })
        .concat((b.field || []).map(function (x) { return t('場内指名') + ':' + esc(x.cast) + '(' + x.count + ')'; }))
        .concat((b.dohan || []).map(function (x) { return t('同伴') + ':' + esc(x.cast) + '(' + x.count + ')'; })).join(' / ') || '--';
      const total = (b.cash || 0) + (b.card || 0) + (b.credit || 0);
      bl += '<tr><td class="l">' + b.no + '</td><td>' + esc(b.in) + '</td><td>' + esc(b.out) + '</td><td>' + b.table + '</td><td>' + b.guests + '</td>'
        + '<td class="l" style="white-space:normal;max-width:260px">' + nm + '</td>' + cell(b.cash) + cell(b.card)
        + '<td>' + num(total) + '</td><td>' + (b.settled ? '<span class="pos">精算済</span>' : '<span class="mut">未精算</span>') + '</td></tr>';
    });
    bl += '</tbody></table></div></div>';
    h += bl;
    // 勤怠報告（給与エンジンでライブ計算）
    let at = '<div class="card"><h3>勤怠報告（給与を自動計算）</h3><div class="tablewrap"><table><thead><tr>'
      + '<th class="l">キャスト</th><th>' + t('本指名') + '</th><th>' + t('同伴') + '</th><th>' + t('場内指名') + '</th><th>ドリンク</th>'
      + '<th>バック計</th><th>総支給額</th><th>厚生費</th><th>支給額</th><th>残り支給額</th></tr></thead><tbody>';
    let tot = { back: 0, gross: 0, welfare: 0, net: 0 };
    d.attendance.forEach(function (a) {
      const p = C.castPayroll(a);
      const dq = (a.drinks || []).reduce(function (s, x) { return s + x.qty; }, 0);
      tot.back += p.back; tot.gross += p.gross; tot.welfare += p.welfare; tot.net += p.net;
      at += '<tr><td class="l">' + a.cast + '</td><td>' + (a.req.count || '--') + '</td><td>' + (a.dohan.count || '--') + '</td>'
        + '<td>' + (a.field.count || '--') + '</td><td>' + dq + '杯</td>'
        + '<td>' + num(p.back) + '</td><td>' + num(p.gross) + '</td><td>' + num(p.welfare) + '</td><td>' + num(p.shikyu) + '</td>'
        + '<td class="pos">' + num(p.net) + '</td></tr>';
    });
    at += '<tr class="total"><td class="l">合計</td><td colspan="4"></td><td>' + num(tot.back) + '</td><td>' + num(tot.gross)
      + '</td><td>' + num(tot.welfare) + '</td><td></td><td>' + num(tot.net) + '</td></tr>';
    at += '</tbody></table></div><div class="muted-note">この表の給与は計算エンジンがリアルタイム計算（本家の勤怠報告と1円一致）。</div></div>';
    h += at;
    return h;
  }

  // ---------- 売上商品集計 ----------
  function items(sub) {
    const view = sub || 'rank';
    let h = '<div class="seg" style="margin-bottom:14px">'
      + '<button class="' + (view === 'rank' ? 'on' : '') + '" onclick="APP.go(\'items\')">ランキング</button>'
      + '<button class="' + (view === 'daily' ? 'on' : '') + '" onclick="APP.goSub(\'items\',\'daily\')">商品別・日別</button>'
      + '<button onclick="APP.go(\'castItems\')">キャスト別</button></div>';
    if (view === 'daily') return h + itemDailyGrid();
    const entries = Object.keys(D.itemTotals).map(function (k) { return [k, D.itemTotals[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    const max = entries[0][1];
    h += '<div class="card"><h3>商品別 売上数量ランキング（2026年8月）</h3>';
    entries.forEach(function (e, i) {
      const p = C.productByName(e[0]);
      const known = p && p.price > 0;
      const sales = known ? yen(p.price * e[1]) : '<span class="mut">単価未登録</span>';
      const back = known ? 'B ' + yen(p.backAmt * e[1]) : '';
      h += '<div class="rank"><div class="no ' + (i === 0 ? 'g1' : '') + '">' + (i + 1) + '</div>'
        + '<div style="width:150px">' + esc(e[0]) + '</div><div class="bar"><i style="width:' + (e[1] / max * 100) + '%"></i></div>'
        + '<div style="width:60px;text-align:right">' + num(e[1]) + '個</div>'
        + '<div style="width:110px;text-align:right" class="mut">' + sales + '</div>'
        + '<div style="width:100px;text-align:right;color:#ff8fbf">' + back + '</div></div>';
    });
    h += '</div>';
    return h;
  }
  function itemDailyGrid() {
    const cols = D.itemDailyCols;
    const dates = Object.keys(D.itemDaily).sort();
    const colTot = cols.map(function () { return 0; });
    let body = '';
    dates.forEach(function (dt) {
      const arr = D.itemDaily[dt]; const d = +dt.slice(-2);
      const dow = (D.financeDaily.find(function (r) { return r.date === dt; }) || {}).dow || '';
      body += '<tr><td class="l stickyc">08/' + String(d).padStart(2, '0') + ' ' + dow + '</td>'
        + arr.map(function (v, i) { colTot[i] += v; return '<td>' + (v ? v : '') + '</td>'; }).join('') + '</tr>';
    });
    const grand = colTot.reduce(function (a, b) { return a + b; }, 0);
    let h = '<div class="tablewrap"><table><thead><tr><th class="l stickyc">日付</th>'
      + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + body
      + '<tr class="total"><td class="l stickyc">観測分 計</td>' + colTot.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr>'
      + '</tbody></table></div>';
    h += '<div class="muted-note">商品×日のクロス集計（本家の「商品別・日別集計」）。'
      + '観測分合計 ' + grand + '個。月間の正値は キャストドリンクS ' + D.itemTotals['キャストドリンクS']
      + '個 等（一部の日は集計中）。</div>';
    return h;
  }
  // 合計を配分（最大剰余法で整数・合計一致）
  function distribute(total, shares) {
    const sum = shares.reduce(function (a, b) { return a + b; }, 0) || 1;
    const raw = shares.map(function (s) { return total * s / sum; });
    const base = raw.map(Math.floor); let rem = total - base.reduce(function (a, b) { return a + b; }, 0);
    const order = raw.map(function (v, i) { return [i, v - Math.floor(v)]; }).sort(function (a, b) { return b[1] - a[1]; });
    for (let i = 0; i < rem; i++) base[order[i % order.length][0]]++;
    return base;
  }
  function castItems() {
    // 実績のある商品 × キャスト9人 の完全クロス集計（個数）。CDrinkS実測シェアで各商品を配分。
    const share = { "しずく🌙": 172, "べる☆": 123, "はるか🌻": 83, "ゆき❄️": 49, "リリ☆": 47, "みずき☆": 46, "りく🎣": 44, "りん🔔": 36, "らん🍖": 17 };
    const castNames = Object.keys(share);
    let prods = Object.keys(D.itemTotals);
    // grid[cast][prod]
    const grid = {}; castNames.forEach(function (c) { grid[c] = {}; });
    Object.keys(D.itemTotals).forEach(function (pn) {
      const alloc = distribute(D.itemTotals[pn], castNames.map(function (c) { return share[c]; }));
      castNames.forEach(function (c, i) { grid[c][pn] = alloc[i]; });
    });
    // 「0個を除外」＝どのキャストも0の商品列を隠す
    if (_hideZeroCast) prods = prods.filter(function (pn) { return castNames.some(function (c) { return grid[c][pn] > 0; }); });
    let h = '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<div class="seg"><button onclick="APP.go(\'items\')">商品別</button><button class="on">キャスト別</button></div>'
      + '<div><label style="margin-right:8px"><input type="checkbox"' + (_hideZeroCast ? ' checked' : '') + ' onchange="APP.toggleCastZero(this.checked)" style="width:auto;min-height:auto"> 0個を除外</label>'
      + '<button class="btn sm" onclick="APP.exportCSV(&#39;castitem&#39;)">Excel</button></div></div>';
    h += '<div class="tablewrap"><table><thead><tr><th class="l stickyc">キャスト</th>' + prods.map(function (p) { return '<th>' + esc(p) + '</th>'; }).join('') + '<th>計</th></tr></thead><tbody>';
    const colTot = {}; prods.forEach(function (p) { colTot[p] = 0; }); let grand = 0;
    castNames.forEach(function (c) {
      let rowTot = 0;
      const cells = prods.map(function (p) { const v = grid[c][p]; colTot[p] += v; rowTot += v; return '<td>' + (v || '') + '</td>'; }).join('');
      grand += rowTot;
      h += '<tr><td class="l stickyc">' + esc(c) + '</td>' + cells + '<td>' + rowTot + '</td></tr>';
    });
    h += '<tr class="total"><td class="l stickyc">計</td>' + prods.map(function (p) { return '<td>' + colTot[p] + '</td>'; }).join('') + '<td>' + grand + '</td></tr>';
    return h + '</tbody></table></div><div class="muted-note">キャスト×商品の完全クロス集計（個数）。列合計は商品別集計と一致（キャストドリンクS ' + D.itemTotals['キャストドリンクS'] + '個 等）。個別配分は実測シェアに基づくデモ値。</div>';
  }

  // ---------- キャスト給与（月次サマリ） ----------
  function castsScreen() {
    // 観測できた per-cast 指標（名前/勤務日数/時間報酬/給率/残り支給額）。他列は月合計のみ観測。
    const rows = [
      ['しずく🌙', 15, 164666, 37.2, 285360], ['べる☆', 17, 173775, 58, 145402], ['はるか🌻', 9, 96499, 48.7, 136062],
      ['リリ☆', 3, 36734, 31.3, 49021], ['ゆき❄️', 11, 61800, 90.7, 73485], ['りく🎣', 8, 55250, 147, 34344],
      ['りん🔔', 9, 49334, 125.6, 12680], ['みずき☆', 11, 73800, 858.5, 56900], ['らん🍖', 7, 27750, 0, 23035],
    ];
    // 月合計（本家 /cast の合計行・観測値）
    const T = { orderSub:1175100, reqSub:2030500, dohanSub:561600, wagePay:739608,
      reqBack:105500, fieldBack:10500, dohanBack:28000, drinkBack:233400, bottleBack:16300, foodBack:350,
      bonus:0, welfare:113369, dailyPay:190000, minus:14000, remaining:816289, payRate:55.8, days:90 };
    const cols = ['No','キャスト','属性','勤務','オーダー小計','リクエスト小計','同伴小計','時間報酬',
      'リクエストB','場内B','同伴B','ドリンクB','ボトルB','フードB','ボーナス','厚生費','日払い','マイナス','給率','残り支給額'];
    let h = '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px"><div class="pill">末日締め・2026年8月</div>'
      + '<div><button class="btn sm" onclick="APP.exportCSV(&#39;export&#39;)">Excel</button> '
      + '<button class="btn sm" onclick="APP.exportCSV(&#39;export&#39;)">旧Excel</button> '
      + '<button class="btn sm gold" onclick="APP.printPaySlip(&#39;cast&#39;)">報酬明細PDF</button></div></div>';
    h += '<div class="tablewrap"><table><thead><tr>' + cols.map(function (c, i) { return '<th class="' + (i === 1 ? 'l stickyc' : '') + '">' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
    const dash = '<td class="mut">—</td>';
    rows.forEach(function (r, i) {
      const cast = D.casts.find(function (x) { return x.name === r[0]; }) || {};
      h += '<tr><td>' + (cast.id || (i + 1)) + '</td><td class="l stickyc">' + esc(r[0]) + '</td>'
        + '<td class="mut">' + (cast.attr === 'dispatch' ? '派遣' : cast.attr === 'trial' ? '体入' : '通常') + '</td>'
        + '<td>' + r[1] + '</td>' + dash + dash + dash + '<td>' + num(r[2]) + '</td>'
        + dash + dash + dash + dash + dash + dash + dash + dash + dash + dash
        + '<td>' + r[3] + '%</td><td class="pos">' + num(r[4]) + '</td></tr>';
    });
    h += '<tr class="total"><td></td><td class="l stickyc">合計</td><td></td><td>' + T.days + '</td>'
      + '<td>' + num(T.orderSub) + '</td><td>' + num(T.reqSub) + '</td><td>' + num(T.dohanSub) + '</td><td>' + num(T.wagePay) + '</td>'
      + '<td>' + num(T.reqBack) + '</td><td>' + num(T.fieldBack) + '</td><td>' + num(T.dohanBack) + '</td><td>' + num(T.drinkBack) + '</td><td>' + num(T.bottleBack) + '</td><td>' + num(T.foodBack) + '</td>'
      + '<td>' + (T.bonus || '—') + '</td><td>' + num(T.welfare) + '</td><td>' + num(T.dailyPay) + '</td><td>' + num(T.minus) + '</td>'
      + '<td>' + T.payRate + '%</td><td class="pos">' + num(T.remaining) + '</td></tr>';
    h += '</tbody></table></div>';
    h += '<div class="muted-note">キャスト給与の一覧です。<b>合計行は本家と一致</b>（オーダー小計¥1,175,100 / 時間報酬¥739,608 / 厚生費¥113,369 等）。'
      + '「—」の個別内訳（各バック・厚生費・日払い等のキャスト別）は本家CSV/明細を取得すれば全セル埋まります。'
      + '給率＝総支給額 ÷ 売上本計 × 100（100%超＝売上に対し給与が高い）。</div>';
    return h;
  }
  function staffScreen() {
    // No/名前/労働日数/総支給額/支給額/残り支給額/厚生費/日払い/賞与/罰金（本家 /staff）
    const rows = [
      { name: D.staff[0].name, days: 0, gross: 0, pay: 0, remain: 0, welfare: 0, daily: 0, bonus: 0, fine: 0 },
      { name: D.staff[1].name, days: 18, gross: 160000, pay: 160000, remain: -15000, welfare: 0, daily: 175000, bonus: 0, fine: 0 },
    ];
    let h = '<div class="row" style="justify-content:space-between;margin-bottom:12px"><div class="pill">末日締め・2026年8月</div>'
      + '<div><button class="btn sm" onclick="APP.exportCSV(&#39;staff&#39;)">Excel/CSV</button> <button class="btn sm gold" onclick="APP.printPaySlip(&#39;staff&#39;)">報酬明細PDF</button></div></div>';
    h += '<div class="tablewrap"><table id="staffPay"><thead><tr><th>No</th><th class="l">名前</th><th>労働日数</th><th>総支給額</th><th>支給額</th><th>厚生費</th><th>残り支給額</th><th>日払い</th><th>賞与</th><th>罰金</th></tr></thead><tbody>';
    let T = { days: 0, gross: 0, pay: 0, welfare: 0, remain: 0, daily: 0, bonus: 0, fine: 0 };
    rows.forEach(function (r, i) {
      Object.keys(T).forEach(function (k) { T[k] += r[k] || 0; });
      h += '<tr><td>' + (D.staff[i] ? D.staff[i].id : i + 1) + '</td><td class="l">' + esc(r.name) + '</td><td>' + r.days + '</td><td>' + num(r.gross) + '</td><td>' + num(r.pay) + '</td><td>' + num(r.welfare) + '</td>'
        + '<td class="' + (r.remain < 0 ? 'neg' : '') + '">' + num(r.remain) + '</td><td>' + num(r.daily) + '</td><td>' + num(r.bonus) + '</td><td>' + num(r.fine) + '</td></tr>';
    });
    h += '<tr class="total"><td></td><td class="l">合計</td><td>' + T.days + '</td><td>' + num(T.gross) + '</td><td>' + num(T.pay) + '</td><td>' + num(T.welfare) + '</td>'
      + '<td class="' + (T.remain < 0 ? 'neg' : '') + '">' + num(T.remain) + '</td><td>' + num(T.daily) + '</td><td>' + num(T.bonus) + '</td><td>' + num(T.fine) + '</td></tr>';
    h += '</tbody></table></div><div class="muted-note">支給額＝総支給額−厚生費(スタッフは対象外0)−罰金。残り支給額＝支給額−日払い（前借り過多でマイナス）。賞与/罰金はスタッフ固有項目。</div>';
    return h;
  }

  // ---------- タグ集計 ----------
  function tagsScreen() {
    // 集客担当タグごとの集計（観測: ケンジ合計。他タグはデモ配分で全タグ表示）
    const rows = [
      { name: D.tags[2].name, color: D.tags[2].color, cnt: 7, guests: 19, sub: 127500, cash: 88700, card: 59800, credit: 0, sales: 148500 },
      { name: D.tags[0].name, color: D.tags[0].color, cnt: 0, guests: 0, sub: 0, cash: 0, card: 0, credit: 0, sales: 0 },
      { name: D.tags[1].name, color: D.tags[1].color, cnt: 0, guests: 0, sub: 0, cash: 0, card: 0, credit: 0, sales: 0 },
    ];
    let h = '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<div class="seg"><button class="on">タグ別</button><button onclick="APP.toast(&#39;色別集計（デモ）&#39;)">色別集計</button><button onclick="APP.toast(&#39;日毎集計（デモ）&#39;)">日毎集計</button></div>'
      + '<div><button class="btn sm" onclick="APP.copyTable()">Copy</button> <button class="btn sm" onclick="APP.exportCSV(&#39;tag&#39;)">CSV</button> <button class="btn sm" onclick="APP.exportCSV(&#39;tag&#39;)">Excel</button></div></div>';
    h += '<div class="card"><h3>タグ集計（2026年8月度）— 集客担当別</h3><div class="tablewrap"><table><thead><tr>'
      + '<th class="l">タグ</th><th>件数</th><th>客数</th><th>伝票小計</th><th>現金</th><th>カード</th><th>売掛</th><th>販売額</th></tr></thead><tbody>';
    const T = { cnt: 0, guests: 0, sub: 0, cash: 0, card: 0, credit: 0, sales: 0 };
    rows.forEach(function (r) {
      Object.keys(T).forEach(function (k) { T[k] += r[k]; });
      h += '<tr><td class="l"><span class="dot" style="background:' + r.color + '"></span> ' + esc(r.name) + '</td>'
        + '<td>' + r.cnt + '</td><td>' + r.guests + '</td>' + cell(r.sub) + cell(r.cash) + cell(r.card) + cell(r.credit) + '<td>' + num(r.sales) + '</td></tr>';
    });
    h += '<tr class="total"><td class="l">合計</td><td>' + T.cnt + '</td><td>' + T.guests + '</td>' + cell(T.sub) + cell(T.cash) + cell(T.card) + cell(T.credit) + '<td>' + num(T.sales) + '</td></tr>';
    h += '</tbody></table></div><div class="muted-note">販売額 ' + num(T.sales) + ' ＝ まとめの「タグ対象額」と一致。タグ＝集客担当（●＋色）。1伝票に複数タグ→タグごとに計上。色別/日毎/CSV/Copy/Excel出力対応。</div></div>';
    return h;
  }

  // ---------- お客さま管理 ----------
  function customers(sub) {
    const TABS = [['analysis', 'お客さま分析'], ['list', 'お客さま一覧'], ['keep', 'キープ管理']];
    const view = sub || 'analysis';
    let h = '<div class="seg" style="margin-bottom:14px">' + TABS.map(function (tb) { return '<button class="' + (view === tb[0] ? 'on' : '') + '" onclick="APP.goSub(\'customers\',\'' + tb[0] + '\')">' + tb[1] + '</button>'; }).join('') + '</div>';
    return h + ({ analysis: _cAnalysis, list: _cList, keep: _cKeep }[view] || _cAnalysis)();
  }
  function _cAnalysis() {
    const cs = D.customers, cnt = function (r) { return cs.filter(function (c) { return c.rank === r; }).length; };
    const ranks = [['S', '#d5493f'], ['A', '#e0a32c'], ['B', '#2f6feb'], ['C', '#1f9d57'], ['D', '#a6a091']];
    let h = '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px">'
      + '<div class="seg"><button class="on">今月</button><button onclick="APP.toast(&#39;期間切替（デモ）&#39;)">先月</button><button onclick="APP.toast(&#39;期間切替（デモ）&#39;)">直近3ヶ月</button></div>'
      + '<button class="btn sm" onclick="APP.exportCSV(&#39;customer&#39;)">Excel</button></div>';
    h += '<div class="row" style="margin-bottom:6px">' + ranks.map(function (r) {
      return '<div class="card" style="flex:1;text-align:center;min-width:110px"><div class="big" style="color:' + r[1] + '">' + r[0] + '</div><div class="big" style="font-size:20px">' + cnt(r[0]) + '<span class="unit">人</span></div></div>';
    }).join('') + '</div>';
    h += '<div class="tablewrap"><table><thead><tr><th class="l">お客さま</th><th>ランク</th><th>状態</th><th>キープ</th><th>来店回数</th><th>最終来店</th><th>初回来店</th><th>単価</th><th class="l">担当</th><th class="l">属性</th></tr></thead><tbody>';
    cs.forEach(function (c) {
      const hasKeep = D.keeps.some(function (k) { return k.customer === c.name; });
      h += '<tr><td class="l">' + esc(c.name) + '</td><td>' + c.rank + '</td><td class="mut">' + (c.visits > 0 ? '常連' : '休眠') + '</td>'
        + '<td>' + (hasKeep ? '有' : '—') + '</td><td>' + c.visits + '</td><td class="mut">' + c.last + '</td><td class="mut">' + c.first + '</td>'
        + '<td>' + yen(c.avg) + '</td><td class="l">' + esc(c.main || '—') + '</td><td class="l" style="white-space:normal;max-width:200px">'
        + c.attrs.map(function (a) { return '<span class="tag" style="font-size:11px">' + esc(a) + '</span>'; }).join(' ') + '</td></tr>';
    });
    return h + '</tbody></table></div><div class="muted-note">ランクは直近3ヶ月の来店回数で自動判定（S20/A10/B5/C1/D）。名前クリックで顧客詳細（デモ）。</div>';
  }
  function _cList() {
    let h = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="pill">登録数 ' + D.customers.length + ' / お気に入り 0 (最大200)</div>'
      + '<div><button class="btn sm gold" onclick="APP.newCustomer()">＋ 新規追加</button> <button class="btn sm" onclick="APP.toast(&#39;自動保存済み&#39;)">一括保存</button> <button class="btn sm" onclick="APP.exportCSV(&#39;customer&#39;)">Excel連携</button></div></div>';
    h += '<div class="tablewrap"><table><thead><tr><th>☆お気に入り</th><th>番号</th><th class="l">名前</th><th class="l">あだ名</th><th class="l">紹介元</th><th class="l">担当</th><th class="l">属性</th><th class="l">電話番号</th><th>操作</th></tr></thead><tbody>';
    D.customers.forEach(function (c) {
      h += '<tr><td>☆</td><td>' + c.no + '</td><td class="l"><input type="text" value="' + esc(c.name) + '" data-save-key="cust:' + c.no + ':name" style="width:110px"></td>'
        + '<td class="l mut">—</td><td class="l mut">—</td><td class="l">' + esc(c.main || '—') + '</td>'
        + '<td class="l">' + c.attrs.slice(0, 2).map(function (a) { return '<span class="tag" style="font-size:11px">' + esc(a) + '</span>'; }).join(' ') + '</td>'
        + '<td class="l"><input type="text" value="' + esc(c.phone || '') + '" data-save-key="cust:' + c.no + ':tel" style="width:120px"></td>'
        + '<td class="mut" style="font-size:12px">編集/削除</td></tr>';
    });
    return h + '</tbody></table></div><div class="muted-note">インライン編集→自動保存。☆でお気に入り登録（アプリ最初に出る顧客・最大200）。項目（あだ名/紹介元/生年月日/会社名/役職/結婚/電話）は設定＞お客さまの項目定義で増減。</div>';
  }
  function _cKeep() {
    const ks = D.keeps;
    const cards = [['有効キープ', ks.length, '#1f9d57'], ['期限切れ', 0, '#a6a091'], ['期限間近', ks.filter(function (k) { return k.memo.indexOf('間近') >= 0; }).length, '#e0a32c'], ['残量少', ks.filter(function (k) { return k.remain.indexOf('残少') >= 0; }).length, '#d5493f']];
    let h = '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><div class="seg"><button class="on">一覧</button><button onclick="APP.toast(&#39;カレンダー表示（デモ）&#39;)">カレンダー</button><button onclick="APP.toast(&#39;期限リスト（デモ）&#39;)">期限リスト</button></div>'
      + '<button class="btn sm gold" onclick="APP.toast(&#39;キープ新規登録（デモ）&#39;)">＋ 新規登録</button></div>';
    h += '<div class="row" style="margin-bottom:6px">' + cards.map(function (c) { return '<div class="card" style="flex:1;text-align:center;min-width:110px"><div class="mut">' + c[0] + '</div><div class="big" style="font-size:22px;color:' + c[2] + '">' + c[1] + '<span class="unit">件</span></div></div>'; }).join('') + '</div>';
    h += '<div class="tablewrap"><table><thead><tr><th class="l">メニュー名</th><th>価格</th><th>残量</th><th>開始日</th><th>有効期限</th><th class="l">お客さま</th><th class="l">ネームタグ</th><th class="l">メモ</th><th>操作</th></tr></thead><tbody>';
    ks.forEach(function (k) {
      h += '<tr><td class="l">' + esc(k.product) + '</td><td>' + yen(k.price) + '</td><td>' + esc(k.remain) + '</td><td class="mut">' + k.start + '</td><td class="mut">' + k.expire + '</td>'
        + '<td class="l">' + esc(k.customer) + '</td><td class="l mut">' + esc(k.nameTag) + '</td><td class="l mut">' + esc(k.memo || '—') + '</td><td class="mut" style="font-size:12px">編集/消込</td></tr>';
    });
    return h + '</tbody></table></div><div class="muted-note">キープ（ボトル取り置き）を管理。有効期限が近いものは自動でアラート。既定の有効期限は設定＞お客さまで変更（現在' + D.keepDefaultMonths + 'ヶ月）。</div>';
  }

  // ---------- 現金管理（レジ精算） ----------
  function cash() {
    const denoms = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1];
    let h = '<div class="section-title">レジ精算 — 2026/8/24</div><div class="row">';
    h += '<div class="card" style="flex:1;min-width:280px"><h3>金種入力</h3><div class="tablewrap"><table id="cashTable"><thead><tr><th>金種</th><th>枚数</th><th>金額</th></tr></thead><tbody>'
      + denoms.map(function (d) { return '<tr><td>' + num(d) + '</td><td><input type="number" min="0" step="1" value="0" data-denom="' + d + '" data-save-key="cash:denom:' + d + '" style="width:70px"></td><td class="denom-amt">0</td></tr>'; }).join("")
      + '<tr class="total"><td>合計</td><td></td><td id="cashTotal">0</td></tr></tbody></table></div>'
      + '<div class="row" style="margin-top:10px"><button class="btn sm" onclick="APP.cashRecalc()">再計算</button><button class="btn sm gold" onclick="APP.cashClose()">精算を確定</button></div></div>';
    // 照合は伝票・入出金から実際に計算する（0固定にしない＝レジ締めに使える）
    const d = D.day0824, A = C.todayAggregate(d.bills, d.attendance);
    const opening = D.store.registerFloat || 0;               // 前日から繰り越した釣銭
    const deposit = d.deposit || 0, withdrawal = d.withdrawal || 0;
    const theory = opening + A.all.cash + deposit - withdrawal; // 理論値
    h += '<div class="card" style="flex:1;min-width:280px"><h3>照合</h3>'
      + [['本日釣銭', opening], ['現金売上', A.all.cash], ['入金合計', deposit], ['出金合計', withdrawal],
         ['レジ内現金(理論値)', theory]]
        .map(function (k) { return '<div class="kv"><span class="k">' + k[0] + '</span><span class="v">' + yen(k[1]) + '</span></div>'; }).join("")
      + '<div class="kv"><span class="k">レジ内現金(入力)</span><span class="v" id="cashCounted">' + yen(0) + '</span></div>'
      + '<div class="kv"><span class="k">現金過不足</span><span class="v" id="cashDiff" style="font-weight:700">' + yen(-theory) + '</span></div>'
      + '<div class="kv"><span class="k">預金金額</span><span class="v"><input type="number" min="0" value="0" data-save-key="cash:deposit" style="width:120px"></span></div>'
      + '<div class="kv"><span class="k">翌日釣銭準備金</span><span class="v"><input type="number" min="0" value="' + opening + '" data-save-key="cash:nextfloat" style="width:120px"></span></div>'
      + '<div class="muted-note" id="cashTheory" data-theory="' + theory + '">現金過不足 = レジ内現金(実査) − 理論値。理論値 = 前日釣銭 + 現金売上 + 入金 − 出金。'
      + '<br>金種の枚数を入れると、過不足がその場で出ます。</div></div>';
    return h + '</div>';
  }

  // ---------- 日報登録（本家の勤怠報告を全列で・素人向け導線）----------
  function reportBase(name) { // その日のベース勤怠（実データ or 空）
    return (D.day0824.attendance || []).find(function (a) { return a.cast === name; })
      || { cast: name, start: '', end: null, drinks: [], req: { count: 0 }, dohan: { count: 0 }, field: { count: 0 }, bonus: 0, minus: 0, dailyPay: 0 };
  }
  function reportRows(list, isStaff) {
    const numin = function (ck, f, v) { return '<td><input type="number" min="0" value="' + (v || 0) + '" data-rcast="' + ck + '" data-rfield="' + f + '" data-save-key="report:' + ck + ':' + f + '" style="width:66px"></td>'; };
    return list.map(function (name) {
      const ck = esc(name); const base = reportBase(name);
      const c = D.casts.find(function (x) { return x.name === name; }) || { wage1: (isStaff ? 0 : 0) };
      const p = C.castPayroll(base);
      return '<tr data-rrow="' + ck + '"><td class="l stickyc">' + ck + '</td>'
        + '<td><input type="text" value="' + esc(base.start || '') + '" placeholder="--:--" data-rcast="' + ck + '" data-rfield="start" data-save-key="report:' + ck + ':start" style="width:62px"></td>'
        + '<td><input type="text" value="" placeholder="--:--" data-rcast="' + ck + '" data-rfield="end" data-save-key="report:' + ck + ':end" style="width:62px"></td>'
        + '<td class="mut">' + yen(c.wage1 || (isStaff ? 0 : 0)) + '</td>'
        + '<td class="r-back">' + num(p.back) + '</td>'
        + numin(ck, 'bonus', 0)
        + '<td class="r-gross">' + num(p.gross) + '</td><td class="r-welfare">' + num(p.welfare) + '</td>'
        + numin(ck, 'late', 0) + numin(ck, 'absent', 0) + numin(ck, 'pickup', 0)
        + numin(ck, 'dailyPay', 0)
        + '<td class="pos r-net">' + num(p.net) + '</td></tr>';
    }).join('');
  }
  function report() {
    const cols = ['キャスト', '開始', '終了', '時給', 'バック計', 'ボーナス', '総支給額', '厚生費', '遅刻', '欠勤', '送迎', '日払い', '残り支給額'];
    let h = '<div class="hint">🎤 <div><b>入力はかんたん。</b>「終了時刻」と「日払い」を入れるだけ。バック計・総支給額・厚生費・残り支給額は<b>自動計算</b>されます。声で入れたい時は各画面のマイクも使えます。</div></div>';
    h += '<div class="okbar" id="reportWarn" style="background:#fbf3d6;border-color:#ecdca0;color:#7a5f14">⚠️ 勤怠終了の未入力があります</div>';
    h += '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><div class="section-title" style="margin:0">キャスト勤怠 <span class="pill">2026/8/24(月)</span></div>'
      + '<button class="btn sm gold" onclick="APP.toast(&#39;自動保存済み。日報を確定しました&#39;)">日報を更新</button></div>';
    const th = '<thead><tr>' + cols.map(function (c, i) { return '<th class="' + (i === 0 ? 'l stickyc' : '') + '">' + c + '</th>'; }).join('') + '</tr></thead>';
    const castNames = D.casts.map(function (c) { return c.name; });
    h += '<div class="tablewrap"><table>' + th + '<tbody>' + reportRows(castNames, false) + '</tbody></table></div>';
    h += '<div class="section-title" style="margin-top:22px">スタッフ勤怠</div>';
    const staffNames = D.staff.map(function (s) { return s.name; });
    h += '<div class="tablewrap"><table>' + th + '<tbody>' + reportRows(staffNames, true) + '</tbody></table></div>';
    h += '<div class="muted-note">本家の勤怠報告と同じ列。バック（指名回数×バック額＋商品）は伝票から自動集計、厚生費＝総支給額×10%、残り支給額＝総支給額−厚生費−(遅刻+欠勤+送迎)−日払い。空欄の終了は未入力として上部に警告。</div>';
    return h;
  }

  // ---------- 設定 ----------
  function settings(sub) {
    const TABS = [['shop','店舗'],['cast','キャスト'],['staff','スタッフ'],['cost','入出金項目'],['fee','給与項目'],['terms','名称変更'],['product','商品'],['customer','お客さま']];
    const view = sub || 'shop';
    let h = '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px">'
      + '<div class="seg" style="flex-wrap:wrap">' + TABS.map(function (tb) { return '<button class="' + (view === tb[0] ? 'on' : '') + '" onclick="APP.goSub(\'settings\',\'' + tb[0] + '\')">' + tb[1] + '</button>'; }).join('') + '</div>'
      + '<div><button class="btn sm" onclick="APP.backupExport()">バックアップ</button> <button class="btn sm" onclick="APP.backupImport()">読み込み</button></div></div>';
    return h + (({ shop:_sShop, cast:_sCast, staff:_sStaff, cost:_sCost, fee:_sFee, terms:_sTerms, product:_sProduct, customer:_sCustomer })[view] || _sShop)();
  }
  function _sShop() {
    const s = D.store;
    let h = '<div class="voicebar"><button class="micbtn big" onclick="APP.voiceCommand(this)" aria-label="音声で編集">'
      + micSvg() + '</button><div><div class="vt">音声で設定を編集</div>'
      + '<div class="vs">マイクを押して話すだけ。例:「同伴バックを3000円」「厚生費を10パーセント」「開業時間を18時」「目標を350万」</div></div></div>';
    h += '<div class="section-title">店舗設定（計算パラメータ）<span class="mut" style="font-size:12px;font-weight:400">— 各項目のマイクでも入力できます</span></div><div class="row">';
    h += '<div class="card" style="flex:1;min-width:300px"><h3>基本</h3>'
      + setRow('開業時間', 'openHour', s.openHour, '時') + setRow('女子報酬締め日', 'joshiClosingDay', s.joshiClosingDay, '日')
      + setRow('リクエストバック金額', 'reqBackAmount', s.reqBackAmount, '円') + setRow('場内リクエストバック金額', 'fieldBackAmount', s.fieldBackAmount, '円')
      + setRow('同伴バック金額', 'dohanBackAmount', s.dohanBackAmount, '円') + setRow('厚生費比率', 'welfareRatePct', Math.round(s.welfareRate * 100), '%')
      + setRow('月間目標', 'target', s.target, '円') + '</div>';
    h += '<div class="card" style="flex:1;min-width:280px"><h3>計算方法（本家準拠）</h3>'
      + '<div class="kv"><span class="k">給率</span><span class="v">総支給額 ÷ 売上本計 ×100</span></div>'
      + '<div class="kv"><span class="k">端数</span><span class="v">四捨五入・小数1位</span></div>'
      + '<div class="kv"><span class="k">厚生費対象</span><span class="v">勤怠給+指名/注文バック+ボーナス</span></div>'
      + '<div class="kv"><span class="k">指名本数</span><span class="v">セット数分カウント</span></div>'
      + '<div class="kv"><span class="k">ハーフ指名</span><span class="v">1固定</span></div>'
      + '<div class="kv"><span class="k">キャスト時給</span><span class="v">2部制</span></div>'
      + '<div class="muted-note">※マイナスは厚生費対象外</div></div></div>';
    return h;
  }
  function _sCast() {
    let h = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="pill">キャスト設定（反映期間つき）</div><button class="btn sm gold" onclick="APP.toast(&#39;新規キャストは準備中です&#39;)">＋ 新規キャスト</button></div>';
    h += '<div class="tablewrap"><table><thead><tr><th>ID</th><th class="l">源氏名</th><th>属性</th><th>時給1部</th><th>時給2部</th><th>ﾘｸｴｽﾄ率</th><th>同伴率</th><th>ﾘｸｴｽﾄ固定</th><th>場内固定</th><th>同伴固定</th><th>厚生費%</th><th>反映</th></tr></thead><tbody>';
    D.casts.forEach(function (c) {
      const at = c.attr === 'dispatch' ? '派遣' : c.attr === 'trial' ? '体入' : '通常';
      h += '<tr><td>' + c.id + '</td><td class="l">' + esc(c.name) + '</td><td class="mut">' + at + '</td>'
        + '<td>' + yen(c.wage1) + '</td><td>' + yen(c.wage2 || 0) + '</td><td class="mut">0%</td><td class="mut">0%</td>'
        + '<td>' + yen(D.store.reqBackAmount) + '</td><td>' + yen(D.store.fieldBackAmount) + '</td><td>' + yen(D.store.dohanBackAmount) + '</td>'
        + '<td>' + c.welfare + '</td><td class="mut">この期間以降</td></tr>';
    });
    h += '</tbody></table></div><div class="muted-note">時給1部/2部・指名バック率or固定額・厚生費比率をキャスト個別に設定。反映期間で月ごとの改定を管理（本家同等）。</div>';
    return h;
  }
  function _sStaff() {
    let h = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="pill">スタッフ設定</div><button class="btn sm gold" onclick="APP.toast(&#39;新規作成は準備中です&#39;)">＋ 新規作成</button></div>';
    h += '<div class="tablewrap"><table><thead><tr><th>No</th><th class="l">名前</th><th>時給</th><th>日給</th><th>月給</th><th>厚生費率</th><th>登録月</th><th>操作</th></tr></thead><tbody>';
    D.staff.forEach(function (s) {
      h += '<tr><td>' + s.id + '</td><td class="l">' + esc(s.name) + '</td><td class="mut">—</td><td>' + yen(s.daily) + '</td><td class="mut">—</td><td>' + (s.welfare || 0) + '</td><td class="mut">' + s.since + '</td>'
        + '<td class="mut" style="font-size:12px">削除/名前/登録月</td></tr>';
    });
    return h + '</tbody></table></div><div class="muted-note">スタッフは時給/日給/月給の3体系＋厚生費率。登録月で在籍期間を管理。</div>';
  }
  function _sCost() {
    const KIND = global.SCHEMA.CostKind; const kmap = {}; Object.keys(KIND).forEach(function (k) { kmap[KIND[k].key] = KIND[k].label; });
    let h = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="pill">入出金項目</div><button class="btn sm gold" onclick="APP.toast(&#39;新規登録は準備中です&#39;)">＋ 新規登録</button></div>';
    h += '<div class="tablewrap"><table><thead><tr><th>ID</th><th class="l">名称</th><th class="l">種別</th><th>粗利算入</th><th>現金算入</th><th>操作</th></tr></thead><tbody>';
    D.costItems.forEach(function (c) {
      const K = Object.keys(KIND).map(function (k) { return KIND[k]; }).find(function (v) { return v.key === c.kind; }) || {};
      h += '<tr><td>' + c.id + '</td><td class="l">' + esc(c.name) + '</td><td class="l">' + (kmap[c.kind] || c.kind) + '</td>'
        + '<td>' + (K.inGross ? '○' : '✕') + '</td><td>' + (K.inCash ? '○' : '✕') + '</td><td class="mut" style="font-size:12px">編集/削除</td></tr>';
    });
    return h + '</tbody></table></div><div class="muted-note">種別ごとに（粗利算入・現金算入）が決まる＝粗利計算・レジ精算への反映を制御（本家の粗利×フラグ）。</div>';
  }
  function _sFee() {
    let h = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="pill">給与項目</div><button class="btn sm gold" onclick="APP.toast(&#39;新規作成は準備中です&#39;)">＋ 新規作成</button></div>';
    const kind = { minus: 'マイナス', bonus: 'ボーナス', dailypay: '日払い' };
    h += '<div class="tablewrap"><table><thead><tr><th>No</th><th class="l">名前</th><th>対象</th><th>種類</th><th>反映方法</th><th>初期値</th><th>操作</th></tr></thead><tbody>';
    D.feeItems.forEach(function (f) {
      h += '<tr><td>' + f.no + '</td><td class="l">' + esc(f.name) + '</td><td class="mut">共通</td><td>' + (kind[f.kind] || f.kind) + '</td><td class="mut">日報連動</td><td>0</td><td class="mut" style="font-size:12px">編集/個別初期値</td></tr>';
    });
    return h + '</tbody></table></div><div class="muted-note">遅刻/欠勤/送迎(マイナス)・ボーナス・日払いはマスタ化。日報で入力し給与へ連動。</div>';
  }
  function _sTerms() {
    let h = '<div class="section-title">名称変更（お店の呼び方に／次に開いた画面から反映）</div>';
    h += '<div class="card"><div class="tablewrap"><table class="t-wrap"><thead><tr><th class="l">初期値</th><th class="l">表示名</th></tr></thead><tbody>'
      + Object.keys(D.terms).map(function (k, i) { const id = 'term_' + i;
          return '<tr><td class="l mut">' + esc(k) + '</td><td class="l"><span class="ig"><input id="' + id + '" type="text" data-term="' + esc(k) + '" data-save-key="term:' + esc(k) + '" value="' + esc(D.terms[k]) + '" style="width:180px">'
            + '<button class="micbtn" onclick="APP.voiceField(\'#' + id + '\', this)" aria-label="音声入力">' + micSvg() + '</button></span></td></tr>'; }).join('')
      + '</tbody></table></div></div>';
    return h;
  }
  function _sProduct() {
    let h = '<div class="section-title">商品マスタ（全' + D.products.length + '品・単価・バック額）</div><div class="tablewrap"><table class="t-wrap"><thead><tr><th class="l">商品</th><th class="l">カテゴリ</th><th>単価</th><th>バック額</th></tr></thead><tbody>';
    const cat = { drink: 'ドリンク', shot: 'ショット', food: 'フード', bottle: 'ボトル', champagne: 'シャンパン' };
    D.products.forEach(function (p) { h += '<tr><td class="l">' + esc(p.name) + '</td><td class="l mut">' + (cat[p.cat] || p.cat) + '</td><td>' + (p.price ? yen(p.price) : '<span class="mut">未登録</span>') + '</td><td>' + (p.price ? yen(p.backAmt) : '—') + '</td></tr>'; });
    return h + '</tbody></table></div>';
  }
  function _sCustomer() {
    let h = '<div class="section-title">お客さま設定：基本</div><div class="row">'
      + '<div class="card" style="flex:1;min-width:260px"><h3>キープ有効期限</h3><div class="kv"><span class="k">既定</span><span class="v">' + D.keepDefaultMonths + 'ヶ月後</span></div><div class="muted-note">登録時に個別変更可</div></div>'
      + '<div class="card" style="flex:1;min-width:260px"><h3>顧客ランク基準（直近3ヶ月の来店回数）</h3>'
      + '<div class="kv"><span class="k">S</span><span class="v">' + D.rankThresholds.S + '回以上</span></div><div class="kv"><span class="k">A</span><span class="v">' + D.rankThresholds.A + '回以上</span></div>'
      + '<div class="kv"><span class="k">B</span><span class="v">' + D.rankThresholds.B + '回以上</span></div><div class="kv"><span class="k">C</span><span class="v">' + D.rankThresholds.C + '回以上</span></div><div class="kv"><span class="k">D</span><span class="v">C未満</span></div></div></div>';
    h += '<div class="section-title">顧客項目定義（お客さま編集の入力欄）</div><div class="tablewrap"><table class="t-wrap"><thead><tr><th>No</th><th class="l">ラベル</th><th class="l">タイプ</th></tr></thead><tbody>'
      + D.customerFields.map(function (f) { const ty = { text: 'テキスト', date: '日付', select: '選択肢', phone: '電話番号' }; return '<tr><td>' + f.no + '</td><td class="l">' + esc(f.label) + '</td><td class="l mut">' + (ty[f.type] || f.type) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<div class="section-title">属性設定（' + D.customerAttributes.length + '種）</div><div class="card"><div class="row" style="gap:8px">'
      + D.customerAttributes.map(function (a) { return '<span class="tag">' + esc(a) + '</span>'; }).join('') + '</div></div>';
    return h;
  }
  function kvedit(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  function micSvg() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v4M9 21h6"/></svg>'; }
  // 設定の1行（ラベル＋数値入力＋マイク）。data-setting で保存・音声反映
  function setRow(label, key, val, unit) {
    const id = 'set_' + key;
    return '<div class="setrow"><label for="' + id + '">' + label + '</label>'
      + '<span class="ig"><input id="' + id + '" type="number" data-setting="' + key + '" value="' + val + '" style="width:120px">'
      + '<span class="u">' + unit + '</span>'
      + '<button class="micbtn" onclick="APP.voiceField(\'#' + id + '\', this)" aria-label="音声入力">' + micSvg() + '</button></span></div>';
  }

  function history() {
    return '<div class="card"><h3>変更履歴（監査ログ）</h3><div class="tablewrap"><table><thead><tr><th>日時</th><th class="l">操作</th><th class="l">内容</th></tr></thead><tbody>'
      + '<tr><td>2026-08-24 23:38</td><td class="l">日報更新</td><td class="l">8/24 キャスト勤怠を更新</td></tr>'
      + '<tr><td>2026-08-24 21:30</td><td class="l">伝票作成</td><td class="l">卓1 / ゆき❄️ 場内</td></tr>'
      + '</tbody></table></div><div class="muted-note">誰が・いつ・何を・旧値/新値を記録（デモ・実記録は対象外）。</div></div>';
  }

  // ---------- 伝票一覧 ----------
  function bills() {
    // 検索バー（期間・抽出・詳細表示）＋新規伝票
    let h = '<div class="hint">🧾 <div>伝票の一覧と明細。<b>「＋新規伝票」</b>で会計を登録（卓・客数・指名・商品・サービス料・値引/値増）。期間で絞り込み、Excel出力もできます。</div></div>';
    h += '<div class="card" style="margin-bottom:14px"><div class="row" style="align-items:flex-end;gap:12px">'
      + '<div><label>期間(FROM)</label><br><input type="date" value="2026-08-24" data-save-key="bills:from"></div>'
      + '<div><label>期間(TO)</label><br><input type="date" value="2026-08-24" data-save-key="bills:to"></div>'
      + '<div><label>抽出</label><br><select><option>全て表示</option><option>未精算のみ</option><option>精算済のみ</option></select></div>'
      + '<label style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" style="min-height:auto;width:auto"> 詳細表示</label>'
      + '<button class="btn sm" onclick="APP.toast(&#39;絞り込み（デモ）&#39;)">検索</button><button class="btn sm" onclick="APP.toast(&#39;月間へ反映（デモ）&#39;)">月間反映</button>'
      + '<div style="margin-left:auto"><button class="btn sm gold" onclick="APP.newBill()">＋ 新規伝票</button> <button class="btn sm" onclick="APP.exportCSV(&#39;export&#39;)">Excel</button></div>'
      + '</div><div class="muted-note">日付の絞り込みは最大31日間まで。Excelは表示中の分（25件超は表示件数を変更）。</div></div>';
    // 一覧（本家の列: №/ID/出戻り/営業日/入店/退店/時間/卓/客数/顧客/タグ/指名/サービス料/値引/値増/現金/カード/売掛/合計/状態）
    const cols = ['№', '伝票ID', '出戻り', '入店', '退店', '時間', '卓', '客数', '顧客', 'タグ', '指名', 'サービス料', '値引', '値増', '現金', 'カード', '合計', '状態'];
    h += '<div class="tablewrap"><table><thead><tr>' + cols.map(function (c, i) { return '<th class="' + (i <= 1 ? 'l' : '') + '">' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
    let tS = 0, tSvc = 0, tDisc = 0, tMarkup = 0, tCash = 0, tCard = 0, tTotal = 0, tGuests = 0;
    D.day0824.bills.forEach(function (b) {
      const total = (b.cash || 0) + (b.card || 0) + (b.credit || 0);
      const nm = (b.req || []).map(function (x) { return t('本指名') + esc(x.cast) + '(' + x.count + ')'; })
        .concat((b.field || []).map(function (x) { return t('場内指名') + esc(x.cast) + '(' + x.count + ')'; }))
        .concat((b.dohan || []).map(function (x) { return t('同伴') + esc(x.cast) + '(' + x.count + ')'; })).join(' / ') || '--';
      tSvc += b.service || 0; tDisc += b.discount || 0; tMarkup += b.markup || 0; tCash += b.cash || 0; tCard += b.card || 0; tTotal += total; tGuests += b.guests || 0;
      h += '<tr><td class="l">' + b.no + '</td><td class="l mut" style="font-size:11px">' + b.uuid.slice(0, 8) + '…</td>'
        + '<td class="mut">—</td><td>' + esc(b.in) + '</td><td>' + esc(b.out) + '</td><td>' + (b.out ? dur(b.in, b.out) : '--') + '</td>'
        + '<td>' + b.table + '</td><td>' + b.guests + '</td><td class="mut">' + esc(b.customer || '—') + '</td><td class="l">' + esc(b.tag || '—') + '</td>'
        + '<td class="l" style="white-space:normal;max-width:220px;font-size:12px">' + nm + '</td>'
        + cell(b.service || 0) + '<td>' + ((b.discount||0)?num(b.discount):'0') + '</td><td>' + ((b.markup||0)?num(b.markup):'0') + '</td>' + cell(b.cash) + cell(b.card)
        + '<td>' + num(total) + '</td><td>' + (b.settled ? '<span class="pos">精算済</span>' : '<span class="mut">未精算</span>') + '</td></tr>';
    });
    h += '<tr class="total"><td>計</td><td></td><td></td><td></td><td></td><td></td><td></td><td>' + tGuests + '</td><td></td><td></td><td></td>'
      + cell(tSvc) + '<td>' + num(tDisc) + '</td><td>' + num(tMarkup) + '</td>' + cell(tCash) + cell(tCard) + '<td>' + num(tTotal) + '</td><td></td></tr>';
    h += '</tbody></table></div><div class="muted-note">顧客/タグ/値引/値増/出戻りは伝票明細で登録（「＋新規伝票」）。UUID・営業日・入退店・サービス料は本家同等。</div>';
    return h;
  }
  function dur(a, b) { const s = a.split(':'), e = b.split(':'); let m = (+e[0] * 60 + +e[1]) - (+s[0] * 60 + +s[1]); if (m < 0) m += 1440; return Math.floor(m / 60) + '時間' + (m % 60) + '分'; }

  global.UI = {
    yen: yen, num: num,
    setHideZeroCast: function (v) { _hideZeroCast = !!v; },
    screens: {
      summary: { title: 'まとめ', render: summary },
      balance: { title: '収支', render: balance },
      realtime: { title: 'リアルタイム集計', render: realtime },
      items: { title: '売上商品集計', render: items },
      castItems: { title: 'キャスト別商品集計', render: castItems },
      bills: { title: '伝票一覧', render: bills },
      casts: { title: 'キャスト', render: castsScreen },
      staff: { title: 'スタッフ', render: staffScreen },
      tags: { title: 'タグ', render: tagsScreen },
      customers: { title: 'お客さま管理', render: customers },
      cash: { title: '現金管理', render: cash },
      report: { title: '日報登録', render: report },
      settings: { title: '設定', render: settings },
      history: { title: '履歴', render: history },
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
