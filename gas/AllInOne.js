// ===========================================================================
// Mikoshi Kaikei - GAS Backend (All-in-One)
// Generated: 2026-04-20T08:02:29.085Z
// ===========================================================================

// --- File: Code.js ---

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
      case 'updateMasterList':
        result = updateMasterList(payload);
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
  var descriptions = [];
  var payees = [];
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
    if (label === '但し書きリスト') {
      currentSection = 'descriptions';
      if (value) descriptions.push(value);
      continue;
    }
    if (label === '支払先リスト') {
      currentSection = 'payees';
      if (value) payees.push(value);
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

    // セクション内のデータ行
    if (!label && value) {
      if (currentSection === 'submitters') submitters.push(value);
      else if (currentSection === 'expenseCategories') expenseCategories.push(value);
      else if (currentSection === 'incomeCategories') incomeCategories.push(value);
      else if (currentSection === 'descriptions') descriptions.push(value);
      else if (currentSection === 'payees') payees.push(value);
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


// --- File: Setup.js ---

// ===================================
// 初期セットアップスクリプト（1回だけ実行）
// ===================================
// このスクリプトを GAS エディタに貼り付けて setupAll() を実行すると
// 台帳・設定・月次集計の3シートが自動作成されます。
// セットアップ完了後、このファイルは削除して構いません。

function setupAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- 1. 台帳シート ---
  setupLedgerSheet(ss);
  
  // --- 2. 設定シート ---
  setupSettingsSheet(ss);
  
  // --- 3. 月次集計シート ---
  setupSummarySheet(ss);
  
  // --- 4. 既存の「シート1」「Daichou」等を削除 ---
  cleanupDefaultSheets(ss);
  
  SpreadsheetApp.getUi().alert('セットアップ完了！\n\n台帳・設定・月次集計の3シートを作成しました。');
}

// ===================================
// 台帳シート
// ===================================
function setupLedgerSheet(ss) {
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) {
    sheet = ss.insertSheet('台帳');
  }
  
  // ヘッダー行
  var headers = [
    'ID', '登録日時', '種別', '日付', '提出者', '事業区分', '金額',
    '数量', '但し書き', '支払先', '領収書URL', '支払状況', '精算日', '備考', 'OCR信頼度'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // ヘッダーの書式設定
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#c9382a');  // 赤系（祭りカラー）
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  
  // 列幅の自動調整
  sheet.setColumnWidth(1, 180);  // ID
  sheet.setColumnWidth(2, 160);  // 登録日時
  sheet.setColumnWidth(3, 60);   // 種別
  sheet.setColumnWidth(4, 100);  // 日付
  sheet.setColumnWidth(5, 100);  // 提出者
  sheet.setColumnWidth(6, 120);  // 事業区分
  sheet.setColumnWidth(7, 100);  // 金額
  sheet.setColumnWidth(8, 80);   // 数量
  sheet.setColumnWidth(9, 200);  // 但し書き
  sheet.setColumnWidth(10, 140); // 支払先
  sheet.setColumnWidth(11, 200); // 領収書URL
  sheet.setColumnWidth(12, 80);  // 支払状況
  sheet.setColumnWidth(13, 100); // 精算日
  sheet.setColumnWidth(14, 200); // 備考
  sheet.setColumnWidth(15, 80);  // OCR信頼度
  
  // 1行目を固定
  sheet.setFrozenRows(1);
  
  // 金額列の書式
  sheet.getRange('G:G').setNumberFormat('#,##0');
}

// ===================================
// 設定シート
// ===================================
function setupSettingsSheet(ss) {
  var sheet = ss.getSheetByName('設定');
  if (!sheet) {
    sheet = ss.insertSheet('設定');
  }
  
  // データを一括設定
  var data = [
    ['提出者リスト', '（氏名を入力）', '（メールアドレス）'],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],  // 空行（提出者の追加余地）
    ['支出区分リスト', '連合関連', ''],
    ['', '交際費', ''],
    ['', '接待飲食', ''],
    ['', '青年会活動費', ''],
    ['', '備品・消耗品', ''],
    ['', 'その他', ''],
    ['', '', ''],  // 空行
    ['収入区分リスト', '年会費', ''],
    ['', '町会補助金', ''],
    ['', '祭礼奉納', ''],
    ['', '直会参加費', ''],
    ['', '個人奉納', ''],
    ['', '預金利息', ''],
    ['', 'その他', ''],
    ['', '', ''],  // 空行
    ['前年度繰越金', 1211366, ''],
    ['', '', ''],  // 空行
    ['管理者メール', '（メールアドレスを入力）', ''],
  ];
  
  sheet.getRange(1, 1, data.length, 3).setValues(data);
  
  // セクションヘッダーの書式
  var sectionHeaders = ['提出者リスト', '支出区分リスト', '収入区分リスト', '前年度繰越金', '管理者メール'];
  var allData = sheet.getDataRange().getValues();
  for (var i = 0; i < allData.length; i++) {
    var label = String(allData[i][0]).trim();
    if (sectionHeaders.indexOf(label) !== -1) {
      var row = i + 1;
      sheet.getRange(row, 1).setFontWeight('bold');
      sheet.getRange(row, 1).setBackground('#fff3e0');  // 薄いオレンジ
    }
  }
  
  // 列幅
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 200);
  
  // ヘッダー行の説明
  sheet.getRange('A1').setNote('このセクションに提出者名を記入してください。\nB列に氏名、C列にメールアドレス（任意）を入力します。');
  sheet.getRange('A8').setNote('支出の事業区分です。\n2024年度実績に基づくカテゴリです。');
  sheet.getRange('A15').setNote('収入の事業区分です。');
  sheet.getRange('A23').setNote('前年度からの繰越金額を入力してください。\nホーム画面に表示されます。');
  sheet.getRange('A25').setNote('登録時に管理者へ通知メールが送信されます。');
  
  // 繰越金の書式
  sheet.getRange('B23').setNumberFormat('#,##0');
}

