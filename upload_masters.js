const fs = require('fs');

async function main() {
  const adminKey = process.argv[2];
  if (!adminKey) {
    console.error('Usage: node upload_masters.js <adminKey>');
    process.exit(1);
  }

  // 1. JSON ファイルからデータを読み込む
  const data = JSON.parse(fs.readFileSync('C:/Users/masam/.gemini/antigravity/scratch/2024_excel_dump.json', 'utf8'));
  const sheet = data['2024年度支出一覧'];
  
  const descSet = new Set();
  const payeeSet = new Set();
  
  // 抽出処理
  sheet.slice(1).forEach(row => {
    if (row['Unnamed: 1']) descSet.add(row['Unnamed: 1'].trim());
    if (row['Unnamed: 4']) payeeSet.add(row['Unnamed: 4'].trim());
  });
  
  const descriptions = Array.from(descSet).sort();
  const payees = Array.from(payeeSet).sort();

  console.log(`抽出件数: 但し書き ${descriptions.length}件, 支払先 ${payees.length}件`);

  const url = 'https://script.google.com/macros/s/AKfycbx9kqh_pob0Vk0UNQyYxGfGJSvpD1nb7KY6gEr0abS_RYdbVDFjpAvLJMKWizYAheZV/exec';

  try {
    // 但し書きリストの更新
    console.log('但し書きリストを登録中...');
    const resDesc = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateMasterList',
        payload: {
          sectionName: '但し書きリスト',
          items: descriptions,
          adminKey: adminKey
        }
      })
    });
    const dDesc = await resDesc.json();
    if (!dDesc.ok) throw new Error(dDesc.error);
    console.log('✅ 但し書きリスト登録完了');

    // 支払先リストの更新
    console.log('支払先リストを登録中...');
    const resPayee = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateMasterList',
        payload: {
          sectionName: '支払先リスト',
          items: payees,
          adminKey: adminKey
        }
      })
    });
    const dPayee = await resPayee.json();
    if (!dPayee.ok) throw new Error(dPayee.error);
    console.log('✅ 支払先リスト登録完了');

  } catch (err) {
    console.error('❌ エラーが発生しました:', err.message);
  }
}

main();
