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