// ===================================
// 月次集計シート
// ===================================
function setupSummarySheet(ss) {
  var sheet = ss.getSheetByName('月次集計');
  if (!sheet) {
    sheet = ss.insertSheet('月次集計');
  }
  
  // 集計用のQUERY関数を設定
  sheet.getRange('A1').setValue('月次集計（自動計算）').setFontSize(14).setFontWeight('bold');
  
  // 支出集計
  sheet.getRange('A3').setValue('【支出 - 区分別合計】').setFontWeight('bold');
  sheet.getRange('A4').setValue('事業区分');
  sheet.getRange('B4').setValue('合計金額');
  sheet.getRange('A4:B4').setFontWeight('bold').setBackground('#f0f0f0');
  
  // QUERY: 台帳の支出を事業区分別に集計
  sheet.getRange('A5').setFormula(
    '=IFERROR(QUERY(台帳!C:G, "SELECT F, SUM(G) WHERE C=\'支出\' GROUP BY F LABEL SUM(G) \'合計金額\'", 1), "データなし")'
  );
  
  // 収入集計
  sheet.getRange('D3').setValue('【収入 - 区分別合計】').setFontWeight('bold');
  sheet.getRange('D4').setValue('事業区分');
  sheet.getRange('E4').setValue('合計金額');
  sheet.getRange('D4:E4').setFontWeight('bold').setBackground('#f0f0f0');
  
  // QUERY: 台帳の収入を事業区分別に集計
  sheet.getRange('D5').setFormula(
    '=IFERROR(QUERY(台帳!C:G, "SELECT F, SUM(G) WHERE C=\'収入\' GROUP BY F LABEL SUM(G) \'合計金額\'", 1), "データなし")'
  );
  
  // 総合計
  sheet.getRange('A20').setValue('支出合計').setFontWeight('bold');
  sheet.getRange('B20').setFormula('=IFERROR(SUMIF(台帳!C:C, "支出", 台帳!G:G), 0)');
  sheet.getRange('B20').setNumberFormat('#,##0');
  
  sheet.getRange('D20').setValue('収入合計').setFontWeight('bold');
  sheet.getRange('E20').setFormula('=IFERROR(SUMIF(台帳!C:C, "収入", 台帳!G:G), 0)');
  sheet.getRange('E20').setNumberFormat('#,##0');
  
  sheet.getRange('A22').setValue('前年度繰越金').setFontWeight('bold');
  sheet.getRange('B22').setFormula('=設定!B23');
  sheet.getRange('B22').setNumberFormat('#,##0');
  
  sheet.getRange('A23').setValue('次年度繰越金').setFontWeight('bold');
  sheet.getRange('B23').setFormula('=B22+E20-B20');
  sheet.getRange('B23').setNumberFormat('#,##0').setFontWeight('bold');
  sheet.getRange('B23').setFontColor('#c9382a');
  
  // 列幅
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 20);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 120);
}

// ===================================
// デフォルトシートの削除
// ===================================
function cleanupDefaultSheets(ss) {
  var sheets = ss.getSheets();
  var keepNames = ['台帳', '設定', '月次集計'];
  
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (keepNames.indexOf(name) === -1) {
      try {
        ss.deleteSheet(sheets[i]);
      } catch (e) {
        // 最後の1シートは削除できないのでスキップ
        console.log('シート削除スキップ: ' + name);
      }
    }
  }
}


// --- File: Submit.js ---

// ===================================
// 支出/収入 登録処理
// ===================================

/**
 * エントリを台帳に1行追記する
 * @param {Object} payload - フロントから送られるペイロード
 * @returns {Object} - { id: 生成されたID }
 */
