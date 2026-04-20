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
    // B列が空でA列に値がある場合（名前が直接A列にある等）
    if (label && !value && currentSection) {
      if (currentSection === 'submitters') submitters.push(label);
      if (currentSection === 'expenseCategories') expenseCategories.push(label);
      if (currentSection === 'incomeCategories') incomeCategories.push(label);
    }
  }

  return {
    submitters: submitters,
    expenseCategories: expenseCategories,
    incomeCategories: incomeCategories,
    carryoverBalance: carryoverBalance
  };
}
