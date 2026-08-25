/* Dシステム改 - app.js : ルーティング / 初期化 / エラー表示 */
(function (global) {
  "use strict";
  const D = global.DATA, C = global.CALC, UI = global.UI;

  // 上品なモノラインアイコン（絵文字をやめてAIっぽさを排除）
  const P = {
    summary:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    balance:'<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="5" width="3" height="12"/>',
    realtime:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    items:'<path d="M10 3h4v3l1 3v11a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V9l1-3z"/><path d="M9.5 12h5"/>',
    castItems:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    bills:'<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    casts:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>',
    staff:'<circle cx="12" cy="7" r="3"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/>',
    tags:'<path d="M20 12l-8 8-9-9V4h7z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
    customers:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><path d="M16 5.5a3 3 0 0 1 0 5.8"/><path d="M21 20c0-2.4-1.6-4.2-4-4.8"/>',
    cash:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v6M18 9v6"/>',
    report:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v3h6V3"/><path d="M8 11h8M8 15h5"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 8v4l3 2"/>',
  };
  function ic(id){ return '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + (P[id]||'') + '</svg>'; }
  const NAV = [
    { sec: 'ダッシュボード' },
    { id: 'summary', label: 'まとめ' },
    { id: 'balance', label: '収支' },
    { id: 'realtime', label: 'リアルタイム集計', badge: '生' },
    { sec: '集計' },
    { id: 'items', label: '売上商品集計' },
    { id: 'castItems', label: 'キャスト別商品集計' },
    { id: 'bills', label: '伝票一覧' },
    { sec: '人・顧客' },
    { id: 'casts', label: 'キャスト' },
    { id: 'staff', label: 'スタッフ' },
    { id: 'tags', label: 'タグ' },
    { id: 'customers', label: 'お客さま管理' },
    { sec: '運用' },
    { id: 'cash', label: '現金管理' },
    { id: 'report', label: '日報登録', badge: '!' },
    { id: 'settings', label: '設定' },
    { id: 'history', label: '履歴' },
  ];

  function buildNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = NAV.map(function (n) {
      if (n.sec) return '<div class="sec">' + n.sec + '</div>';
      return '<a data-id="' + n.id + '">' + ic(n.id) + '<span>' + n.label + '</span>'
        + (n.badge ? '<span class="badge">' + n.badge + '</span>' : '') + '</a>';
    }).join('');
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { go(a.getAttribute('data-id')); closeSidebar(); });
    });
  }

  function routeHash(id, sub) { return sub ? '#' + id + '/' + sub : '#' + id; }
  // file:// で pushState が例外を投げる環境でも死なない（ルールB）
  function safePush(state, url) { try { history.pushState(state, '', url); } catch (e) { try { location.hash = url; } catch (e2) {} } }
  function safeReplace(state, url) { try { history.replaceState(state, '', url); } catch (e) {} }
  function parseHash() {
    const parts = (location.hash || '#summary').slice(1).split('/');
    const id = UI.screens[parts[0]] ? parts[0] : 'summary';
    return { id: id, sub: parts[1] || null };
  }
  function go(id) {
    const scr = UI.screens[id];
    if (!scr) { showError('画面が見つかりません', 'id=' + id, '存在する画面を選んでください'); return; }
    currentSub = null;
    safePush({ id: id, sub: null }, '#' + id); // 戻る対応
    render(id, null);
  }

  let currentId = 'summary';
  const SKEY = 'd-system-kai:v1';
  function loadStore() { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } }
  function saveStore(o) {
    try { localStorage.setItem(SKEY, JSON.stringify(o)); markSaved(); }
    catch (e) { showError('保存に失敗しました', String(e && e.message || e), 'ブラウザのプライベートモード/容量を確認してください'); }
  }
  function persistCasts() { const st = loadStore(); st.casts = DATA.casts; saveStore(st); }
  // キャストの追加（本家にある機能）
  function newCast() {
    const body = '<div class="row" style="gap:12px">'
      + '<div style="flex:1;min-width:150px"><label>源氏名</label><br><input id="ncName" type="text" style="width:100%"></div>'
      + '<div style="flex:1;min-width:110px"><label>時給1部</label><br><input id="ncWage" type="number" min="0" value="2000" style="width:100%"></div>'
      + '<div style="flex:1;min-width:110px"><label>厚生費%</label><br><input id="ncWel" type="number" min="0" value="10" style="width:100%"></div>'
      + '</div><div class="muted-note">バックは後から1人ずつ変えられます。空欄ならお店の設定に従います。</div>';
    modal('キャストを追加', body, function () {
      const name = document.getElementById('ncName').value.trim();
      if (!name) { toast('源氏名を入れてください'); return; }
      if (DATA.casts.some(function (c) { return c.name === name; })) { toast('同じ源氏名がすでにあります'); return; }
      const wage = Number(document.getElementById('ncWage').value) || 0;
      const wel = document.getElementById('ncWel').value.trim();
      const id = Math.max.apply(null, DATA.casts.map(function (c) { return c.id; }).concat([100])) + 1;
      DATA.casts.push({ id: id, name: name, attr: 'normal', wage1: wage, wage2: 0, welfare: wel === '' ? null : Number(wel) });
      persistCasts(); pushAudit('キャスト追加', name, '(なし)', '時給' + wage);
      closeModal(); toast(name + ' を追加しました'); render(currentId, currentSub);
    }, '追加する');
  }
  function deleteCast(name) {
    const used = (DATA.day0824.attendance || []).some(function (a) { return a.cast === name; });
    if (!confirm(name + ' を削除します。' + (used ? '\n※このキャストは当日の勤怠に入っています。' : '') + '\nよろしいですか？')) return;
    DATA.casts = DATA.casts.filter(function (c) { return c.name !== name; });
    persistCasts(); pushAudit('キャスト削除', name, 'あり', 'なし');
    toast(name + ' を削除しました'); render(currentId, currentSub);
  }
  // ---- 汎用の「新規登録」モーダル。項目を渡すだけで作れる ----
  function simpleForm(title, fields, onSave, okLabel) {
    const body = '<div class="row" style="gap:12px">' + fields.map(function (f) {
      const id = 'sf_' + f.key;
      let input;
      if (f.type === 'select') {
        input = '<select id="' + id + '" style="width:100%">' + f.options.map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (o[0] === f.value ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('') + '</select>';
      } else {
        input = '<input id="' + id + '" type="' + (f.type || 'text') + '"'
          + (f.type === 'number' ? ' min="0"' : '') + ' value="' + esc(f.value == null ? '' : f.value) + '"'
          + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + ' style="width:100%">';
      }
      return '<div style="flex:1;min-width:' + (f.wide ? '100%' : '150px') + '"><label>' + esc(f.label) + '</label><br>' + input + '</div>';
    }).join('') + '</div>' + '<div class="muted-note">登録するとその場で一覧に入り、保存されます。</div>';
    modal(title, body, function () {
      const v = {};
      fields.forEach(function (f) { v[f.key] = document.getElementById('sf_' + f.key).value.trim(); });
      if (onSave(v) !== false) { closeModal(); render(currentId, currentSub); }
    }, okLabel || '登録する');
  }
  function persistList(key, arr) { const st = loadStore(); st[key] = arr; saveStore(st); }

  // キープの新規登録／消込
  function newKeep() {
    const prods = DATA.products.filter(function (p) { return p.price > 0; });
    const custs = DATA.customers || [];
    simpleForm('キープを登録', [
      { key: 'product', label: 'メニュー名', type: 'select', options: prods.map(function (p) { return [p.name, p.name]; }) },
      { key: 'customer', label: 'お客さま', type: 'select', options: custs.map(function (c) { return [c.name, c.name]; }) },
      { key: 'start', label: '開始日', value: '2026-08-24', type: 'date' },
      { key: 'months', label: '有効期限（ヶ月）', value: DATA.keepDefaultMonths || 6, type: 'number' },
      { key: 'memo', label: 'メモ', wide: true, placeholder: '任意' },
    ], function (v) {
      if (!v.product || !v.customer) { toast('メニューとお客さまを選んでください'); return false; }
      const m = Number(v.months) || 6;
      const d = new Date(v.start); if (isNaN(d.getTime())) { toast('開始日を入れてください'); return false; }
      d.setMonth(d.getMonth() + m);
      const exp = d.toISOString().slice(0, 10);
      const pr = DATA.products.find(function (p) { return p.name === v.product; }) || { price: 0 };
      DATA.keeps.push({ product: v.product, price: pr.price, remain: '満量', start: v.start, expire: exp,
                        customer: v.customer, nameTag: v.customer, memo: v.memo || '' });
      persistList('keeps', DATA.keeps);
      pushAudit('キープ登録', v.customer + ' / ' + v.product, '(なし)', '期限 ' + exp);
      toast('キープを登録しました（期限 ' + exp + '）');
    });
  }
  function keepConsume(product) {
    const k = (DATA.keeps || []).find(function (x) { return x.product === product; });
    if (!k) { toast('見つかりませんでした'); return; }
    if (!confirm(k.customer + ' の「' + k.product + '」を消込します。よろしいですか？')) return;
    DATA.keeps = DATA.keeps.filter(function (x) { return x !== k; });
    persistList('keeps', DATA.keeps);
    pushAudit('キープ消込', k.customer + ' / ' + k.product, '有効', '消込済');
    toast('消込しました'); render(currentId, currentSub);
  }
  // スタッフの新規登録
  function newStaff() {
    simpleForm('スタッフを追加', [
      { key: 'name', label: '名前' },
      { key: 'daily', label: '日給', value: 10000, type: 'number' },
      { key: 'welfare', label: '厚生費%', value: 0, type: 'number' },
    ], function (v) {
      if (!v.name) { toast('名前を入れてください'); return false; }
      if (DATA.staff.some(function (s) { return s.name === v.name; })) { toast('同じ名前がすでにあります'); return false; }
      const id = Math.max.apply(null, DATA.staff.map(function (s) { return s.id; }).concat([0])) + 1;
      DATA.staff.push({ id: id, name: v.name, daily: Number(v.daily) || 0, welfare: Number(v.welfare) || 0, since: '2026-08' });
      persistList('staff', DATA.staff);
      pushAudit('スタッフ追加', v.name, '(なし)', '日給' + v.daily);
      toast(v.name + ' を追加しました');
    });
  }
  // 入出金項目の新規登録
  function newCostItem() {
    const kinds = Object.keys(SCHEMA.CostKind).map(function (k) {
      return [SCHEMA.CostKind[k].key, SCHEMA.CostKind[k].label];
    });
    simpleForm('入出金項目を追加', [
      { key: 'name', label: '項目名' },
      { key: 'kind', label: '種別', type: 'select', options: kinds, value: 'out_cash_gross', wide: true },
    ], function (v) {
      if (!v.name) { toast('項目名を入れてください'); return false; }
      const id = Math.max.apply(null, DATA.costItems.map(function (x) { return x.id; }).concat([10000])) + 1;
      DATA.costItems.push({ id: id, name: v.name, kind: v.kind });
      persistList('costItems', DATA.costItems);
      pushAudit('入出金項目 追加', v.name, '(なし)', v.kind);
      toast(v.name + ' を追加しました');
    });
  }
  // 給与項目の新規登録
  function newFeeItem() {
    simpleForm('給与項目を追加', [
      { key: 'name', label: '項目名' },
      { key: 'target', label: '対象', type: 'select', value: 'common',
        options: [['common', '共通'], ['cast', 'キャスト'], ['staff', 'スタッフ']] },
      { key: 'kind', label: '種類', type: 'select', value: 'minus',
        options: [['minus', 'マイナス'], ['bonus', 'ボーナス'], ['dailyPay', '日払い']] },
    ], function (v) {
      if (!v.name) { toast('項目名を入れてください'); return false; }
      const no = Math.max.apply(null, DATA.feeItems.map(function (x) { return x.no; }).concat([0])) + 1;
      DATA.feeItems.push({ no: no, name: v.name, target: v.target, kind: v.kind });
      persistList('feeItems', DATA.feeItems);
      pushAudit('給与項目 追加', v.name, '(なし)', v.target + '/' + v.kind);
      toast(v.name + ' を追加しました');
    });
  }
  // 伝票の絞り込み（期間・精算状態）
  function billSearch() {
    const g = function (k) { const el = document.querySelector('[data-save-key="bills:' + k + '"]'); return el ? el.value : ''; };
    const sel = document.querySelector('#content select');
    const from = g('from'), to = g('to');
    const state = sel ? sel.value : '全て表示';
    if (from && to && from > to) { toast('期間のFROMとTOが逆です'); return; }
    // 最大31日（本家と同じ制限）
    if (from && to) {
      const d = (new Date(to) - new Date(from)) / 86400000;
      if (d > 31) { toast('期間は最大31日までです'); return; }
    }
    UI.setBillFilter({ from: from, to: to, state: state });
    render('bills');
    const n = document.querySelectorAll('#content tbody tr').length - 1;
    toast('絞り込みました（' + Math.max(0, n) + '件）');
  }
  // 伝票を月間集計へ反映（当日の伝票から収支の行を作り直す）
  function billToMonth() {
    const bills = DATA.day0824.bills || [];
    const A = CALC.todayAggregate(bills, DATA.day0824.attendance);
    const row = DATA.financeDaily.find(function (r) { return r.date === '2026-08-24'; });
    if (!row) { toast('反映先の日が見つかりません'); return; }
    const before = row.salesTotal;
    if (!confirm('8/24 の伝票 ' + bills.length + '枚を、月間の収支に反映します。\n'
      + '売上計 ' + before.toLocaleString('ja-JP') + '円 → ' + A.settled.sales.toLocaleString('ja-JP') + '円（精算済ベース）\nよろしいですか？')) {
      toast('反映を取りやめました'); return;
    }
    row.cash = A.settled.cash; row.card = A.settled.card; row.credit = A.settled.credit;
    row.salesTotal = A.settled.sales;
    row.expenseTotal = row.remainingPay + row.maleDaily + row.femaleDaily + row.bonus + row.withdrawal;
    row.grossProfit = row.salesTotal + row.deposit - row.expenseTotal;
    row.payRate = CALC.payRate(row);
    const st = loadStore(); st.financeDaily = DATA.financeDaily; saveStore(st);
    pushAudit('月間へ反映', '2026-08-24', before.toLocaleString('ja-JP') + '円', row.salesTotal.toLocaleString('ja-JP') + '円');
    toast('月間に反映しました'); render('bills');
  }
  // お客さま分析の期間切替
  function custPeriod(v) { UI.setCustPeriod(v); render('customers', 'analysis'); }
  function persistData() { const st = loadStore(); st.bills = DATA.day0824.bills; st.customers = DATA.customers; saveStore(st); }
  function markSaved() {
    const p = document.getElementById('ymPill');
    if (p) { p.textContent = '保存済 ' + new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }); setTimeout(function () { p.textContent = '2026年 08月'; }, 2500); }
  }

  let currentSub = null;
  function goSub(id, sub) {
    if (!UI.screens[id]) { showError('画面が見つかりません', 'id=' + id, '存在する画面を選んでください'); return; }
    currentSub = sub;
    safePush({ id: id, sub: sub }, routeHash(id, sub)); // サブビューも履歴・URLに
    render(id, sub);
  }
  function render(id, sub) {
    const scr = UI.screens[id];
    currentId = id; currentSub = (sub === undefined ? null : sub);
    document.getElementById('pageTitle').textContent = scr.title;
    document.querySelectorAll('#nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-id') === id);
    });
    const c = document.getElementById('content');
    try {
      c.innerHTML = scr.render(sub);
      restoreInputs();
      if (id === 'cash') recalcCash();
      if (id === 'report') { document.querySelectorAll('#content tr[data-rrow]').forEach(function (row) { recalcReportRow(row.getAttribute('data-rrow')); }); updateReportWarning(); }
    } catch (e) {
      showError('画面の描画に失敗しました', String(e && e.message || e), 'データ形式を確認してください（' + id + '）');
    }
    window.scrollTo(0, 0);
  }

  // 入力の永続化（安定キー data-save-key のみ保存＝行の並び替え/増減で誤復元しない）
  function savableInputs() {
    return Array.prototype.slice.call(document.querySelectorAll('#content [data-save-key]'));
  }
  function restoreInputs() {
    const st = loadStore().inputs || {};
    savableInputs().forEach(function (inp) {
      const k = inp.getAttribute('data-save-key');
      if (st[k] != null) inp.value = st[k];
    });
  }
  let saveTimer = null;
  function onInputChange() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      const store = loadStore(); store.inputs = store.inputs || {};
      savableInputs().forEach(function (inp) { store.inputs[inp.getAttribute('data-save-key')] = inp.value; });
      saveStore(store);
    }, 300);
  }

  // 日報：入力に応じてその行の給与をその場で再計算
  function recalcReportRow(cast) {
    const row = document.querySelector('#content tr[data-rrow="' + cssEsc(cast) + '"]');
    if (!row) return;
    const get = function (f) { const el = row.querySelector('[data-rfield="' + f + '"]'); return el ? el.value : ''; };
    const n = function (f) { const v = Number((get(f) || '').trim() || 0); return Number.isFinite(v) && v >= 0 ? v : NaN; };
    const staff = (DATA.staff || []).find(function (s) { return s.name === cast; });
    const bCell = row.querySelector('.r-back'), wCell = row.querySelector('.r-welfare'), gCell = row.querySelector('.r-gross'), nCell = row.querySelector('.r-net');
    try {
      const dp = n('dailyPay'), late = n('late'), ab = n('absent'), pk = n('pickup'), bo = n('bonus');
      if ([dp, late, ab, pk, bo].some(function (x) { return !Number.isFinite(x); })) throw new Error('数値の入力が不正です');
      let p;
      if (staff) {
        p = CALC.staffPayroll(staff, { dailyPay: dp, late: late, absent: ab, pickup: pk, bonus: bo });
      } else {
        const found = (DATA.day0824.attendance || []).find(function (a) { return a.cast === cast; });
        const base = found || { cast: cast, start: '', end: null, drinks: [], req: { count: 0 }, dohan: { count: 0 }, field: { count: 0 } };
        const att = JSON.parse(JSON.stringify(base));
        att.start = get('start') || att.start;
        const end = get('end'); att.end = end && end.trim() ? end.trim() : null;
        att.dailyPay = dp; att.minus = late + ab + pk; att.bonus = bo;
        p = CALC.castPayroll(att);
      }
      bCell.textContent = p.back.toLocaleString('ja-JP');
      if (gCell) gCell.textContent = p.gross.toLocaleString('ja-JP');
      wCell.textContent = p.welfare.toLocaleString('ja-JP');
      nCell.textContent = p.net.toLocaleString('ja-JP'); nCell.style.color = p.net < 0 ? '#ff5c5c' : '';
    } catch (e) {
      nCell.textContent = '入力エラー'; nCell.style.color = '#ff5c5c'; nCell.title = String(e && e.message || e);
    }
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  // data-save-key "cust:<no>:<field>" をDATA.customersへ反映（分析・キープ画面でも一致させる）
  function applyCustInput(key, val) {
    const m = String(key).match(/^cust:([^:]+):(name|tel)$/); if (!m) return;
    const cust = (DATA.customers || []).find(function (c) { return String(c.no) === m[1]; }); if (!cust) return;
    if (m[2] === 'name') cust.name = val; else cust.phone = val;
    if (typeof persistData === 'function') persistData();
  }

  // ===== 音声入力（設定を声で編集）=====
  // 編集できる設定の一覧（別名で声から特定）
  const VSET = [
    { key:'reqBackAmount',   aliases:['リクエストバック','リクエストのバック','指名バック','本指名バック','リクエスト','本指名','指名'], unit:'円', type:'int' },
    { key:'fieldBackAmount', aliases:['場内リクエストバック','場内バック','場内リクエスト','場内指名','場内'], unit:'円', type:'int' },
    { key:'dohanBackAmount', aliases:['同伴バック','同伴のバック','同伴'], unit:'円', type:'int' },
    { key:'welfareRatePct',  aliases:['厚生費比率','厚生費率','厚生費','福利厚生'], unit:'%', type:'pct' },
    { key:'openHour',        aliases:['開業時間','営業開始','営業時間','開店時間','開店','オープン'], unit:'時', type:'int' },
    { key:'joshiClosingDay', aliases:['女子報酬締め日','報酬締め日','締め日','締日','締め'], unit:'日', type:'int' },
    { key:'target',          aliases:['月間目標','売上目標','目標売上','目標','ノルマ'], unit:'円', type:'int' },
  ];
  // 長い別名から先にマッチさせる（「場内」より「場内リクエストバック」優先）
  VSET.forEach(function(s){ s.aliases.sort(function(a,b){ return b.length-a.length; }); });
  const SET_RANGE={ openHour:[0,23], joshiClosingDay:[1,99], reqBackAmount:[0,100000], fieldBackAmount:[0,100000], dohanBackAmount:[0,100000], welfareRatePct:[0,50], target:[0,100000000] };
  // 設定キー→日本語ラベル（画面に内部キーを出さない）
  const SET_LABEL={}; VSET.forEach(function(s){ SET_LABEL[s.key]=s.aliases[0]; });
  function getSetting(k){ if(k==='welfareRatePct') return Math.round(DATA.store.welfareRate*100); return DATA.store[k]; }
  function setSetting(k,v){
    const r=SET_RANGE[k];
    if(r && (!Number.isFinite(v) || v<r[0] || v>r[1])){ toast('「'+(SET_LABEL[k]||k)+'」は '+r[0]+'〜'+r[1]+' で入力してください（入力値: '+v+'）'); return false; }
    if(k==='welfareRatePct') DATA.store.welfareRate = v/100; else DATA.store[k]=v;
    const st=loadStore(); st.store=st.store||{};
    st.store[k==='welfareRatePct'?'welfareRate':k] = (k==='welfareRatePct'? v/100 : v);
    saveStore(st);
    return true;
  }
  // 声で拾った設定は、確認してから保存する（聞き間違いで黙って書き換えないため）
  function confirmSetting(spec, v) {
    const before = getSetting(spec.key);
    const show = function (x) { return spec.type === 'pct' ? x + '%' : Number(x).toLocaleString('ja-JP') + spec.unit; };
    const body = '<div style="font-size:15px;line-height:1.9">'
      + '<div class="kv"><span class="k">項目</span><span class="v">' + esc(spec.aliases[0]) + '</span></div>'
      + '<div class="kv"><span class="k">今の値</span><span class="v">' + esc(show(before)) + '</span></div>'
      + '<div class="kv"><span class="k">新しい値</span><span class="v" style="color:var(--green);font-weight:700">' + esc(show(v)) + '</span></div>'
      + '</div><div class="muted-note">この内容で登録します。違うときは「キャンセル」を押してください。</div>';
    modal('この設定に変更しますか？', body, function () {
      if (setSetting(spec.key, v)) {          // 失敗時は setSetting 側がトーストを出す＝成功風の嘘を出さない
        pushAudit('設定変更', spec.aliases[0], show(before), show(v));
        toast('「' + spec.aliases[0] + '」を ' + show(v) + ' に登録しました');
        closeModal();
        if (currentId === 'settings') render('settings');
      }
    }, '登録する');
  }
  // 変更履歴（誰が・いつ・何を・前→後）。給与トラブル時に追えるようにする
  function pushAudit(action, target, before, after) {
    try {
      const st = loadStore(); st.audit = st.audit || [];
      st.audit.push({ at: new Date().toISOString(), action: action, target: target, before: String(before), after: String(after) });
      if (st.audit.length > 500) st.audit = st.audit.slice(-500);
      saveStore(st);
    } catch (e) {}
  }
  // 全角/カンマ/漢数字(千・万・百)をざっくり数値化
  function normNum(s){
    if(!s) return NaN;
    s=String(s).replace(/[０-９]/g,function(d){return '0123456789'['０１２３４５６７８９'.indexOf(d)];}).replace(/[,、\s円%]/g,'');
    // アラビア数字＋漢字単位（万/千/百）のトークンを合算。「1万5千」「350万」「3000」等に対応
    const mult={ '万':10000,'千':1000,'百':100,'':1 };
    let tokens=[], re=/(\d+(?:\.\d+)?)(万|千|百)?/g, mm, hasUnit=false;
    while((mm=re.exec(s))){ tokens.push([parseFloat(mm[1]), mm[2]||'']); if(mm[2]) hasUnit=true; }
    if(tokens.length){
      if(hasUnit) return tokens.reduce(function(a,t){ return a + t[0]*mult[t[1]]; },0);
      return tokens[0][0]; // 単位なしは先頭の数値（例:「18時」→18）
    }
    // 純漢数字（簡易）
    const K={〇:0,零:0,一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
    let man=0,cur=0,unit=0,tmp=0,ok=false;
    for(const ch of s){
      if(ch in K){tmp=K[ch];cur+=tmp;ok=true;}
      else if(ch==='十'){cur+=(tmp||1)*10-tmp;tmp=0;ok=true;}
      else if(ch==='百'){cur+=(tmp||1)*100-tmp;tmp=0;ok=true;}
      else if(ch==='千'){cur+=(tmp||1)*1000-tmp;tmp=0;ok=true;}
      else if(ch==='万'){man+=(cur||1)*10000;cur=0;tmp=0;ok=true;}
    }
    return ok? man+cur : NaN;
  }
  // 1つの発話候補を解釈して「設定 or 用語」の更新に落とす（当たれば実行してtrue）
  const numRe = /[0-9０-９一二三四五六七八九十百千万]/;
  function interpret(text){
    if(!text) return false;
    // 1) 数値設定を先に判定（別名は長い順に照合＝「場内リクエスト」を「リクエスト」に誤爆させない）
    let flat=[]; VSET.forEach(function(s){ s.aliases.forEach(function(a){ flat.push({s:s,a:a}); }); });
    flat.sort(function(x,y){ return y.a.length-x.a.length; });
    const found = flat.find(function(f){ return text.indexOf(f.a)>=0; });
    if(found){
      const val = normNum(text);
      if(Number.isFinite(val)){
        const v = found.s.type==='int'?Math.round(val):val;
        // 声は即保存せず、必ず「これでいいですか」を挟む（聞き間違いで黙って書き換えないため）
        confirmSetting(found.s, v);
        return true;
      }
    }
    // 2) 用語変更: 「本指名をリクエストに」等。数字を含む発話は用語変更にしない（金額コマンドの誤爆防止）
    if(!numRe.test(text)){
      const termKey = Object.keys(DATA.terms).find(function(k){ return text.indexOf(k)>=0; });
      if(termKey){
        let after = text.split(termKey).slice(1).join(termKey);
        after = after.replace(/^\s*(を|は|→|:|：)?\s*/,'').replace(/\s*(に(して|する|変更|変えて)?|へ)?[。\s]*$/,'').trim();
        // 数字を含む発話は上で除外済みなので、ここは用語変更として素直に採用（新名称がバック別名でも可）
        if(after && after.length<=12){
          DATA.terms[termKey]=after;
          const st=loadStore(); st.inputs=st.inputs||{}; st.inputs['term:'+termKey]=after; saveStore(st);
          toast('用語「'+termKey+'」→「'+after+'」に登録（次画面から反映）');
          if(currentId==='settings') render('settings');
          return true;
        }
      }
    }
    return false;
  }
  // 複数候補（認識のブレ）から最初に解釈できたものを採用＝実効精度を上げる
  function applyVoiceCommand(alts){
    const list = Array.isArray(alts)? alts : [alts];
    for(const a of list){ if(interpret(a)) return; }
    const top = list[0]||'';
    toast('登録できませんでした:「'+top+'」 例:「同伴バックを3000円」「厚生費を10パーセント」「開業時間を18時」');
  }
  // 音声認識の起動。maxAlternativesで複数候補を取り、解釈器に渡す。
  let recog=null;
  function startVoice(onResult, btn){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ toast('このブラウザは音声入力に未対応です（Chrome推奨）'); return; }
    try{ if(recog){ recog.stop(); } }catch(e){}
    recog=new SR(); recog.lang='ja-JP'; recog.interimResults=false; recog.maxAlternatives=5;
    if(btn) btn.classList.add('rec');
    recog.onresult=function(e){
      const r=e.results[0]; const alts=[];
      for(let i=0;i<r.length;i++) alts.push(r[i].transcript);
      onResult(alts.length>1? alts : alts[0]);
    };
    recog.onerror=function(e){ toast('音声エラー: '+(e.error||'')+'（マイク許可を確認）'); };
    recog.onend=function(){ if(btn) btn.classList.remove('rec'); recog=null; };
    try{ recog.start(); toast('お話しください…'); }catch(e){ toast('音声を開始できませんでした'); }
  }

  // 日報の未入力バナーを実データで更新（固定文字列にしない）
  function updateReportWarning() {
    const bar = document.getElementById('reportWarn'); if (!bar) return;
    // 「開始が入っている人」＝その日出勤した人だけを数える。
    // 休みの人まで数えると毎日「未入力12人」と出続けて、本当の入れ忘れを見逃す。
    let working = 0, noEnd = 0;
    document.querySelectorAll('#content tr[data-rrow]').forEach(function (row) {
      const st = row.querySelector('[data-rfield="start"]'), en = row.querySelector('[data-rfield="end"]');
      if (!st || !st.value.trim()) return;      // 開始が空＝休み
      working++;
      if (!en || !en.value.trim()) noEnd++;
    });
    // 率バックなのに元の売上が取れていない人（黙って0円になるのを気づけるように）
    const rw = (typeof CALC.takeRateWarnings === 'function') ? CALC.takeRateWarnings() : [];
    const kindName = { req: 'リクエスト', field: '場内', dohan: '同伴' };
    const warn = function (html) {
      bar.className = 'okbar';
      bar.style.cssText = 'background:#fbf3d6;border-color:#ecdca0;color:#7a5f14';
      bar.innerHTML = html;
    };
    if (rw.length) {
      const names = rw.map(function (w) { return w.cast + 'の' + (kindName[w.kind] || w.kind); });
      warn('⚠️ バックを「%」で設定していますが、元になる売上が入っていないため <b>0円</b>で計算されています（'
        + names.slice(0, 3).join('・') + (names.length > 3 ? ' ほか' : '') + '）— 伝票を登録するか、金額での設定に変えてください');
      return;
    }
    if (working === 0) {
      bar.className = 'okbar'; bar.style.cssText = '';
      bar.innerHTML = '出勤したキャストの「開始」を入れると、給与がその場で計算されます';
    } else if (noEnd === 0) {
      bar.className = 'okbar'; bar.style.cssText = '';
      bar.innerHTML = '✅ 出勤 ' + working + '人 すべて入力済み';
    } else {
      warn('⚠️ 未入力: 勤怠終了 ' + noEnd + '人 — 各行の「終了」を入力してください（出勤 ' + working + '人）');
    }
  }

  // レジ金種の再計算（NaN/マイナスは赤字で可視化）
  function recalcCash() {
    let total = 0, bad = false, missing = false;
    document.querySelectorAll('#cashTable [data-denom]').forEach(function (inp) {
      const denom = Number(inp.getAttribute('data-denom'));
      const cell = inp.parentElement.nextElementSibling;
      if (inp.value.trim() === '') { missing = true; cell.textContent = '未入力'; cell.style.color = '#6e7b8a'; return; }
      const cnt = Number(inp.value);
      if (!Number.isInteger(cnt) || cnt < 0) { bad = true; cell.textContent = '不正'; cell.style.color = '#ff5c5c'; return; }
      const amt = denom * cnt; total += amt; cell.textContent = amt.toLocaleString('ja-JP'); cell.style.color = '';
    });
    const tt = document.getElementById('cashTotal');
    if (tt) {
      tt.textContent = bad ? '入力エラー' : (missing ? '未入力あり (' + total.toLocaleString('ja-JP') + ')' : total.toLocaleString('ja-JP'));
      tt.style.color = (bad || missing) ? '#ff5c5c' : '';
    }
    // 実査(金種合計)と理論値から過不足を出す。ここが0固定だとレジ締めに使えない
    const note = document.getElementById('cashTheory');
    const cc = document.getElementById('cashCounted'), cd = document.getElementById('cashDiff');
    if (note && cc && cd) {
      const theory = Number(note.getAttribute('data-theory')) || 0;
      const diff = total - theory;
      cc.textContent = '¥' + total.toLocaleString('ja-JP');
      cd.textContent = (diff > 0 ? '+' : '') + '¥' + diff.toLocaleString('ja-JP');
      cd.style.color = bad ? '#ff5c5c' : (diff === 0 ? 'var(--green)' : (diff < 0 ? '#ff5c5c' : '#b8860b'));
      cd.title = diff === 0 ? '理論値どおりです' : (diff < 0 ? '理論値より少ないです' : '理論値より多いです');
    }
  }
  // レジ精算を確定して残す（誰がいつ締めたか追えるようにする）
  function cashClose() {
    const note = document.getElementById('cashTheory'), cc = document.getElementById('cashCounted');
    if (!note || !cc) { toast('現金管理の画面で押してください'); return; }
    const theory = Number(note.getAttribute('data-theory')) || 0;
    const counted = Number(String(cc.textContent).replace(/[^0-9-]/g, '')) || 0;
    const diff = counted - theory;
    if (!confirm('この内容でレジ精算を確定します。\n理論値 ¥' + theory.toLocaleString('ja-JP')
      + ' / 実査 ¥' + counted.toLocaleString('ja-JP') + ' / 過不足 ' + (diff >= 0 ? '+' : '') + '¥' + diff.toLocaleString('ja-JP')
      + '\nよろしいですか？')) { toast('精算を取りやめました'); return; }
    const st = loadStore();
    st.cashClose = st.cashClose || {};
    st.cashClose['2026-08-24'] = { theory: theory, counted: counted, diff: diff, at: new Date().toISOString() };
    saveStore(st);
    pushAudit('レジ精算', '2026-08-24', '理論 ' + theory, '実査 ' + counted + '（過不足 ' + diff + '）');
    toast(diff === 0 ? 'レジ精算を確定しました（過不足なし）' : 'レジ精算を確定しました（過不足 ' + (diff > 0 ? '+' : '') + diff.toLocaleString('ja-JP') + '円）');
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function showError(cause, detail, next) {
    const c = document.getElementById('content');
    c.innerHTML = '<div class="errbar"><b>' + esc(cause) + '</b><br>原因: ' + esc(detail) + '<br>次の一手: ' + esc(next) + '</div>';
  }
  function toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 1800);
  }

  function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('backdrop').classList.remove('on'); }

  // ===== モーダル（伝票明細入力など）=====
  function modal(title, bodyHtml, onOk, okLabel) {
    closeModal();
    const wrap = document.createElement('div'); wrap.id = 'modalWrap'; wrap.className = 'modalwrap';
    wrap.innerHTML = '<div class="modal"><div class="mhead"><b>' + esc(title) + '</b><button class="hx" id="mClose">✕</button></div>'
      + '<div class="mbody">' + bodyHtml + '</div>'
      + '<div class="mfoot"><button class="btn" id="mCancel">キャンセル</button><button class="btn gold" id="mOk">' + esc(okLabel || '登録') + '</button></div></div>';
    document.body.appendChild(wrap);
    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;
    document.getElementById('mOk').onclick = function () { if (onOk) onOk(); };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeModal(); });
  }
  function closeModal() { const m = document.getElementById('modalWrap'); if (m) m.remove(); }

  // ===== 実CSV出力 / PDF印刷 =====
  function csvDownload(name, csv) {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); // BOM付き=Excelで文字化けしない
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  function tableToCsv(table) {
    return Array.prototype.map.call(table.querySelectorAll('tr'), function (tr) {
      return Array.prototype.map.call(tr.querySelectorAll('th,td'), function (c) {
        const inp = c.querySelector('input,select'); const v = inp ? inp.value : c.textContent.trim();
        return '"' + String(v).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\r\n');
  }
  // Excel出力は3系統（本家と同じ）
  //   normal … 今の画面に出ている表
  //   all    … その画面の元データを全件（絞り込みを外した状態）
  //   legacy … 旧形式（1行1レコード・見出しを英字キーに）
  function exportCSV(kind, mode) {
    mode = mode || 'normal';
    if (mode === 'all') return exportAll(kind);
    if (mode === 'legacy') return exportLegacy(kind);
    const tables = document.querySelectorAll('#content table');
    if (!tables.length) { toast('出力できる表がありません'); return; }
    const csv = Array.prototype.map.call(tables, tableToCsv).join('\r\n\r\n');
    csvDownload((kind || 'export') + '_2026-08.csv', csv);
    toast('Excelに書き出しました（表示中の分）');
  }
  // 全件（画面の絞り込みを無視して元データから出す）
  function exportAll(kind) {
    const rows = [];
    if (currentId === 'bills') {
      rows.push(['№', '伝票ID', '入店', '退店', '卓', '客数', 'タグ', '現金', 'カード', '売掛', '合計', '状態']);
      DATA.day0824.bills.forEach(function (b) {
        rows.push([b.no, b.uuid, b.in, b.out, b.table, b.guests, b.tag || '', b.cash || 0, b.card || 0,
                   b.credit || 0, CALC.billTotal(b), b.settled ? '精算済' : '未精算']);
      });
    } else {
      rows.push(SCHEMA.financeFields);
      DATA.financeDaily.forEach(function (r) {
        rows.push(SCHEMA.financeFields.map(function (k) { return r[k]; }));
      });
    }
    csvDownload((kind || 'export') + '_all_2026-08.csv', rows.map(csvRow).join('\r\n'));
    toast('Excel(All)に書き出しました（' + (rows.length - 1) + '件）');
  }
  // 旧形式（見出しを英字キーにした1行1レコード。古い会計ソフトに取り込む用）
  function exportLegacy(kind) {
    const rows = [SCHEMA.financeFields];
    DATA.financeDaily.forEach(function (r) {
      rows.push(SCHEMA.financeFields.map(function (k) {
        const v = r[k]; return typeof v === 'boolean' ? (v ? 1 : 0) : v;
      }));
    });
    csvDownload((kind || 'export') + '_legacy_2026-08.csv', rows.map(csvRow).join('\r\n'));
    toast('旧Excel形式で書き出しました');
  }
  function csvRow(a) {
    return a.map(function (v) {
      const s = String(v == null ? '' : v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }
  function newCustomer() {
    const castOpts = '<option value="">なし</option>' + DATA.casts.map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join('');
    const g = function (l, f) { return '<div style="flex:1;min-width:150px;margin-bottom:10px"><label>' + l + '</label><br>' + f + '</div>'; };
    const body = '<div class="row" style="gap:12px">'
      + g('名前', '<input id="ncName" type="text" style="width:100%">')
      + g('あだ名', '<input id="ncNick" type="text" style="width:100%">')
      + g('紹介元', '<input id="ncRef" type="text" style="width:100%">')
      + g('電話番号', '<input id="ncTel" type="text" style="width:100%">')
      + g('担当キャスト', '<select id="ncMain">' + castOpts + '</select>')
      + g('会社名', '<input id="ncCorp" type="text" style="width:100%">')
      + '</div>';
    modal('新規お客さま', body, function () {
      const v = function (id) { return document.getElementById(id).value; };
      if (!v('ncName').trim()) { toast('名前を入力してください'); return; }
      DATA.customers.push({ no: DATA.customers.length + 1, name: v('ncName'), rank: 'C', visits: 0, last: '—', first: '2026-08-25', avg: 0, main: v('ncMain'), attrs: ['新規'], phone: v('ncTel') }); persistData();
      closeModal(); toast('お客さまを登録しました'); render('customers', 'list');
    }, '登録する');
  }
  function copyTable() {
    const tb = document.querySelector('#content table'); if (!tb) { toast('コピーする表がありません'); return; }
    const tsv = Array.prototype.map.call(tb.querySelectorAll('tr'), function (tr) {
      return Array.prototype.map.call(tr.querySelectorAll('th,td'), function (c) { const inp = c.querySelector('input,select'); return (inp ? inp.value : c.textContent.trim()); }).join('\t');
    }).join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(tsv).then(function () { toast('コピーしました'); }, function () { toast('コピーに失敗'); });
    else toast('このブラウザはコピー未対応');
  }
  function printPaySlip(kind) {
    const tables = document.querySelectorAll('#content table');
    let inner = '';
    Array.prototype.forEach.call(tables, function (tb) { const cl = tb.cloneNode(true); cl.querySelectorAll('input,select').forEach(function (el) { const td = el.closest('td'); if (td) td.textContent = el.value; }); inner += cl.outerHTML; });
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { toast('ポップアップを許可してください'); return; }
    w.document.write('<!DOCTYPE html><meta charset="utf-8"><title>報酬明細 2026年8月</title>'
      + '<style>body{font-family:"Hiragino Sans",sans-serif;padding:24px;color:#22271d}'
      + 'h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:12px;margin-top:10px}'
      + 'th,td{border:1px solid #4a5260;padding:7px 9px;text-align:right}th,td:first-child{text-align:left}'
      + 'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '@media print{button{display:none}}</style>'
      + '<h1>報酬明細 — ' + (kind === 'staff' ? 'スタッフ' : 'キャスト') + ' / 2026年8月（' + DATA.store.name + '）</h1>'
      + '<button onclick="print()" style="padding:8px 16px;margin:8px 0">印刷 / PDF保存</button>' + inner);
    w.document.close(); setTimeout(function () { try { w.print(); } catch (e) {} }, 400);
  }
  function newBill() {
    const yen = UI.yen, t = function (k) { return esc(DATA.t(k)); }; // ui.js のIIFE内には無いのでここで用意
    const castOpts = DATA.casts.map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join('');
    const prodOpts = DATA.products.filter(function (p) { return p.price > 0; }).map(function (p) { return '<option value="' + esc(p.name) + '">' + esc(p.name) + ' (' + yen(p.price) + ')</option>'; }).join('');
    const tagOpts = '<option value="">なし</option>' + DATA.tags.map(function (t) { return '<option>' + esc(t.name) + '</option>'; }).join('');
    const g = function (l, f) { return '<div style="margin-bottom:10px"><label>' + l + '</label><br>' + f + '</div>'; };
    const body =
      '<div class="row" style="gap:12px">'
      + '<div style="flex:1;min-width:120px">' + g('卓番号', '<input id="nbTable" type="number" min="1" value="1" style="width:100%">') + '</div>'
      + '<div style="flex:1;min-width:120px">' + g('客数', '<input id="nbGuests" type="number" min="1" value="1" style="width:100%">') + '</div>'
      + '<div style="flex:1;min-width:120px">' + g('入店', '<input id="nbIn" type="text" value="21:00" style="width:100%">') + '</div>'
      + '<div style="flex:1;min-width:120px">' + g('退店', '<input id="nbOut" type="text" value="23:00" style="width:100%">') + '</div>'
      + '</div>'
      + '<div class="row" style="gap:12px">'
      + '<div style="flex:1;min-width:150px">' + g('タグ(集客)', '<select id="nbTag">' + tagOpts + '</select>') + '</div>'
      + '<div style="flex:1;min-width:150px">' + g(t('本指名') + 'キャスト', '<select id="nbReqCast">' + castOpts + '</select>') + '</div>'
      + '<div style="flex:1;min-width:110px">' + g(t('本指名') + '回数', '<input id="nbReq" type="number" min="0" value="0" style="width:100%">') + '</div>'
      + '<div style="flex:1;min-width:110px">' + g(t('同伴') + '回数', '<input id="nbDohan" type="number" min="0" value="0" style="width:100%">') + '</div>'
      + '</div>'
      + '<div class="row" style="gap:12px">'
      + '<div style="flex:1;min-width:150px">' + g('商品', '<select id="nbProd">' + prodOpts + '</select>') + '</div>'
      + '<div style="flex:1;min-width:110px">' + g('個数', '<input id="nbQty" type="number" min="0" value="0" style="width:100%">') + '</div>'
      + '<div style="flex:1;min-width:120px">' + g('サービス料', '<input id="nbSvc" type="number" min="0" value="0" style="width:100%">') + '</div>'
      + '<div style="flex:1;min-width:120px">' + g('値引き', '<input id="nbDisc" type="number" min="0" value="0" style="width:100%">') + '</div>'
      + '</div>'
      + '<div class="row" style="gap:12px">'
      + '<div style="flex:1;min-width:150px">' + g('現金', '<input id="nbCash" type="number" min="0" value="0" style="width:100%">') + '</div>'
      + '<div style="flex:1;min-width:150px">' + g('カード', '<input id="nbCard" type="number" min="0" value="0" style="width:100%">') + '</div>'
      + '</div>'
      + '<div class="muted-note">登録すると伝票一覧に追加され、売上・現金・カードに反映されます。給与は勤怠報告の指名回数・商品個数から計算されます。</div>';
    modal('新規伝票（明細入力）', body, function () {
      const v = function (id) { return document.getElementById(id).value; };
      const nv = function (id) { return Number(v(id)) || 0; };
      const timeRe = /^([0-2]?\d):[0-5]\d$/;   // 25:00・26:00（翌日）も受ける
      if (!timeRe.test(v('nbIn').trim()) || !timeRe.test(v('nbOut').trim())) { toast('入店・退店は「21:00」のように入力してください'); return; }
      const guests = nv('nbGuests'); if (!Number.isInteger(guests) || guests <= 0) { toast('客数は1以上で入力してください'); return; }
      const prod = v('nbProd'), qty = nv('nbQty');
      const bill = {
        no: (DATA.day0824.bills.length + 1), uuid: 'NEW-' + Date.now().toString(16).toUpperCase(),
        in: v('nbIn'), out: v('nbOut'), table: nv('nbTable'), guests: nv('nbGuests'),
        req: nv('nbReq') ? [{ cast: v('nbReqCast'), count: nv('nbReq'), amount: 0 }] : [],
        dohan: nv('nbDohan') ? [{ cast: v('nbReqCast'), count: nv('nbDohan'), amount: 0 }] : [], field: [],
        items: qty ? [{ name: prod, qty: qty }] : [],
        service: nv('nbSvc'), discount: nv('nbDisc'), tag: v('nbTag'),
        cash: nv('nbCash'), card: nv('nbCard'), credit: 0, settled: false,
      };
      DATA.day0824.bills.push(bill); persistData();
      closeModal(); toast('伝票を登録しました（№' + bill.no + '）'); render('bills');
    }, '登録する');
  }

  // ===== 現場向け ヘルプチャット（使い方を質問）=====
  // アプリを熟知したアシスタントの回答ナレッジ（キーワード一致）
  const HELP = [
    { k:['日報','勤怠','出勤','退勤','終了','開始','入力','つけ方','入れ方'], a:'「日報登録」で、キャストの<b>開始・終了時刻と日払い</b>を入れるだけ。バック・厚生費・残り支給は<b>自動で計算</b>されます。空欄の終了があると上に警告が出ます。', go:'report' },
    { k:['設定','変更','バック','厚生費','締め','目標','開業','音声で','声で'], a:'「設定」画面の一番上の<b>大きなマイク</b>を押して話すだけ。例:「同伴バックを3000円」「厚生費を10パーセント」。各項目のマイクや手入力でもOK。', go:'settings' },
    { k:['売上','今日','今月','いくら','まとめ','ダッシュ'], a:'「まとめ」で月間と当日の<b>売上・経費・粗利</b>が一目で分かります。日別の推移グラフも下にあります。', go:'summary' },
    { k:['粗利','利益','儲け'], a:'粗利＝売上＋入金−経費。「まとめ」と「収支」で確認できます。収支は<b>赤字の日が赤く</b>表示されます。', go:'balance' },
    { k:['給料','給与','バック','報酬','時給','支給'], a:'当日の給与は「リアルタイム集計」の勤怠報告で自動計算。月まとめの給与は「キャスト」画面（報酬明細PDF）で見られます。', go:'realtime' },
    { k:['レジ','現金','精算','金種','お金','過不足'], a:'「現金管理」で<b>金種（お札・小銭）の枚数</b>を入れると金額と合計が自動計算。理論値との差（過不足）も出ます。', go:'cash' },
    { k:['商品','ドリンク','ボトル','何本','数量'], a:'「売上商品集計」で商品ごとの売れた数・売上・バックが見られます。「商品別・日別」タブで日別クロス表も。', go:'items' },
    { k:['タグ','集客','担当','紹介'], a:'「タグ」は集客担当ごとの売上集計です。まとめの「タグ対象額」と連動します。', go:'tags' },
    { k:['お客','顧客','ランク','キープ'], a:'「お客さま管理」で顧客のランク（S〜D）や属性を管理します。ランクは直近3ヶ月の来店回数で自動判定。', go:'customers' },
    { k:['保存','バックアップ','消え','復元','戻す'], a:'入力は<b>自動保存</b>されます。念のため「設定」の<b>バックアップ書き出し</b>でファイル保存、別端末では「読み込み」で復元できます。', go:'settings' },
    { k:['一致','検算','合ってる','正しい','1円'], a:'「まとめ」上部の緑バーが<b>本家システムと1円一致</b>の自動チェックです。ズレると赤で理由が出ます。', go:'summary' },
    { k:['用語','名前','呼び方','リクエスト','指名'], a:'「設定」の用語カスタマイズで、本指名→リクエスト等、店の呼び方に変えられます（次に開いた画面から反映）。', go:'settings' },
    { k:['スマホ','携帯','戻る','メニュー'], a:'スマホは左上の三本線でメニュー。表は横スクロール、カードは縦積みで見やすくなります。' },
    { k:['起動','開き方','開けない','立ち上げ'], a:'デスクトップの「Dシステム改を起動.command」をダブルクリックすると開きます。音声入力に対応しています。' },
  ];
  function helpAnswer(q){
    if(!q||!q.trim()) return { a:'「日報の入力は？」「音声で設定を変えたい」「レジ精算のやり方」など、知りたい操作を話すか入力してください。' };
    const t=q; let best=null, bestScore=0;
    HELP.forEach(function(h){ let sc=0; h.k.forEach(function(k){ if(t.indexOf(k)>=0) sc++; }); if(sc>bestScore){bestScore=sc;best=h;} });
    if(best&&bestScore>0) return best;
    return { a:'ごめんなさい、うまく分かりませんでした。<b>よくある質問</b>: 日報の入力／音声で設定変更／売上の見方／レジ精算／給料の計算。この中から選んで聞いてみてください。' };
  }
  function helpPush(who, html){
    const box=document.getElementById('helpMsgs'); if(!box) return;
    const m=document.createElement('div'); m.className='hmsg '+who; m.innerHTML=html; box.appendChild(m); box.scrollTop=box.scrollHeight;
  }
  function helpAsk(q){
    if(!q||!q.trim()) return;
    helpPush('u', esc(q));
    const r=helpAnswer(q);
    let html=r.a;
    if(r.go) html+='<div style="margin-top:8px"><button class="btn sm gold" onclick="APP.helpGo(\''+r.go+'\')">その画面をひらく</button></div>';
    setTimeout(function(){ helpPush('a', html); }, 150);
  }
  function buildHelp(){
    if(document.getElementById('helpFab')) return;
    const fab=document.createElement('button'); fab.id='helpFab'; fab.className='helpfab';
    fab.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z"/><path d="M9.2 9.5a2.8 2.8 0 0 1 5.3 1c0 1.8-2.7 2.2-2.7 4"/><path d="M12 17.5h.01"/></svg><span>使い方</span>';
    const panel=document.createElement('div'); panel.id='helpPanel'; panel.className='helppanel';
    panel.innerHTML='<div class="hhead"><b>使い方チャット</b><span class="mut" style="font-weight:400;font-size:12px">分からない操作を質問</span>'
      +'<button class="hx" onclick="APP.helpToggle(false)" aria-label="閉じる">✕</button></div>'
      +'<div id="helpMsgs" class="hmsgs"></div>'
      +'<div class="hinput"><input id="helpQ" type="text" placeholder="例: 日報の入力は？" >'
      +'<button class="micbtn" onclick="APP.helpVoice(this)" aria-label="音声で質問">'+ '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v4M9 21h6"/></svg>' +'</button>'
      +'<button class="btn sm gold" onclick="APP.helpSend()">送信</button></div>';
    document.body.appendChild(fab); document.body.appendChild(panel);
    fab.addEventListener('click', function(){ helpToggle(true); });
    panel.querySelector('#helpQ').addEventListener('keydown', function(e){ if(e.key==='Enter') helpSend(); });
    // 初回あいさつ
    helpPush('a','こんにちは！このアプリの使い方をお手伝いします。<br>「日報の入力は？」「音声で設定を変えたい」などを、<b>入力</b>か<b>マイク</b>で聞いてください。');
  }
  function helpToggle(open){ const p=document.getElementById('helpPanel'), f=document.getElementById('helpFab'); if(!p) return;
    const show = open===undefined? !p.classList.contains('open') : open;
    p.classList.toggle('open', show); if(f) f.style.display = show? 'none':'';
    if(show && !matchMedia('(max-width:860px)').matches){ const i=document.getElementById('helpQ'); if(i) setTimeout(function(){i.focus();},50); } }
  function helpSend(){ const i=document.getElementById('helpQ'); if(!i) return; const q=i.value; i.value=''; helpAsk(q); }
  function helpVoice(btn){ startVoice(function(res){ const q=Array.isArray(res)?res[0]:res; const i=document.getElementById('helpQ'); if(i) i.value=q; helpAsk(q); }, btn); }
  function helpGo(id){ helpToggle(false); go(id); }

  function init() {
    // 起動アニメは初回だけたっぷり見せる。2回目からは素早く消す（営業中に待たせない）
    try {
      if (localStorage.getItem('d-system-kai:seen')) document.body.classList.add('seen');
      localStorage.setItem('d-system-kai:seen', '1');
    } catch (e) {}
    // 保存済みの用語カスタマイズ・設定値を起動時に適用（再読み込みでも効く）
    try {
      const store = loadStore();
      const inp = store.inputs || {};
      Object.keys(inp).forEach(function (k) { if (k.indexOf('term:') === 0 && inp[k]) DATA.terms[k.slice(5)] = inp[k]; });
      if (store.store) Object.keys(store.store).forEach(function (k) { DATA.store[k] = store.store[k]; });  // 数値・文字列・真偽値すべて
      if (Array.isArray(store.bills)) DATA.day0824.bills = store.bills;
      if (Array.isArray(store.customers)) DATA.customers = store.customers;
      if (Array.isArray(store.casts) && store.casts.length) DATA.casts = store.casts;
      if (Array.isArray(store.staff) && store.staff.length) DATA.staff = store.staff;
      if (Array.isArray(store.keeps)) DATA.keeps = store.keeps;
      if (Array.isArray(store.costItems) && store.costItems.length) DATA.costItems = store.costItems;
      if (Array.isArray(store.feeItems) && store.feeItems.length) DATA.feeItems = store.feeItems;
      if (Array.isArray(store.financeDaily) && store.financeDaily.length === DATA.financeDaily.length) DATA.financeDaily = store.financeDaily;
      // お客さま一覧のインライン編集（名前/電話）をDATAへ反映＝分析・キープ画面でも一致
      Object.keys(inp).forEach(function (k) { if (k.indexOf('cust:') === 0 && inp[k] != null) applyCustInput(k, inp[k]); });
    } catch (e) {}
    buildNav();
    // メニュー(スマホ)
    document.getElementById('menuBtn').addEventListener('click', function () {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('backdrop').classList.toggle('on');
    });
    document.getElementById('backdrop').addEventListener('click', closeSidebar);
    window.addEventListener('popstate', function (e) {
      const r = (e.state && e.state.id) ? { id: e.state.id, sub: e.state.sub || null } : parseHash();
      render(UI.screens[r.id] ? r.id : 'summary', r.sub);
    });
    // 入力の保存＋レジ再計算（イベント委譲）
    document.getElementById('content').addEventListener('input', function (e) {
      onInputChange();
      const el = e.target;
      if (el.hasAttribute && el.hasAttribute('data-denom')) recalcCash();
      if (el.hasAttribute && el.hasAttribute('data-rcast')) { recalcReportRow(el.getAttribute('data-rcast')); updateReportWarning(); }
      if (el.hasAttribute && el.hasAttribute('data-term')) DATA.terms[el.getAttribute('data-term')] = el.value; // 反映は次画面から
      if (el.getAttribute && (el.getAttribute('data-save-key') || '').indexOf('cust:') === 0) applyCustInput(el.getAttribute('data-save-key'), el.value);
    });
    // 用語は打ち終わり(change)で1回だけ通知。設定値(data-setting)は保存して反映
    document.getElementById('content').addEventListener('change', function (e) {
      const el = e.target;
      if (el.hasAttribute && el.hasAttribute('data-term')) toast('用語を更新しました（次の画面から反映）');
      // キャストごとの時給・厚生費
      if (el.hasAttribute && el.hasAttribute('data-cast')) {
        const name = el.getAttribute('data-cast'), field = el.getAttribute('data-field');
        const c = (DATA.casts || []).find(function (x) { return x.name === name; });
        if (c) {
          const raw = el.value.trim();
          const before = c[field];
          if (raw === '') { c[field] = (field === 'welfare' ? null : 0); }
          else {
            const v = Number(raw);
            if (!Number.isFinite(v) || v < 0) { toast('0以上の数字を入れてください'); return; }
            c[field] = v;
          }
          persistCasts();
          pushAudit('キャスト設定', name + ' の' + ({wage1:'時給1部',wage2:'時給2部',welfare:'厚生費%'}[field] || field),
                    String(before == null ? '(店舗に従う)' : before), String(c[field] == null ? '(店舗に従う)' : c[field]));
          toast(name + ' の設定を保存しました');
        }
        return;
      }
      // キャストごとの指名バック（金額 or %／空欄＝店舗に従う）
      if (el.hasAttribute && el.hasAttribute('data-castback')) {
        const name = el.getAttribute('data-castback'), kind = el.getAttribute('data-kind');
        const c = (DATA.casts || []).find(function (x) { return x.name === name; });
        if (c) {
          const row = el.closest('td');
          const vEl = row.querySelector('[data-field="value"]'), mEl = row.querySelector('[data-field="mode"]');
          const mode = mEl.value, raw = vEl.value.trim();
          c.back = c.back || {};
          const before = c.back[kind] ? (c.back[kind].value + (c.back[kind].mode === 'rate' ? '%' : '円')) : '(店舗に従う)';
          if (!mode || raw === '') { delete c.back[kind]; }
          else {
            const v = Number(raw);
            if (!Number.isFinite(v) || v < 0) { toast('0以上の数字を入れてください'); return; }
            c.back[kind] = { mode: mode, value: v };
          }
          persistCasts();
          pushAudit('キャスト設定', name + ' の' + ({req:'リクエストバック',field:'場内バック',dohan:'同伴バック'}[kind]),
                    before, c.back[kind] ? (c.back[kind].value + (mode === 'rate' ? '%' : '円')) : '(店舗に従う)');
          toast(name + ' のバックを保存しました');
          render(currentId, currentSub);
        }
        return;
      }
      // 計算方法の選択（給率の分子/分母・端数・折半）
      if (el.hasAttribute && el.hasAttribute('data-choice')) {
        const k = el.getAttribute('data-choice');
        const before = DATA.store[k];
        let v = el.value;
        if (v === 'true' || v === 'false') v = (v === 'true');
        DATA.store[k] = v;
        const st = loadStore(); st.store = st.store || {}; st.store[k] = v; saveStore(st);
        pushAudit('計算方法の変更', k, String(before), String(v));
        toast('計算方法を変更しました（画面の数字に反映されます）');
        render(currentId, currentSub);
        return;
      }
      // 2部時給の開始時刻
      if (el.hasAttribute && el.hasAttribute('data-timeset')) {
        const k = el.getAttribute('data-timeset'), v = el.value.trim();
        if (v && !/^([0-2]?\d):[0-5]\d$/.test(v)) { toast('時刻は「22:00」のように入力してください'); return; }
        const before = DATA.store[k];
        DATA.store[k] = v;
        const st = loadStore(); st.store = st.store || {}; st.store[k] = v; saveStore(st);
        pushAudit('設定変更', k, String(before || '(なし)'), String(v || '(なし)'));
        toast(v ? '2部時給の開始を ' + v + ' にしました' : '2部時給を使わない設定にしました');
        return;
      }
      if (el.hasAttribute && el.hasAttribute('data-setting')) {
        const key = el.getAttribute('data-setting'); const v = normNum(el.value);
        if (Number.isFinite(v)) { setSetting(key, Math.round(v * 1000) / 1000); toast('設定を保存しました'); }
        else toast('数値を入力してください');
      }
    });

    // 起動時 検算（1件でも外れたら赤バー＝失敗を必ず可視化）
    const errs = C.validateCalcFixtures();
    if (errs.length) {
      document.getElementById('content').innerHTML =
        '<div class="errbar"><b>本家一致チェックに失敗しました（' + errs.length + '件）</b><br>'
        + errs.map(function (e) { return '・' + e.label + ': 実測 ' + e.got.toLocaleString() + ' / 期待 ' + e.want.toLocaleString() + ' (差 ' + e.diff + ')'; }).join('<br>')
        + '<br>次の一手: 入力した数値をご確認のうえ、直らない場合は管理者へご連絡ください</div>';
      return;
    }
    // 起動アニメ: 2.6秒後に完全非表示。クリック/タップでスキップ
    (function(){ const sp=document.getElementById('splash'); if(!sp) return;
      const kill=function(){ sp.classList.add('done'); };
      sp.addEventListener('click', function(){ sp.style.animation='splashOut .3s ease forwards'; setTimeout(kill,320); });
      setTimeout(kill, 4700);
    })();
    buildHelp();
    const r = parseHash();
    safeReplace({ id: r.id, sub: r.sub }, routeHash(r.id, r.sub)); // 戻る対応（初期状態を積む）
    render(r.id, r.sub);
  }

  // バックアップ書き出し / 読み込み（端末変更・キャッシュ削除でのデータ消失対策）
  function backupExport() {
    const blob = new Blob([JSON.stringify(loadStore(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'Dシステム改_バックアップ.json';
    a.click(); URL.revokeObjectURL(a.href); toast('バックアップを書き出しました');
  }
  function backupImport() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = function () {
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = function () {
        try {
          const raw = JSON.parse(r.result); const clean = { inputs: {}, store: {} };
          if (raw && typeof raw === 'object') {
            if (raw.inputs && typeof raw.inputs === 'object') Object.keys(raw.inputs).forEach(function (k) { const v = raw.inputs[k]; if (typeof v === 'string' && v.length <= 200) clean.inputs[k] = v; });
            // 店舗設定は数値だけでなく、文字列（給率の分子/分母・端数・2部開始）・真偽値・
            // バックの形（{mode,value}）も戻す。ここを数値だけにすると計算方法が黙って初期化される。
            if (raw.store && typeof raw.store === 'object') Object.keys(raw.store).forEach(function (k) {
              const v = raw.store[k];
              if (typeof v === 'number' && Number.isFinite(v)) clean.store[k] = v;
              else if (typeof v === 'string' && v.length <= 40) clean.store[k] = v;
              else if (typeof v === 'boolean') clean.store[k] = v;
              else if (v && typeof v === 'object' && (v.mode === 'fixed' || v.mode === 'rate')
                       && typeof v.value === 'number' && Number.isFinite(v.value) && v.value >= 0) {
                clean.store[k] = { mode: v.mode, value: v.value };
              }
            });
            // キャスト個別の時給・厚生費・バックも戻す
            if (Array.isArray(raw.casts)) {
              clean.casts = raw.casts.filter(function (c) { return c && typeof c.name === 'string'; })
                .map(function (c) {
                  const o = { id: Number(c.id) || 0, name: String(c.name).slice(0, 40), attr: c.attr || 'normal',
                              wage1: Number(c.wage1) || 0, wage2: Number(c.wage2) || 0,
                              welfare: (c.welfare == null ? null : Number(c.welfare)) };
                  if (c.back && typeof c.back === 'object') {
                    o.back = {};
                    ['req', 'field', 'dohan'].forEach(function (k) {
                      const b = c.back[k];
                      if (b && (b.mode === 'fixed' || b.mode === 'rate') && Number.isFinite(Number(b.value))) {
                        o.back[k] = { mode: b.mode, value: Number(b.value) };
                      }
                    });
                  }
                  return o;
                });
            }
            // 伝票・お客さまも必ず戻す（ここを捨てると「戻したのに消えた」になる）
            if (Array.isArray(raw.bills)) clean.bills = raw.bills.filter(function (b) { return b && typeof b === 'object'; });
            if (Array.isArray(raw.customers)) clean.customers = raw.customers.filter(function (c) { return c && typeof c === 'object'; });
            if (Array.isArray(raw.keeps)) clean.keeps = raw.keeps.filter(function (k) { return k && typeof k === 'object'; });
            if (raw.attendance && typeof raw.attendance === 'object') clean.attendance = raw.attendance;
            if (raw.cashClose && typeof raw.cashClose === 'object') clean.cashClose = raw.cashClose;
            if (Array.isArray(raw.audit)) clean.audit = raw.audit.slice(-500);
          }
          const nb = (clean.bills || []).length, nc = (clean.customers || []).length, nk = (clean.casts || []).length;
          if (!confirm('今のデータを、このバックアップで上書きします。\n（伝票 ' + nb + '件 / お客さま ' + nc + '件 / キャスト ' + nk + '名）\nよろしいですか？')) { toast('読み込みを取りやめました'); return; }
          saveStore(clean); toast('読み込みました'); location.reload();
        }
        catch (e) { showError('読み込みに失敗しました', String(e && e.message || e), '正しいバックアップJSONを選んでください'); }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  // 音声: 設定コマンド（全設定を声で）／個別フィールドへ口述
  function voiceCommand(btn) { startVoice(applyVoiceCommand, btn); }
  function voiceField(sel, btn) {
    startVoice(function (res) {
      const el = document.querySelector(sel); if (!el) return;
      const list = Array.isArray(res) ? res : [res];
      if (el.type === 'number') {
        let n = NaN; for (const a of list) { n = normNum(a); if (Number.isFinite(n)) break; }
        if (!Number.isFinite(n)) { toast('数値が聞き取れませんでした:「' + (list[0] || '') + '」'); return; }
        el.value = n;
      } else {
        el.value = (list[0] || '').replace(/[。、\s]+$/, '');
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      toast('入力しました:「' + el.value + '」');
    }, btn);
  }
  global.APP = { go: go, goSub: goSub, toast: toast, backupExport: backupExport, backupImport: backupImport, voiceCommand: voiceCommand, voiceField: voiceField,
    helpToggle: helpToggle, helpSend: helpSend, helpVoice: helpVoice, helpGo: helpGo, newBill: newBill, exportCSV: exportCSV, printPaySlip: printPaySlip, newCustomer: newCustomer, copyTable: copyTable, cashClose: cashClose, cashRecalc: recalcCash, newCast: newCast, deleteCast: deleteCast, newKeep: newKeep, keepConsume: keepConsume,
    newStaff: newStaff, newCostItem: newCostItem, newFeeItem: newFeeItem,
    billSearch: billSearch, billToMonth: billToMonth, custPeriod: custPeriod,
    toggleCastZero: function (v) { UI.setHideZeroCast(v); render('castItems'); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== "undefined" ? window : globalThis);