function submitEntry(payload) {
  // --- バリデーション ---
  if (!payload.type || !['支出', '収入'].includes(payload.type)) {
    throw new Error('種別が不正です');
  }
  if (!payload.submitter) throw new Error('提出者が未入力です');
  if (!payload.date) throw new Error('日付が未入力です');
  if (!payload.category) throw new Error('事業区分が未入力です');
  if (!payload.amount || payload.amount <= 0) throw new Error('金額が不正です');
  if (payload.amount > 10000000) throw new Error('金額が大きすぎます');

  // --- ID の自動採番 ---
  var now = new Date();
  var id = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMdd-HHmmss')
    + '-' + Math.random().toString(36).substr(2, 3);

  // --- 画像保存（あれば） ---
  var receiptUrl = '';
  if (payload.imageBase64 && payload.imageMimeType) {
    receiptUrl = saveReceiptImage(payload.imageBase64, payload.imageMimeType, id);
  }

  // --- 台帳に追記 ---
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) throw new Error('「台帳」シートが見つかりません');

  var registeredAt = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  // 列順: A:ID, B:登録日時, C:種別, D:日付, E:提出者, F:事業区分,
  //       G:金額, H:数量, I:但し書き, J:支払先, K:領収書URL,
  //       L:支払状況, M:精算日, N:備考, O:OCR信頼度
  sheet.appendRow([
    id,
    registeredAt,
    payload.type,
    payload.date,
    payload.submitter,
    payload.category,
    payload.amount,
    payload.quantity || '',     // 数量（任意）
    payload.description || '',
    payload.payee || '',
    receiptUrl,
    '未精算',
    '',  // 精算日（空）
    payload.note || '',
    payload.ocrConfidence || '手入力'
  ]);

  // --- 管理者通知 ---
  try {
    notifyAdmin({
      id: id,
      type: payload.type,
      submitter: payload.submitter,
      category: payload.category,
      amount: payload.amount,
      quantity: payload.quantity || '',
      description: payload.description || '',
      payee: payload.payee || '',
      date: payload.date
    });
  } catch (notifyErr) {
    console.error('通知送信エラー: ' + notifyErr.message);
  }

  return { id: id };
}

/**
 * 領収書画像を Google Drive に保存
 */
function saveReceiptImage(base64, mimeType, id) {
  var blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    mimeType,
    id + getExtension(mimeType)
  );

  var folderName = '神輿会_領収書';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

/**
 * MIME タイプから拡張子を返す
 */
function getExtension(mimeType) {
  var map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/heic': '.heic',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  return map[mimeType] || '.jpg';
}

// ===================================
// 履歴取得
// ===================================

/**
 * 指定提出者の履歴を取得（最新20件）
 * 列順: A:ID, B:登録日時, C:種別, D:日付, E:提出者, F:事業区分,
 *       G:金額, H:数量, I:但し書き, J:支払先, K:領収書URL,
 *       L:支払状況, M:精算日, N:備考, O:OCR信頼度
 */
function getMyHistory(payload) {
  if (!payload.submitter) throw new Error('提出者名が必要です');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) throw new Error('「台帳」シートが見つかりません');

  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[4]).trim() === payload.submitter) {
      results.push({
        id: String(row[0]),
        registeredAt: String(row[1]),
        type: String(row[2]),
        date: String(row[3]),
        submitter: String(row[4]),
        category: String(row[5]),
        amount: Number(row[6]),
        quantity: String(row[7] || ''),
        description: String(row[8]),
        payee: String(row[9]),
        receiptUrl: String(row[10]),
        status: String(row[11]),
        settledDate: String(row[12]),
        note: String(row[13]),
        ocrConfidence: String(row[14])
      });
    }
  }

  results.sort(function(a, b) {
    return b.id.localeCompare(a.id);
  });

  return results.slice(0, 20);
}


// --- File: Admin.js ---

// ===================================
// 管理者用処理
// ===================================

/**
 * 未精算一覧を取得
 * 列順: A:ID(0), B:登録日時(1), C:種別(2), D:日付(3), E:提出者(4), F:事業区分(5),
 *       G:金額(6), H:数量(7), I:但し書き(8), J:支払先(9), K:領収書URL(10),
 *       L:支払状況(11), M:精算日(12), N:備考(13), O:OCR信頼度(14)
 */
function getUnsettled(payload) {
  validateAdminKey(payload.adminKey);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) throw new Error('「台帳」シートが見つかりません');

  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[11]).trim() === '未精算') {
      results.push({
        id: String(row[0]),
        registeredAt: String(row[1]),
        type: String(row[2]),
        date: String(row[3]),
        submitter: String(row[4]),
        category: String(row[5]),
        amount: Number(row[6]),
        quantity: String(row[7] || ''),
        description: String(row[8]),
        payee: String(row[9]),
        receiptUrl: String(row[10]),
        status: String(row[11]),
        settledDate: String(row[12]),
        note: String(row[13]),
        ocrConfidence: String(row[14])
      });
    }
  }

  results.sort(function(a, b) {
    return b.id.localeCompare(a.id);
  });

  return results;
}

/**
 * 指定IDを「精算済」に更新
 * L列(12列目)=支払状況、M列(13列目)=精算日
 */
