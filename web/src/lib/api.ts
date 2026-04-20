// ===================================
// GAS Web App との通信モジュール
// ===================================
// CORS 回避: Content-Type を text/plain にして JSON を送信
// GAS の doPost は redirect: 'follow' で到達する

import type { ApiResponse, MasterData, SubmitPayload, SubmitResult, LedgerEntry, OcrResult, AccountingReport } from './types';

const GAS_URL = import.meta.env.VITE_GAS_URL;

/**
 * GAS Web App に POST リクエストを送信する汎用関数
 * @param action - 実行するアクション名
 * @param payload - リクエストペイロード
 * @returns レスポンスデータ
 */
export async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8', // CORS 回避（preflight 不要にする）
    },
    body: JSON.stringify({ action, payload }),
    redirect: 'follow', // GAS のリダイレクトに追従
  });

  if (!res.ok) {
    throw new Error(`通信エラー: ${res.status} ${res.statusText}`);
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.ok) {
    throw new Error(json.error || '不明なエラーが発生しました');
  }

  return json.data as T;
}

// ===================================
// 各 API アクション
// ===================================

/** マスタデータ取得（提出者リスト・事業区分リスト） */
export async function getMasters(): Promise<MasterData> {
  return callApi<MasterData>('getMasters');
}

/** 支出/収入を1件登録 */
export async function submitEntry(payload: SubmitPayload): Promise<SubmitResult> {
  return callApi<SubmitResult>('submit', payload as unknown as Record<string, unknown>);
}

/** 自分の履歴を取得（最新20件） */
export async function getMyHistory(submitter: string): Promise<LedgerEntry[]> {
  return callApi<LedgerEntry[]>('getMyHistory', { submitter });
}

/** 未精算一覧を取得（管理者用） */
export async function getUnsettled(adminKey: string): Promise<LedgerEntry[]> {
  return callApi<LedgerEntry[]>('getUnsettled', { adminKey });
}

/** 指定IDを精算済に更新（管理者用） */
export async function markSettled(ids: string[], adminKey: string): Promise<{ count: number }> {
  return callApi<{ count: number }>('markSettled', { ids, adminKey });
}

/** 指定IDのデータを削除（管理者用） */
export async function deleteEntry(id: string, adminKey: string): Promise<{ success: boolean }> {
  return callApi<{ success: boolean }>('deleteEntry', { id, adminKey });
}

/** 指定IDのデータを更新（管理者用） */
export async function updateEntry(payload: import('./types').EntryUpdatePayload): Promise<{ success: boolean }> {
  return callApi<{ success: boolean }>('updateEntry', payload as unknown as Record<string, unknown>);
}

/** マスターリストの更新（管理者用） */
export async function updateMasterList(sectionName: string, items: string[], adminKey: string): Promise<{ success: boolean }> {
  return callApi<{ success: boolean }>('updateMasterList', { sectionName, items, adminKey });
}

/** 前年度繰越金の更新（管理者用） */
export async function updateCarryoverBalance(balance: number, adminKey: string): Promise<{ success: boolean }> {
  return callApi<{ success: boolean }>('updateCarryoverBalance', { balance, adminKey });
}

/** 画像の OCR を実行（Gemini 経由） */
export async function runOcr(imageBase64: string, imageMimeType: string): Promise<OcrResult> {
  return callApi<OcrResult>('ocr', { imageBase64, imageMimeType });
}

/** 会計報告データを取得（管理者用） */
export async function getReport(adminKey: string, fiscalYear?: string): Promise<AccountingReport> {
  return callApi<AccountingReport>('getReport', { adminKey, fiscalYear });
}

// ===================================
// ユーティリティ
// ===================================

/**
 * File オブジェクトを base64 文字列に変換
 * @param file - 画像ファイル
 * @returns base64 エンコード文字列（data: プレフィックスなし）
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // "data:image/jpeg;base64,xxxxx" から base64 部分だけ抽出
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
