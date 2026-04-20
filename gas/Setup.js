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