function markSettled(payload) {
  validateAdminKey(payload.adminKey);

  if (!payload.ids || !Array.isArray(payload.ids) || payload.ids.length === 0) {
    throw new Error('更新対象のIDが指定されていません');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) throw new Error('「台帳」シートが見つかりません');

  var data = sheet.getDataRange().getValues();
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  var count = 0;

  var idSet = {};
  for (var j = 0; j < payload.ids.length; j++) {
    idSet[payload.ids[j]] = true;
  }

  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][0]).trim();
    if (idSet[rowId]) {
      // L列（12列目）を「精算済」に更新
      sheet.getRange(i + 1, 12).setValue('精算済');
      // M列（13列目）に精算日を設定
      sheet.getRange(i + 1, 13).setValue(today);
      count++;
    }
  }

  return { count: count };
}

/**
 * 管理者キーの検証（簡易認証）
 */
function validateAdminKey(key) {
  var storedKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (storedKey && key !== storedKey) {
    throw new Error('管理者認証に失敗しました');
  }
}

/**
 * 指定IDの行を削除（管理者用）
 */
function deleteEntry(payload) {
  validateAdminKey(payload.adminKey);

  if (!payload.id) {
    throw new Error('削除対象のIDが指定されていません');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) throw new Error('「台帳」シートが見つかりません');

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][0]).trim();
    if (rowId === payload.id) {
      sheet.deleteRow(i + 1); // deleteRow は1-indexed
      return { success: true };
    }
  }

  throw new Error('指定されたIDのデータが見つかりません');
}

/**
 * 指定IDの行を更新（全項目対応、管理者用）
 * 列のインデックス: 
 * D:日付(4列目), E:提出者(5列目), F:事業区分(6列目), G:金額(7列目), 
 * H:数量(8列目), I:但し書き(9列目), J:支払先(10列目), N:備考(14列目)
 */
function updateEntry(payload) {
  validateAdminKey(payload.adminKey);

  if (!payload.id) {
    throw new Error('更新対象のIDが指定されていません');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) throw new Error('「台帳」シートが見つかりません');

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][0]).trim();
    if (rowId === payload.id) {
      var rowNum = i + 1;
      // 変更リクエストが存在する項目のみ上書きする
      if (payload.date !== undefined) sheet.getRange(rowNum, 4).setValue(payload.date);
      if (payload.submitter !== undefined) sheet.getRange(rowNum, 5).setValue(payload.submitter);
      if (payload.category !== undefined) sheet.getRange(rowNum, 6).setValue(payload.category);
      if (payload.amount !== undefined) sheet.getRange(rowNum, 7).setValue(payload.amount);
      if (payload.quantity !== undefined) sheet.getRange(rowNum, 8).setValue(payload.quantity);
      if (payload.description !== undefined) sheet.getRange(rowNum, 9).setValue(payload.description);
      if (payload.payee !== undefined) sheet.getRange(rowNum, 10).setValue(payload.payee);
      if (payload.note !== undefined) sheet.getRange(rowNum, 14).setValue(payload.note);
      
      return { success: true };
    }
  }

  throw new Error('指定されたIDのデータが見つかりません');
}

/**
 * マスターリストの更新（管理者用）
 * sectionName: '提出者リスト' | '但し書きリスト' | '支払先リスト'
 */
