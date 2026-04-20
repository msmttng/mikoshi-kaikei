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


