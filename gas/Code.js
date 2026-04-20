// ===================================
// GAS doPost ルーター
// ===================================
// すべてのリクエストを action パラメータで分岐させる

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var payload = body.payload || {};

    var result;
    switch (action) {
      case 'getMasters':
        result = getMasters();
        break;
      case 'submit':
        result = submitEntry(payload);
        break;
      case 'getMyHistory':
        result = getMyHistory(payload);
        break;
      case 'getUnsettled':
        result = getUnsettled(payload);
        break;
      case 'markSettled':
        result = markSettled(payload);
        break;
      case 'ocr':
        result = runOcr(payload);
        break;
      case 'getReport':
        result = getAccountingReport(payload);
        break;
      case 'deleteEntry':
        result = deleteEntry(payload);
        break;
      case 'updateEntry':
        result = updateEntry(payload);
        break;
      default:
        throw new Error('不明なアクション: ' + action);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// doGet はヘルスチェック用途のみ
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: '神輿会 経費精算 API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================================
// マスタデータ取得
// ===================================
// 設定シートから提出者・支出区分・収入区分・繰越金を読み取る
function getMasters() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSheet = ss.getSheetByName('設定');

  if (!settingsSheet) {
    throw new Error('「設定」シートが見つかりません');
  }

  var data = settingsSheet.getDataRange().getValues();

  var submitters = [];
  var expenseCategories = [];
  var incomeCategories = [];
  var carryoverBalance = 0;
  var currentSection = '';

  for (var i = 0; i < data.length; i++) {
    var label = String(data[i][0]).trim();
    var value = String(data[i][1] || '').trim();

    // セクション検出
    if (label === '提出者リスト') {
      currentSection = 'submitters';
      if (value) submitters.push(value);
      continue;
    }
    if (label === '支出区分リスト') {
      currentSection = 'expenseCategories';
      if (value) expenseCategories.push(value);
      continue;
    }
    if (label === '収入区分リスト') {
      currentSection = 'incomeCategories';
      if (value) incomeCategories.push(value);
      continue;
    }
    if (label === '前年度繰越金') {
      currentSection = '';
      var num = parseFloat(String(data[i][1]).replace(/[,，円¥\s]/g, ''));
      if (!isNaN(num)) carryoverBalance = num;
      continue;
    }
    if (label === '管理者メール') {
      currentSection = '';
      continue;
    }

    // セクション内のデータ行（A列が空、B列に値あり）
    if (!label && value) {
      if (currentSection === 'submitters') submitters.push(value);
      if (currentSection === 'expenseCategories') expenseCategories.push(value);
      if (currentSection === 'incomeCategories') incomeCategories.push(value);
    }
    // B列が空でA列に値がある場合
    if (label && !value && currentSection) {
      if (currentSection === 'submitters') submitters.push(label);
      else if (currentSection === 'expenseCategories') expenseCategories.push(label);
      else if (currentSection === 'incomeCategories') incomeCategories.push(label);
      else if (currentSection === 'descriptions') descriptions.push(label);
      else if (currentSection === 'payees') payees.push(label);
    }
  }

  // --- 過去データ（台帳）から自動抽出してリストを拡張 ---
  var ledgerSheet = ss.getSheetByName('台帳');
  if (ledgerSheet) {
    var ledgerData = ledgerSheet.getDataRange().getValues();
    // 1行目のヘッダーをスキップ
    for (var j = 1; j < ledgerData.length; j++) {
      var rowDesc = String(ledgerData[j][8] || '').trim(); // I列: 但し書き
      var rowPayee = String(ledgerData[j][9] || '').trim(); // J列: 支払先

      if (rowDesc && descriptions.indexOf(rowDesc) === -1) {
        descriptions.push(rowDesc);
      }
      if (rowPayee && payees.indexOf(rowPayee) === -1) {
        payees.push(rowPayee);
      }
    }
  }

  // 見やすくするためにソート（五十音順）
  descriptions.sort(function(a, b) { return a.localeCompare(b, 'ja'); });
  payees.sort(function(a, b) { return a.localeCompare(b, 'ja'); });

  return {
    submitters: submitters,
    expenseCategories: expenseCategories,
    incomeCategories: incomeCategories,
    descriptions: descriptions,
    payees: payees,
    carryoverBalance: carryoverBalance
  };
}