function updateMasterList(payload) {
  validateAdminKey(payload.adminKey);
  
  if (!payload.sectionName || !payload.items || !Array.isArray(payload.items)) {
    throw new Error('ペイロードが不正です');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('設定');
  if (!sheet) throw new Error('「設定」シートが見つかりません');

  var data = sheet.getDataRange().getValues();
  
  var sectionStartRow = -1;
  var nextSectionRow = -1;

  var sectionHeaders = ['提出者リスト', '支出区分リスト', '収入区分リスト', '但し書きリスト', '支払先リスト', '前年度繰越金', '管理者メール'];

  // 行を探す
  for (var i = 0; i < data.length; i++) {
    var label = String(data[i][0]).trim();
    if (label === payload.sectionName) {
      sectionStartRow = i + 1; // 1-indexed
    } else if (sectionStartRow !== -1 && sectionHeaders.indexOf(label) !== -1) {
      nextSectionRow = i + 1;
      break;
    }
  }

  // もしセクションが存在しなければ、ファイルの末尾に追加する
  if (sectionStartRow === -1) {
    sectionStartRow = sheet.getLastRow() + 2; // 空行をあけて追加
    sheet.getRange(sectionStartRow, 1).setValue(payload.sectionName).setFontWeight('bold').setBackground('#fff3e0');
    nextSectionRow = sectionStartRow + 1;
  }

  if (nextSectionRow === -1) {
    nextSectionRow = sheet.getLastRow() + 1;
  }

  // 既存の要素行をすべて削除（ヘッダーは残す）
  var linesToDelete = nextSectionRow - sectionStartRow - 1;
  if (linesToDelete > 0) {
    sheet.deleteRows(sectionStartRow + 1, linesToDelete);
  }

  // 追加する
  if (payload.items.length > 0) {
    sheet.insertRowsAfter(sectionStartRow, payload.items.length);
    var insertData = [];
    for (var j = 0; j < payload.items.length; j++) {
      insertData.push(['', payload.items[j], '']);
    }
    sheet.getRange(sectionStartRow + 1, 1, payload.items.length, 3).setValues(insertData);
  }

  return { success: true };
}




// --- File: Report.js ---

// ===================================
// 会計報告 自動集計処理
// ===================================
// 台帳と設定シートから会計報告データを自動集計

/**
 * 会計報告データを生成
 * @param {Object} payload - { adminKey: string, fiscalYear?: string }
 * @returns {Object} - 収支対照表データ
 */
function getAccountingReport(payload) {
  validateAdminKey(payload.adminKey);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('台帳');
  if (!sheet) throw new Error('「台帳」シートが見つかりません');

  // 前年度繰越金を取得
  var settingsSheet = ss.getSheetByName('設定');
  var carryoverBalance = 0;
  if (settingsSheet) {
    var settingsData = settingsSheet.getDataRange().getValues();
    for (var s = 0; s < settingsData.length; s++) {
      if (String(settingsData[s][0]).trim() === '前年度繰越金') {
        var num = parseFloat(String(settingsData[s][1]).replace(/[,，円¥\s]/g, ''));
        if (!isNaN(num)) carryoverBalance = num;
        break;
      }
    }
  }

  var data = sheet.getDataRange().getValues();

  // 集計用
  var incomeByCategory = {};
  var expenseByCategory = {};
  var incomeTotal = 0;
  var expenseTotal = 0;

  // 年度フィルタ（指定があれば）
  var fiscalYear = payload.fiscalYear || '';

  // ヘッダー行をスキップ
  // 列順: A:ID(0), B:登録日時(1), C:種別(2), D:日付(3), E:提出者(4), F:事業区分(5),
  //       G:金額(6), H:数量(7), I:但し書き(8), J:支払先(9), K:領収書URL(10),
  //       L:支払状況(11), M:精算日(12), N:備考(13), O:OCR信頼度(14)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowType = String(row[2]).trim();  // 種別
    var rowDate = String(row[3]);         // 日付
    var rowCategory = String(row[5]).trim(); // 事業区分
    var rowAmount = Number(row[6]);       // 金額

    // 年度フィルタ（YYYY 形式で前方一致）
    if (fiscalYear && !rowDate.startsWith(fiscalYear)) {
      continue;
    }

    if (isNaN(rowAmount) || rowAmount <= 0) continue;

    if (rowType === '収入') {
      incomeTotal += rowAmount;
      incomeByCategory[rowCategory] = (incomeByCategory[rowCategory] || 0) + rowAmount;
    } else if (rowType === '支出') {
      expenseTotal += rowAmount;
      expenseByCategory[rowCategory] = (expenseByCategory[rowCategory] || 0) + rowAmount;
    }
  }

  // 次年度繰越金
  var nextCarryover = carryoverBalance + incomeTotal - expenseTotal;

  return {
    fiscalYear: fiscalYear || '全期間',
    carryoverBalance: carryoverBalance,
    incomeTotal: incomeTotal,
    expenseTotal: expenseTotal,
    nextCarryover: nextCarryover,
    incomeByCategory: incomeByCategory,
    expenseByCategory: expenseByCategory,
    grandTotal: carryoverBalance + incomeTotal  // 前年度繰越 + 今年度収入
  };
}

/**
 * 会計報告シートを自動生成または更新する
 * 管理者が GAS エディタから手動実行、またはボタンで呼び出す想定
 * @param {string} fiscalYear - 年度（例: "2026"）
 */
