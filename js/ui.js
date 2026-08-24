/* Dシステム改 - ui.js : 全画面のレンダラ（本家超えデザイン） */
(function (global) {
  "use strict";
  const D = global.DATA, C = global.CALC;
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
      ? '<div class="okbar" id="verifyBar">✅ 本家一致チェック: 全項目 1円一致（売上 / 経費 / 粗利 / 客単価 / 給与エンジン）</div>'
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
    h += '<div class="section-title">当日 <span class="pill">2026/8/24(月)</span></div>';
    h += '<div class="row">'
      + card('店舗状況', '#8b5cf6', '1<span class="unit">人</span> / 1<span class="unit">組</span>', '',
          [['客単価', yen(7300)], ['組単価', yen(7300)], [t('本指名') + '本計', yen(0)], ['<span class="mut" style="font-size:11px">※精算済のみ</span>', '<span class="mut" style="font-size:11px">未精算¥47,900はリアルタイム</span>']])
      + card('売上', '#4a9eff', yen(d0824.salesTotal), '', [['現金', yen(d0824.cash)], ['カード', yen(d0824.card)]])
      + card('経費', '#ff5c5c', yen(d0824.expenseTotal), '', [['人件費-女子', yen(810)]])
      + card('入金', '#f0c020', yen(0), '', [['粗利', '<span class="pos">' + yen(d0824.grossProfit) + '</span>']])
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
      + '<div class="seg"><button class="on">月次</button><button onclick="APP.toast(\'日次はデモ対象外\')">日次</button></div>'
      + '<div><button class="btn sm" onclick="APP.toast(&#39;Excel出力はデモ対象外&#39;)">Excel</button> <button class="btn sm" onclick="APP.toast(&#39;Excel出力はデモ対象外&#39;)">Excel(All)</button> <button class="btn sm ghost" onclick="APP.toast(&#39;デモ対象外&#39;)">旧Excel</button></div></div>';
    // ヒートマップ（粗利）
    h += '<div class="card" style="margin-bottom:16px"><h3>曜日別 粗利ヒートマップ</h3>' + heatmap(rows) + '</div>';
    // テーブル
    const cols = ['日付', '現金', 'カード', '売上計', 'リクエスト小計', '同伴小計', '残り支給額', '給率', '男子日払い', '女子日払い', 'マイナス', '出金', '経費計', '粗利'];
    let tb = '<div class="tablewrap"><table><thead><tr>' + cols.map(function (c, i) { return '<th class="' + (i === 0 ? 'l stickyc' : '') + '">' + c + '</th>'; }).join("") + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      if (r.holiday) { tb += '<tr class="holiday"><td class="l stickyc">' + fmtDate(r) + '</td><td colspan="13" class="l" style="color:var(--muted)">休み</td></tr>'; return; }
      const neg = r.grossProfit < 0;
      tb += '<tr' + (neg ? ' class="neg-row"' : '') + '>'
        + '<td class="l stickyc">' + fmtDate(r) + '</td>'
        + cell(r.cash) + cell(r.card) + cell(r.salesTotal) + cell(r.reqSub) + cell(r.dohanSub)
        + cell(r.remainingPay) + '<td>' + (r.payRate ? r.payRate.toFixed(2) + '%' : '--') + '</td>'
        + cell(r.maleDaily) + cell(r.femaleDaily) + cell(r.minus) + cell(r.withdrawal) + cell(r.expenseTotal)
        + '<td class="' + (neg ? 'neg' : 'pos') + '">' + num(r.grossProfit) + '</td></tr>';
    });
    tb += '<tr class="total"><td class="l stickyc">合計</td>' + cell(agg.cash) + cell(agg.card) + cell(agg.salesTotal)
      + cell(agg.reqSub) + cell(agg.dohanSub) + cell(agg.remainingPay) + '<td>' + (D.monthSummary.salesTotal ? (D.monthSummary.laborFemale / D.monthSummary.salesTotal * 100).toFixed(2) + '%' : '--') + '</td>'
      + cell(agg.maleDaily) + cell(agg.femaleDaily) + cell(agg.minus) + cell(agg.withdrawal) + cell(agg.expenseTotal)
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
      + kpi('総売上', yen(d.expected.totalSales), '#4a9eff')
      + kpi('未精算', yen(d.expected.unsettled), '#f0a02c')
      + kpi('精算済', yen(d.expected.settled), '#3fb950')
      + kpi('女子給料', yen(d.expected.joshiPay), '#ff8fbf') + '</div>';
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
      bl += '<tr><td class="l">' + b.no + '</td><td>' + b.in + '</td><td>' + b.out + '</td><td>' + b.table + '</td><td>' + b.guests + '</td>'
        + '<td class="l" style="white-space:normal;max-width:260px">' + nm + '</td>' + cell(b.cash) + cell(b.card)
        + '<td>' + num(total) + '</td><td>' + (b.settled ? '<span class="pos">精算済</span>' : '<span class="mut">未精算</span>') + '</td></tr>';
    });
    bl += '</tbody></table></div></div>';
    h += bl;
    // 勤怠報告（給与エンジンでライブ計算）
    let at = '<div class="card"><h3>勤怠報告（給与を自動計算）</h3><div class="tablewrap"><table><thead><tr>'
      + '<th class="l">キャスト</th><th>' + t('本指名') + '</th><th>' + t('同伴') + '</th><th>' + t('場内指名') + '</th><th>ドリンク</th>'
      + '<th>バック計</th><th>総支給</th><th>厚生費</th><th>支給額</th><th>残り支給</th></tr></thead><tbody>';
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
    at += '</tbody></table></div><div class="muted-note">この表の給与は calc.js エンジンがリアルタイム計算（本家の勤怠報告と1円一致）。</div></div>';
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
      + '個 等（22〜31日は元画面が見切れのため、完全一致には残り日のスクショが必要）。</div>';
    return h;
  }
  function castItems() {
    // キャスト別 キャストドリンクS 個数（観測値）
    const rows = [['みお🌙', 172], ['あや☆', 123], ['さくら🌻', 83], ['ひな❄️', 49], ['のあ☆', 47], ['ゆい☆', 46], ['まや🎣', 44], ['れい🔔', 36], ['かな🍖', 17]];
    const max = rows[0][1];
    let h = '<div class="seg" style="margin-bottom:14px"><button onclick="APP.go(\'items\')">商品別</button><button class="on">キャスト別</button></div>';
    h += '<div class="card"><h3>キャスト別 キャストドリンクS 販売数（2026年8月）</h3>';
    rows.forEach(function (e, i) {
      h += '<div class="rank"><div class="no ' + (i === 0 ? 'g1' : '') + '">' + (i + 1) + '</div><div style="width:120px">' + e[0] + '</div>'
        + '<div class="bar"><i style="width:' + (e[1] / max * 100) + '%"></i></div><div style="width:60px;text-align:right">' + e[1] + '個</div>'
        + '<div style="width:110px;text-align:right" class="mut">' + yen(e[1] * 1000) + '</div></div>';
    });
    return h + '</div>';
  }

  // ---------- キャスト給与（月次サマリ） ----------
  function castsScreen() {
    const rows = [
      ['みお🌙', 285360, 37.2, 15, 164666], ['あや☆', 145402, 58, 17, 173775], ['さくら🌻', 136062, 48.7, 9, 96499],
      ['のあ☆', 49021, 31.3, 3, 36734], ['ひな❄️', 73485, 90.7, 11, 61800], ['まや🎣', 34344, 147, 8, 55250],
      ['れい🔔', 12680, 125.6, 9, 49334], ['ゆい☆', 56900, 858.5, 11, 73800], ['かな🍖', 23035, 0, 7, 27750],
    ];
    let h = '<div class="row" style="justify-content:space-between;margin-bottom:12px"><div class="pill">末日締め・2026年8月</div>'
      + '<div><button class="btn sm" onclick="APP.toast(&#39;Excel出力はデモ対象外&#39;)">Excel</button> <button class="btn sm gold" onclick="APP.toast(&#39;PDF出力はデモ対象外&#39;)">報酬明細PDF</button></div></div>';
    h += '<div class="tablewrap"><table><thead><tr><th class="l">キャスト</th><th>残り支給額</th><th>給率</th><th>勤務日数</th><th>時間報酬</th></tr></thead><tbody>';
    let tot = 0;
    rows.forEach(function (r) { tot += r[1]; h += '<tr><td class="l">' + r[0] + '</td><td>' + num(r[1]) + '</td><td>' + r[2] + '%</td><td>' + r[3] + '</td><td>' + num(r[4]) + '</td></tr>'; });
    h += '<tr class="total"><td class="l">合計</td><td>' + num(816289) + '</td><td>55.8%</td><td>90</td><td>' + num(739608) + '</td></tr>';
    h += '</tbody></table></div><div class="muted-note">給率100%超は「売上に対し給与が高い日/キャスト」。時間報酬が売上を上回ると発生。</div>';
    return h;
  }
  function staffScreen() {
    let h = '<div class="tablewrap"><table><thead><tr><th class="l">名前</th><th>労働日数</th><th>支給総額</th><th>支給額</th><th>残り支給額</th><th>日払い</th></tr></thead><tbody>';
    h += '<tr><td class="l">タカシ</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>';
    h += '<tr><td class="l">ケンジ</td><td>18</td><td>' + num(160000) + '</td><td>' + num(160000) + '</td><td class="neg">' + num(-15000) + '</td><td>' + num(175000) + '</td></tr>';
    h += '<tr class="total"><td class="l">合計</td><td>18</td><td>' + num(160000) + '</td><td>' + num(160000) + '</td><td class="neg">' + num(-15000) + '</td><td>' + num(175000) + '</td></tr>';
    h += '</tbody></table></div><div class="muted-note">残り支給額 = 支給額 − 日払い。日払い過多でマイナス（前借り超過）になる。</div>';
    return h;
  }

  // ---------- タグ集計 ----------
  function tagsScreen() {
    let h = '<div class="card"><h3>タグ集計（2026年8月度）— 集客担当別</h3><div class="tablewrap"><table><thead><tr>'
      + '<th class="l">タグ</th><th>件数</th><th>客数</th><th>伝票小計</th><th>現金</th><th>カード</th><th>販売額</th></tr></thead><tbody>';
    h += '<tr><td class="l"><span class="dot" style="background:#8b949e"></span> ケンジ</td><td>7</td><td>19</td><td>' + num(127500) + '</td><td>' + num(88700) + '</td><td>' + num(59800) + '</td><td>' + num(148500) + '</td></tr>';
    h += '<tr class="total"><td class="l">合計</td><td>7</td><td>19</td><td>' + num(127500) + '</td><td>' + num(88700) + '</td><td>' + num(59800) + '</td><td>' + num(148500) + '</td></tr>';
    h += '</tbody></table></div><div class="muted-note">販売額148,500＝まとめの「タグ対象額」と一致。タグ＝集客担当（1伝票に複数可）。</div></div>';
    return h;
  }

  // ---------- お客様管理 ----------
  function customers() {
    let h = '<div class="section-title">顧客ランク（直近3ヶ月の来店回数で自動判定）</div>';
    const ranks = [['S', 20, '#ff5c5c'], ['A', 10, '#f0a02c'], ['B', 5, '#4a9eff'], ['C', 1, '#3fb950'], ['D', 0, '#6e7b8a']];
    h += '<div class="row">' + ranks.map(function (r) {
      return '<div class="card" style="flex:1;text-align:center"><div class="big" style="color:' + r[2] + '">' + r[0] + '</div><div class="mut">' + (r[1] ? r[1] + '回以上' : '0回') + '</div><div class="big" style="font-size:20px">0<span class="unit">人</span></div></div>';
    }).join("") + '</div>';
    h += '<div class="section-title">顧客属性マスタ（' + D.customerAttributes.length + '種）</div><div class="card"><div class="row">'
      + D.customerAttributes.map(function (a) { return '<span class="tag">' + esc(a) + '</span>'; }).join("") + '</div></div>';
    h += '<div class="muted-note">お客様分析・キープ管理・項目定義・タグ→顧客コピーも本家同等（デモは属性/ランクを表示）。</div>';
    return h;
  }

  // ---------- 現金管理（レジ精算） ----------
  function cash() {
    const denoms = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1];
    let h = '<div class="section-title">レジ精算 — 2026/8/24</div><div class="row">';
    h += '<div class="card" style="flex:1;min-width:280px"><h3>金種入力</h3><div class="tablewrap"><table id="cashTable"><thead><tr><th>金種</th><th>枚数</th><th>金額</th></tr></thead><tbody>'
      + denoms.map(function (d) { return '<tr><td>' + num(d) + '</td><td><input type="number" min="0" step="1" value="0" data-denom="' + d + '" data-save-key="cash:denom:' + d + '" style="width:70px"></td><td class="denom-amt">0</td></tr>'; }).join("")
      + '<tr class="total"><td>合計</td><td></td><td id="cashTotal">0</td></tr></tbody></table></div>'
      + '<div class="row" style="margin-top:10px"><button class="btn sm" onclick="APP.toast(&#39;金種を入力すると自動集計します&#39;)">手動精算</button><button class="btn sm gold" onclick="APP.toast(&#39;自動精算はデモ対象外&#39;)">自動精算</button></div></div>';
    h += '<div class="card" style="flex:1;min-width:280px"><h3>照合</h3>'
      + [['本日釣銭', 0], ['現金売上', 0], ['入金合計', 0], ['出金合計', 0], ['レジ内現金(理論値)', 0], ['レジ内現金(入力)', 0], ['現金過不足', 0], ['預金金額', 0], ['翌日釣銭準備金', 0]]
        .map(function (k) { return '<div class="kv"><span class="k">' + k[0] + '</span><span class="v">' + yen(k[1]) + '</span></div>'; }).join("")
      + '<div class="muted-note">現金過不足 = レジ内現金(実査) − 理論値。理論値 = 前日釣銭 + 現金売上 + 入金 − 出金。</div></div>';
    return h + '</div>';
  }

  // ---------- 日報登録 ----------
  function report() {
    let h = '<div class="okbar" id="reportWarn" style="background:#fbf3d6;border-color:#ecdca0;color:#7a5f14">⚠️ 未入力: 勤怠終了 3人 — <button class="btn sm" style="margin-left:8px" onclick="APP.toast(&#39;各行に直接入力してください&#39;)">まとめて入力</button></div>';
    h += '<div class="section-title">キャスト勤怠（2026/8/24）</div>';
    h += '<div class="tablewrap"><table><thead><tr><th class="l">キャスト</th><th>開始</th><th>終了</th><th>時給</th><th>バック計</th><th>厚生費</th><th>残り支給</th><th>日払い</th></tr></thead><tbody>';
    D.day0824.attendance.forEach(function (a) {
      const p = C.castPayroll(a); const c = D.casts.find(function (x) { return x.name === a.cast; }) || { wage1: 0 };
      const ck = esc(a.cast);
      h += '<tr data-rrow="' + ck + '"><td class="l">' + ck + '</td>'
        + '<td><input type="text" value="' + esc(a.start) + '" data-rcast="' + ck + '" data-rfield="start" data-save-key="report:' + ck + ':start" style="width:64px"></td>'
        + '<td><input type="text" value="" placeholder="--:--" data-rcast="' + ck + '" data-rfield="end" data-save-key="report:' + ck + ':end" style="width:64px"></td>'
        + '<td>' + yen(c.wage1) + '</td>'
        + '<td class="r-back">' + num(p.back) + '</td><td class="r-welfare">' + num(p.welfare) + '</td><td class="pos r-net">' + num(p.net) + '</td>'
        + '<td><input type="number" min="0" value="0" data-rcast="' + ck + '" data-rfield="dailyPay" data-save-key="report:' + ck + ':daily" style="width:70px"></td></tr>';
    });
    h += '</tbody></table></div><div class="muted-note">開始/終了/日払いを入力すると、時給報酬・厚生費・残り支給を<b>その場で再計算</b>します（本家の勤怠報告と同じ式）。終了を入れると実働時間×時給が加算されます。</div>';
    return h;
  }

  // ---------- 設定 ----------
  function settings() {
    const s = D.store;
    let h = '<div class="row" style="justify-content:flex-end;margin-bottom:8px">'
      + '<button class="btn sm" onclick="APP.backupExport()">バックアップ書き出し</button> '
      + '<button class="btn sm" onclick="APP.backupImport()">読み込み</button></div>';
    // ★音声で設定を編集（現場・素人向け）
    h += '<div class="voicebar"><button class="micbtn big" onclick="APP.voiceCommand(this)" aria-label="音声で編集">'
      + micSvg() + '</button><div><div class="vt">音声で設定を編集</div>'
      + '<div class="vs">マイクを押して話すだけ。例:「同伴バックを3000円」「厚生費を10パーセント」「開業時間を18時」「目標を350万」</div></div></div>';
    h += '<div class="section-title">店舗設定（計算パラメータ）<span class="mut" style="font-size:12px;font-weight:400">— 各項目のマイクでも入力できます</span></div><div class="row">';
    h += '<div class="card" style="flex:1;min-width:300px"><h3>基本</h3>'
      + setRow('開業時間', 'openHour', s.openHour, '時')
      + setRow('女子報酬締め日', 'joshiClosingDay', s.joshiClosingDay, '日')
      + setRow('リクエストバック金額', 'reqBackAmount', s.reqBackAmount, '円')
      + setRow('場内リクエストバック金額', 'fieldBackAmount', s.fieldBackAmount, '円')
      + setRow('同伴バック金額', 'dohanBackAmount', s.dohanBackAmount, '円')
      + setRow('厚生費比率', 'welfareRatePct', Math.round(s.welfareRate * 100), '%')
      + setRow('月間目標', 'target', s.target, '円')
      + '</div>';
    h += '<div class="card" style="flex:1;min-width:280px"><h3>給率の計算</h3>'
      + '<div class="kv"><span class="k">給率</span><span class="v">総支給額 ÷ 売上本計 × 100</span></div>'
      + '<div class="kv"><span class="k">端数</span><span class="v">四捨五入・小数1位</span></div>'
      + '<div class="kv"><span class="k">厚生費対象</span><span class="v">勤怠給+指名/注文バック+ボーナス</span></div>'
      + '<div class="muted-note">※マイナスは厚生費対象外</div></div>';
    h += '</div>';
    h += '<div class="section-title">用語カスタマイズ（次に開いた画面から反映）</div><div class="card"><div class="tablewrap"><table class="t-wrap"><thead><tr><th class="l">初期値</th><th class="l">表示名</th></tr></thead><tbody>'
      + Object.keys(D.terms).map(function (k, i) {
          const id = 'term_' + i;
          return '<tr><td class="l mut">' + esc(k) + '</td><td class="l"><span class="ig"><input id="' + id + '" type="text" data-term="'+esc(k)+'" data-save-key="term:'+esc(k)+'" value="' + esc(D.terms[k]) + '" style="width:180px">'
            + '<button class="micbtn" onclick="APP.voiceField(\'#' + id + '\', this)" aria-label="音声入力">' + micSvg() + '</button></span></td></tr>';
        }).join("")
      + '</tbody></table></div></div>';
    h += '<div class="section-title">商品マスタ（単価・バック額）</div><div class="tablewrap"><table class="t-wrap"><thead><tr><th class="l">商品</th><th>単価</th><th>バック額</th></tr></thead><tbody>'
      + D.products.map(function (p) { return '<tr><td class="l">' + esc(p.name) + '</td><td>' + yen(p.price) + '</td><td>' + yen(p.backAmt) + '</td></tr>'; }).join("") + '</tbody></table></div>';
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
      + '<tr><td>2026-08-24 21:30</td><td class="l">伝票作成</td><td class="l">卓1 / ひな❄️ 場内</td></tr>'
      + '</tbody></table></div><div class="muted-note">誰が・いつ・何を・旧値/新値を記録（デモ・実記録は対象外）。</div></div>';
  }

  // ---------- 伝票一覧 ----------
  function bills() {
    let h = '<div class="row" style="justify-content:space-between;margin-bottom:12px"><div class="pill">2026/8/24</div><button class="btn sm" onclick="APP.toast(&#39;Excel出力はデモ対象外&#39;)">Excel</button></div>';
    h += '<div class="tablewrap"><table><thead><tr><th class="l">№</th><th class="l">伝票ID</th><th>営業日</th><th>入店</th><th>退店</th><th>時間</th><th>サービス料</th><th>合計</th></tr></thead><tbody>';
    D.day0824.bills.forEach(function (b) {
      const total = (b.cash || 0) + (b.card || 0) + (b.credit || 0);
      h += '<tr><td class="l">' + b.no + '</td><td class="l mut" style="font-size:11px">' + b.uuid.slice(0, 8) + '…</td><td>08/24</td><td>' + b.in + '</td><td>' + b.out + '</td>'
        + '<td>' + (b.out ? dur(b.in, b.out) : '--') + '</td>' + cell(b.service || 0) + '<td>' + num(total) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function dur(a, b) { const s = a.split(':'), e = b.split(':'); let m = (+e[0] * 60 + +e[1]) - (+s[0] * 60 + +s[1]); if (m < 0) m += 1440; return Math.floor(m / 60) + '時間' + (m % 60) + '分'; }

  global.UI = {
    yen: yen, num: num,
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
      customers: { title: 'お客様管理', render: customers },
      cash: { title: '現金管理', render: cash },
      report: { title: '日報登録', render: report },
      settings: { title: '設定', render: settings },
      history: { title: '履歴', render: history },
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
