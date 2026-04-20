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

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    console.error('Gemini API エラー: ' + statusCode + ' ' + response.getContentText());
    throw new Error('OCR処理に失敗しました（ステータス: ' + statusCode + '）');
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
