// ===================================
// 仲羽田青年会 経費精算アプリ — 型定義
// ===================================

/** 種別（支出 or 収入） */
export type EntryType = '支出' | '収入';

/** 支払状況 */
export type SettlementStatus = '未精算' | '精算済';

/** OCR 信頼度 */
export type OcrConfidence = '高' | '中' | '低' | '手入力';

/** マスタデータ（GAS から取得） */
export interface MasterData {
  submitters: string[];          // 提出者リスト
  expenseCategories: string[];   // 支出区分リスト
  incomeCategories: string[];    // 収入区分リスト
  descriptions?: string[];       // 但し書きリスト
  payees?: string[];             // 支払先リスト
  carryoverBalance: number;      // 前年度繰越金
  // 旧互換用
  categories?: string[];
}

/** 登録フォームの入力値 */
export interface SubmitPayload {
  type: EntryType;
  date: string;           // YYYY-MM-DD
  submitter: string;
  category: string;
  amount: number;
  quantity: string;        // 数量（任意: "30枚" "50個" 等）
  description: string;    // 但し書き
  payee: string;          // 支払先
  note: string;           // 備考
  imageBase64?: string;   // 領収書画像(base64)
  imageMimeType?: string; // image/jpeg 等
  ocrConfidence?: string; // OCR 信頼度（「高/中/低/手入力」）
}

/** 管理画面からの更新用ペイロード */
export interface EntryUpdatePayload {
  id: string;
  adminKey: string;
  date?: string;
  submitter?: string;
  category?: string;
  amount?: number;
  quantity?: string;
  description?: string;
  payee?: string;
  note?: string;
}

/** 台帳の1行（履歴表示用） */
export interface LedgerEntry {
  id: string;
  registeredAt: string;   // 登録日時
  type: EntryType;
  date: string;
  submitter: string;
  category: string;
  amount: number;
  quantity: string;        // 数量
  description: string;
  payee: string;
  receiptUrl: string;
  status: SettlementStatus;
  settledDate: string;
  note: string;
  ocrConfidence: OcrConfidence;
}

/** GAS API のレスポンス */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** submit の成功レスポンス */
export interface SubmitResult {
  id: string;
}

/** OCR の結果 */
export interface OcrResult {
  date: string | null;
  amount: number | null;
  payee: string | null;
  description: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/** 会計報告データ */
export interface AccountingReport {
  fiscalYear: string;
  carryoverBalance: number;     // 前年度繰越金
  incomeTotal: number;          // 収入合計
  expenseTotal: number;         // 支出合計
  nextCarryover: number;        // 次年度繰越金
  incomeByCategory: Record<string, number>;  // 収入 内訳
  expenseByCategory: Record<string, number>; // 支出 内訳
}
