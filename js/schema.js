/* Dシステム改 - schema.js
 * enum・項目名を1か所に固定（レビュー指摘D対策：データ形の揺れ防止）
 */
(function (global) {
  "use strict";

  // 入出金項目の種別（粗利算入 / 現金算入 の2フラグの組み合わせ）
  const CostKind = {
    OUT_CASH_GROSS:     { key: "out_cash_gross",      label: "出金",                 io: "out", inGross: true,  inCash: true  },
    OUT_CASH_NOGROSS:   { key: "out_cash_nogross",    label: "出金(粗利×)",          io: "out", inGross: false, inCash: true  },
    OUT_NOCASH_GROSS:   { key: "out_nocash_gross",    label: "出金(現金以外/粗利○)", io: "out", inGross: true,  inCash: false },
    OUT_NOCASH_NOGROSS: { key: "out_nocash_nogross",  label: "出金(現金以外/粗利×)", io: "out", inGross: false, inCash: false },
    IN_CASH_GROSS:      { key: "in_cash_gross",       label: "入金",                 io: "in",  inGross: true,  inCash: true  },
    IN_CASH_NOGROSS:    { key: "in_cash_nogross",     label: "入金(粗利×)",          io: "in",  inGross: false, inCash: true  },
    IN_MONTHLY:         { key: "in_monthly",          label: "入金(月間)",           io: "in",  inGross: false, inCash: true  },
  };

  // 給与項目の種類
  const FeeKind = {
    MINUS:    "minus",
    BONUS:    "bonus",
    DAILYPAY: "dailypay",
  };

  // キャスト属性
  const CastAttr = {
    NORMAL:   { key: "normal",   label: "通常", mark: "" },
    TRIAL:    { key: "trial",    label: "体入", mark: "🔰" },
    DISPATCH: { key: "dispatch", label: "派遣", mark: "🌻" },
  };

  // 商品カテゴリ
  const ProductCat = {
    DRINK: "drink", SHOT: "shot", FOOD: "food", BOTTLE: "bottle", CHAMPAGNE: "champagne",
  };

  // 支払区分
  const PayMethod = { CASH: "cash", CREDIT: "credit", CARD: "card" };

  global.SCHEMA = {
    CostKind, FeeKind, CastAttr, ProductCat, PayMethod,
    // 収支明細1行の項目名（画面と計算で共通利用する固定キー）
    financeFields: [
      "date", "dow", "holiday",
      "cash", "credit", "card", "salesTotal",
      "reqSub", "dohanSub",
      "remainingPay", "payRate",
      "maleDaily", "femaleDaily", "bonus", "minus",
      "deposit", "withdrawal", "expenseTotal", "grossProfit",
    ],
  };
})(typeof window !== "undefined" ? window : globalThis);
