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
