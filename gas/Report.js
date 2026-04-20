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
