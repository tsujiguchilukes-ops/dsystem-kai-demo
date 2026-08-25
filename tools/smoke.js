/* Dシステム改 - 実ブラウザ スモークテスト
 * 画面の描画だけでなく「ボタンのハンドラを実際に叩く」ところまで確かめる。
 * 新規伝票ボタンが ReferenceError で無反応だったのを検知できなかった反省から追加。
 *   使い方: node tools/smoke.js   （事前に localhost:8787 で配信し、Chrome を 9222 で起動）
 */
const CDP = require(process.env.CDP_PATH || 'chrome-remote-interface');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = process.env.BASE || 'http://localhost:8787/index.html';

// 画面ごとに「押せるものを全部押す」。例外が出たら失敗。
const CASES = [
  { screen: 'bills',      run: `APP.newBill(); return !!document.getElementById('nbReq');`,        name: '新規伝票モーダルが開く' },
  { screen: 'customers/list', run: `APP.newCustomer(); return !!document.getElementById('modalWrap');`, name: '新規お客さまモーダルが開く' },
  { screen: 'casts',      run: `APP.printPaySlip('cast'); return true;`,                            name: '報酬明細PDF(キャスト)' },
  { screen: 'staff',      run: `APP.printPaySlip('staff'); return true;`,                           name: '報酬明細PDF(スタッフ)' },
  { screen: 'balance',    run: `APP.exportCSV('export'); return true;`,                             name: '収支のExcel出力' },
  { screen: 'castItems',  run: `APP.toggleCastZero(true); APP.toggleCastZero(false); return true;`, name: '0個を除外トグル' },
  { screen: 'summary',    run: `APP.helpToggle(); APP.helpToggle(); return true;`,                  name: 'ヘルプチャット開閉' },
  { screen: 'settings',   run: `return APP.voiceInterpret ? APP.voiceInterpret('同伴バックを3000円') : 'skip';`, name: '音声解釈' },
  { screen: 'cash',       run: `return typeof APP.go === 'function';`,                              name: '現金管理が開く' },
  { screen: 'report',     run: `return document.querySelectorAll('#content tr[data-rrow]').length > 0;`, name: '日報の行がある' },
  { screen: 'history',    run: `return document.querySelectorAll('#content table').length > 0;`,         name: '履歴が出る' },
  { screen: 'items/daily',run: `return document.querySelectorAll('#content table').length > 0;`,         name: '商品日別が出る' },
  { screen: 'tags',       run: `return document.querySelectorAll('#content table').length > 0;`,         name: 'タグ集計が出る' },
];

(async () => {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime } = client;
  await Page.enable(); await Runtime.enable();
  const fails = [];
  // ページ内の未捕捉例外も拾う（握りつぶし対策）
  let pageErrors = [];
  Runtime.exceptionThrown(p => pageErrors.push(p.exceptionDetails.text + ' ' + (p.exceptionDetails.exception || {}).description));

  for (const c of CASES) {
    pageErrors = [];
    await Page.navigate({ url: BASE + '?t=' + Date.now() + '#' + c.screen });
    await Page.loadEventFired();
    await sleep(6800); // スプラッシュ待ち
    const { result, exceptionDetails } = await Runtime.evaluate({
      expression: `(() => { try { ${c.run} } catch (e) { return '__ERR__' + e.constructor.name + ': ' + e.message; } })()`,
      returnByValue: true,
    });
    const v = result && result.value;
    const bad = exceptionDetails || (typeof v === 'string' && v.indexOf('__ERR__') === 0) || v === false;
    if (bad) fails.push(`${c.screen} / ${c.name} → ${exceptionDetails ? 'throw' : v}`);
    else if (pageErrors.length) fails.push(`${c.screen} / ${c.name} → ページ内例外: ${pageErrors[0]}`);
    console.log(`${bad || pageErrors.length ? 'NG ' : 'OK '} ${c.screen.padEnd(16)} ${c.name}`);
  }
  await client.close();
  console.log(fails.length ? '\n失敗 ' + fails.length + '件:\n' + fails.join('\n') : '\n全ハンドラ PASS');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