function generateReportSheet(fiscalYear) {
  if (!fiscalYear) {
    fiscalYear = new Date().getFullYear().toString();
  }

  var report = getAccountingReport({ adminKey: '', fiscalYear: fiscalYear });
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetName = fiscalYear + '年度 会計報告';
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    ss.deleteSheet(sheet);
  }
  sheet = ss.insertSheet(sheetName);

  // --- ヘッダー ---
  sheet.getRange('A1').setValue(fiscalYear + '年度 仲羽田青年会 会計報告');
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');

  // --- 収入の部 ---
  sheet.getRange('A3').setValue('収 入').setFontWeight('bold');
  sheet.getRange('D3').setValue('支 出').setFontWeight('bold');

  sheet.getRange('A4').setValue('項 目');
  sheet.getRange('B4').setValue('金 額');
  sheet.getRange('D4').setValue('項 目');
  sheet.getRange('E4').setValue('金 額');
  sheet.getRange('A4:E4').setFontWeight('bold').setBackground('#f0f0f0');

  // 収入内訳
  var incomeKeys = Object.keys(report.incomeByCategory);
  var row = 5;
  for (var ic = 0; ic < incomeKeys.length; ic++) {
    sheet.getRange('A' + row).setValue(incomeKeys[ic]);
    sheet.getRange('B' + row).setValue(report.incomeByCategory[incomeKeys[ic]]);
    sheet.getRange('B' + row).setNumberFormat('#,##0');
    row++;
  }

  // 支出内訳
  var expenseKeys = Object.keys(report.expenseByCategory);
  var eRow = 5;
  for (var ec = 0; ec < expenseKeys.length; ec++) {
    sheet.getRange('D' + eRow).setValue(expenseKeys[ec]);
    sheet.getRange('E' + eRow).setValue(report.expenseByCategory[expenseKeys[ec]]);
    sheet.getRange('E' + eRow).setNumberFormat('#,##0');
    eRow++;
  }

  // 合計行
  var maxRow = Math.max(row, eRow) + 1;
  sheet.getRange('A' + maxRow).setValue('年度合計').setFontWeight('bold');
  sheet.getRange('B' + maxRow).setValue(report.incomeTotal)
    .setNumberFormat('#,##0').setFontWeight('bold');
  sheet.getRange('D' + maxRow).setValue('合 計').setFontWeight('bold');
  sheet.getRange('E' + maxRow).setValue(report.expenseTotal)
    .setNumberFormat('#,##0').setFontWeight('bold');

  // 繰越金
  var crRow = maxRow + 1;
  sheet.getRange('A' + crRow).setValue('前年度繰越金').setFontWeight('bold');
  sheet.getRange('B' + crRow).setValue(report.carryoverBalance)
    .setNumberFormat('#,##0').setFontWeight('bold');
  sheet.getRange('D' + crRow).setValue('次年度繰越金').setFontWeight('bold');
  sheet.getRange('E' + crRow).setValue(report.nextCarryover)
    .setNumberFormat('#,##0').setFontWeight('bold');

  var totalRow = crRow + 1;
  sheet.getRange('A' + totalRow).setValue('合 計').setFontWeight('bold');
  sheet.getRange('B' + totalRow).setValue(report.grandTotal)
    .setNumberFormat('#,##0').setFontWeight('bold');

  // 差額
  var diffRow = totalRow + 1;
  var diff = report.grandTotal - report.expenseTotal;
  sheet.getRange('E' + diffRow).setValue(diff)
    .setNumberFormat('#,##0').setFontWeight('bold');

  // --- 署名欄 ---
  var sigRow = diffRow + 3;
  var roles = [
    ['会長', '', '印'],
    ['副会長', '', '印'],
    ['会計長', '', '印'],
  ];
  for (var r = 0; r < roles.length; r++) {
    sheet.getRange('D' + (sigRow + r)).setValue(roles[r][0]);
    sheet.getRange('F' + (sigRow + r)).setValue(roles[r][2]);
  }

  var auditRow = sigRow + roles.length + 1;
  sheet.getRange('A' + auditRow).setValue('上記のとおり、' + fiscalYear + '年度の会計をご報告申し上げます。');

  var auditorRow = auditRow + 1;
  sheet.getRange('D' + auditorRow).setValue('会計監査');
  sheet.getRange('F' + auditorRow).setValue('印');
  sheet.getRange('D' + (auditorRow + 1)).setValue('会計監査');
  sheet.getRange('F' + (auditorRow + 1)).setValue('印');
  sheet.getRange('D' + (auditorRow + 2)).setValue('会計監査');
  sheet.getRange('F' + (auditorRow + 2)).setValue('印');

  var finalRow = auditorRow + 4;
  sheet.getRange('A' + finalRow).setValue('（監査報告） 以上、監査の結果相違のないことを確認します。');

  // 列幅調整
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 20);
  sheet.setColumnWidth(4, 180);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 80);

  return {
    message: sheetName + 'を生成しました',
    sheetUrl: ss.getUrl() + '#gid=' + sheet.getSheetId()
  };
}


// --- File: Ocr.js ---

// ===================================
// Gemini OCR 処理
// ===================================
// 領収書画像を Gemini 2.5 Flash に送信し、構造化データを抽出

/**
 * 画像を Gemini API に送信して OCR 結果を返す
 * @param {Object} payload - { imageBase64: string, imageMimeType: string }
 * @returns {Object} - OCR 結果 { date, amount, payee, description, confidence }
 */
function runOcr(payload) {
  if (!payload.imageBase64 || !payload.imageMimeType) {
    throw new Error('画像データが必要です');
  }

  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('Gemini API キーが設定されていません。スクリプトプロパティに GEMINI_API_KEY を設定してください。');
  }

  var prompt = 'あなたは日本の領収書OCR専門AIです。画像から以下のJSONを出力してください。\n\n'
    + '出力形式（必ずこのJSONのみ。コードブロック禁止）:\n'
    + '{\n'
    + '  "date": "YYYY-MM-DD 形式、読み取れなければ null",\n'
    + '  "amount": "整数（円）、読み取れなければ null",\n'
    + '  "payee": "店名・発行者名、読み取れなければ null",\n'
    + '  "description": "但し書き（「御祭礼費として」等）、無ければ null",\n'
    + '  "confidence": "high | medium | low"\n'
    + '}\n\n'
    + '制約:\n'
    + '- 読み取れない項目は必ず null。推測で埋めない\n'
    + '- 金額は税込総額（合計欄）を採用\n'
    + '- 日付は和暦の場合は西暦に変換\n'
    + '- 手書き領収書も対応するが、判読困難な場合は confidence を low にする\n'
    + '- 余計な説明文・コードブロック（```）は一切付けない';

  var result = callGeminiWithImage(apiKey, payload.imageBase64, payload.imageMimeType, prompt);
  return result;
}

