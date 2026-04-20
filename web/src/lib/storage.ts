// ===================================
// localStorage によるデータキャッシュ
// ===================================
// - 提出者名: 次回起動時に自動選択
// - マスタデータ: オフライン時のフォールバック

import type { MasterData } from './types';

const KEYS = {
  SUBMITTER: 'mikoshi_submitter',
  MASTERS: 'mikoshi_masters',
} as const;

// ===================================
// 提出者名の保存・取得
// ===================================

/** 最後に選択した提出者名を保存 */
export function saveSubmitter(name: string): void {
  localStorage.setItem(KEYS.SUBMITTER, name);
}

/** 保存済みの提出者名を取得（未保存なら空文字） */
export function getSubmitter(): string {
  return localStorage.getItem(KEYS.SUBMITTER) || '';
}

// ===================================
// 管理者キーの保存・取得
// ===================================

/** 管理者キーをSessionStorageに保存 */
export function saveAdminKey(key: string): void {
  if (key) {
    sessionStorage.setItem('mikoshi_admin_key', key);
  } else {
    sessionStorage.removeItem('mikoshi_admin_key');
  }
}

/** 管理者キーをSessionStorageから取得 */
export function getAdminKey(): string {
  return sessionStorage.getItem('mikoshi_admin_key') || '';
}

// ===================================
// マスタデータのキャッシュ
// ===================================

/** マスタデータをキャッシュに保存 */
export function saveMasters(data: MasterData): void {
  localStorage.setItem(KEYS.MASTERS, JSON.stringify(data));
}

/** キャッシュ済みのマスタデータを取得（未保存なら null） */
export function getCachedMasters(): MasterData | null {
  const raw = localStorage.getItem(KEYS.MASTERS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MasterData;
  } catch {
    return null;
  }
}

// ===================================
// デフォルトのマスタデータ（GAS 未接続時のフォールバック）
// ===================================
// 2024年度実績に基づくカテゴリ
export const DEFAULT_MASTERS: MasterData = {
  submitters: [
    'テスト太郎',
    'テスト花子',
    'テスト一郎',
    'テスト二郎',
    'テスト三郎',
    'テスト四郎',
  ],
  expenseCategories: [
    '連合関連',
    '交際費',
    '接待飲食',
    '青年会活動費',
    '備品・消耗品',
    'その他',
  ],
  incomeCategories: [
    '年会費',
    '町会補助金',
    '祭礼奉納',
    '直会参加費',
    '個人奉納',
    '預金利息',
    'その他',
  ],
  carryoverBalance: 0,
};