/**
 * Gemini API に画像付きリクエストを送信
 * @param {string} apiKey - Gemini API キー
 * @param {string} base64 - 画像の base64 データ
 * @param {string} mimeType - MIME タイプ
 * @param {string} prompt - テキストプロンプト
 * @returns {Object} - パース済み OCR 結果
 */
function callGeminiWithImage(apiKey, base64, mimeType, prompt) {
  var model = 'gemini-2.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + model + ':generateContent?key=' + apiKey;

  var requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,  // 低温で正確性重視
      maxOutputTokens: 512
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  var maxRetries = 3;
  var attempt = 0;
  var response, statusCode;
  var lastErrorText = "";

  while (attempt < maxRetries) {
    try {
      response = UrlFetchApp.fetch(url, options);
      statusCode = response.getResponseCode();
      
      if (statusCode === 200) {
        break; // 成功
      } else if (statusCode === 503 || statusCode === 429 || statusCode === 500) {
        // 過負荷やレートリミットの場合はリトライ
        lastErrorText = response.getContentText();
        attempt++;
        if (attempt < maxRetries) {
          Utilities.sleep(Math.pow(2, attempt) * 1000); // 2秒, 4秒...
        }
      } else {
        // その他のエラー (400など) は即時終了
        console.error('Gemini API エラー: ' + statusCode + ' ' + response.getContentText());
        throw new Error('OCR処理に失敗しました（ステータス: ' + statusCode + '）');
      }
    } catch (e) {
      // ネットワーク切断などでfetch自体が例外を投げた場合もリトライ
      lastErrorText = e.message;
      attempt++;
      if (attempt < maxRetries) {
        Utilities.sleep(Math.pow(2, attempt) * 1000);
      } else if (statusCode === undefined) {
        // HTTPステータスも取得できなかった場合
        throw new Error('Gemini APIとの通信に失敗しました (' + e.message + ')');
      }
    }
  }

  if (statusCode !== 200) {
    console.error('Gemini API リトライ上限到達: ' + statusCode + ' ' + lastErrorText);
    throw new Error('OCRサーバーが混雑しています。少し待ってから再度お試しください（ステータス: ' + statusCode + '）');
  }

  var json = JSON.parse(response.getContentText());

  // レスポンスからテキスト部分を抽出
  var text = '';
  try {
    text = json.candidates[0].content.parts[0].text;
  } catch (e) {
    console.error('Gemini レスポンス解析エラー:', JSON.stringify(json));
    return { date: null, amount: null, payee: null, description: null, confidence: 'low' };
  }

  // JSON パース（コードブロック除去 + 正規表現抽出）
  return parseOcrResponse(text);
}

/**
 * Gemini のレスポンステキストから JSON を安全に抽出
 * KI: gas_clasp_deploy_and_json_parse のベストプラクティスに従い、
 * コードブロック除去 + 正規表現で波括弧を抽出
 */
function parseOcrResponse(responseText) {
  var fallback = { date: null, amount: null, payee: null, description: null, confidence: 'low' };

  try {
    // マークダウンのコードブロック行を削除
    var cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 最初の { から最後の } までを正規表現で抽出
    var match = cleanedText.match(/\{[\s\S]*\}/);
    if (match) {
      cleanedText = match[0];
    }

    var parsed = JSON.parse(cleanedText);

    // バリデーション: amount が文字列の場合は数値に変換
    if (parsed.amount !== null && typeof parsed.amount === 'string') {
      parsed.amount = parseInt(parsed.amount.replace(/[,，円¥\s]/g, ''), 10);
      if (isNaN(parsed.amount)) parsed.amount = null;
    }

    // confidence のマッピング
    var confidenceMap = { high: '高', medium: '中', low: '低' };
    var ocrConfidence = confidenceMap[parsed.confidence] || '低';

    return {
      date: parsed.date || null,
      amount: parsed.amount || null,
      payee: parsed.payee || null,
      description: parsed.description || null,
      confidence: parsed.confidence || 'low',
      ocrConfidence: ocrConfidence  // 日本語版（Sheets 記録用）
    };

  } catch (e) {
    console.error('OCR レスポンスのパースに失敗:', e.message, responseText);
    return fallback;
  }
}


// --- File: Notify.js ---

// ===================================
// Gmail 通知処理
// ===================================

/**
 * 管理者にメール通知を送信
 * @param {Object} entry - 登録されたエントリ情報
 */
function notifyAdmin(entry) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSheet = ss.getSheetByName('設定');
  if (!settingsSheet) return;

  // 管理者メールアドレスを取得
  var adminEmail = findSettingValue(settingsSheet, '管理者メール');
  if (!adminEmail) {
    console.log('管理者メールアドレスが設定されていません');
    return;
  }

  // 金額のフォーマット
  var formattedAmount = '¥' + Number(entry.amount).toLocaleString('ja-JP');

  // 件名
  var subject = '[神輿会] ' + entry.submitter + 'さんから '
    + formattedAmount + ' の' + entry.type + '登録';

  // 本文
  var body = '神輿会 経費精算アプリから新しい登録がありました。\n\n'
    + '━━━━━━━━━━━━━━━━━━━━━━━━\n'
    + '■ ID: ' + entry.id + '\n'
    + '■ 種別: ' + entry.type + '\n'
    + '■ 提出者: ' + entry.submitter + '\n'
    + '■ 日付: ' + entry.date + '\n'
    + '■ 事業区分: ' + entry.category + '\n'
    + '■ 金額: ' + formattedAmount + '\n';

  if (entry.description) {
    body += '■ 但し書き: ' + entry.description + '\n';
  }
  if (entry.payee) {
    body += '■ 支払先: ' + entry.payee + '\n';
  }

  body += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
    + 'スプレッドシートで確認: ' + ss.getUrl() + '\n\n'
    + 'このメールは自動送信です。';

  // Gmail 送信（管理者宛）
  GmailApp.sendEmail(adminEmail, subject, body);

  // --- 提出者宛の自動返信 ---
  try {
    notifySubmitter(entry, settingsSheet, formattedAmount);
  } catch (e) {
    console.error('提出者への自動返信エラー: ' + e.message);
  }
}

/**
 * 提出者に受付確認メールを送信
 * @param {Object} entry - 登録エントリ
 * @param {Sheet} settingsSheet - 設定シート
 * @param {string} formattedAmount - フォーマット済み金額
 */
function notifySubmitter(entry, settingsSheet, formattedAmount) {
  // 設定シートから提出者のメールアドレスを検索
  var data = settingsSheet.getDataRange().getValues();
  var submitterEmail = '';

  // 提出者リストセクション内で名前が一致する行の C列にメールアドレスを配置する想定
  // レイアウト: A列=ラベル/名前, B列=名前, C列=メールアドレス
  var inSubmitterSection = false;
  for (var i = 0; i < data.length; i++) {
    var label = String(data[i][0]).trim();
    var value = String(data[i][1] || '').trim();
    var email = String(data[i][2] || '').trim();

    if (label === '提出者リスト') {
      inSubmitterSection = true;
      // この行自体に名前がある場合
      if (value === entry.submitter && email) {
        submitterEmail = email;
        break;
      }
      continue;
    }
    if (label === '事業区分リスト' || label === '管理者メール') {
      inSubmitterSection = false;
      continue;
    }

    if (inSubmitterSection) {
      // A列またはB列に名前がある場合
      var name = value || label;
      if (name === entry.submitter && email) {
        submitterEmail = email;
        break;
      }
    }
  }

  if (!submitterEmail) {
    console.log('提出者 ' + entry.submitter + ' のメールアドレスが設定シートにありません');
    return;
  }

  var subject = '[神輿会] ' + entry.type + '登録を受け付けました（' + formattedAmount + '）';

  var body = entry.submitter + ' 様\n\n'
    + '以下の' + entry.type + '登録を受け付けました。\n\n'
    + '━━━━━━━━━━━━━━━━━━━━━━━━\n'
    + '■ 日付: ' + entry.date + '\n'
    + '■ 事業区分: ' + entry.category + '\n'
    + '■ 金額: ' + formattedAmount + '\n';

  if (entry.description) {
    body += '■ 但し書き: ' + entry.description + '\n';
  }
  if (entry.payee) {
    body += '■ 支払先: ' + entry.payee + '\n';
  }

  body += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
    + '精算が完了しましたら別途ご連絡いたします。\n\n'
    + 'このメールは自動送信です。返信不要です。';

  GmailApp.sendEmail(submitterEmail, subject, body);
}

/**
 * 設定シートからキー名に対応する値を取得
 */
function findSettingValue(settingsSheet, keyName) {
  var data = settingsSheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === keyName) {
      return String(data[i][1] || '').trim();
    }
  }
  return '';
}

// ===================================
// 権限（OAuth）承認を強制的にプロンプトするためのダミー関数
// ===================================
function forceAuth() {
  // ① Google Drive の権限を強制取得
  DriveApp.getFilesByName('ダミー');
  
  // ② Gmail (メール送信) の権限を強制取得
  GmailApp.getInboxUnreadCount();
  
  // ③ スプレッドシート の権限を強制取得
  SpreadsheetApp.getActiveSpreadsheet();

  console.log("すべての権限承認が正常に完了しました！");
}
