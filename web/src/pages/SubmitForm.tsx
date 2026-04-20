// ===================================
// 支出/収入 共通登録フォーム（OCR統合版）
// ===================================
// 画像選択時に自動でOCR実行 → フィールド自動入力
// OCR信頼度に応じた色付き警告表示

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitEntry, getMasters, runOcr } from '../lib/api';
import {
  getSubmitter, saveSubmitter,
  getCachedMasters, saveMasters, DEFAULT_MASTERS,
} from '../lib/storage';
import { FormField } from '../components/FormField';
import { ReceiptUploader } from '../components/ReceiptUploader';
import { Toast } from '../components/Toast';
import { Spinner } from '../components/Spinner';
import type { EntryType, MasterData, OcrResult } from '../lib/types';

// OCR信頼度 → 日本語ラベル + 色クラス
const CONFIDENCE_MAP: Record<string, { label: string; color: string; border: string }> = {
  high: { label: '高', color: 'bg-green-50 text-green-700', border: 'border-green-300' },
  medium: { label: '中', color: 'bg-amber-50 text-amber-700', border: 'border-amber-300' },
  low: { label: '低', color: 'bg-red-50 text-red-700', border: 'border-red-400' },
};

interface SubmitFormProps {
  type: EntryType;
}

export function SubmitForm({ type }: SubmitFormProps) {
  const navigate = useNavigate();
  const isExpense = type === '支出';

  // --- マスタデータ ---
  const [masters, setMasters] = useState<MasterData>(
    getCachedMasters() || DEFAULT_MASTERS
  );

  // --- フォーム値 ---
  const [submitter, setSubmitter] = useState(getSubmitter());
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('');

  // --- OCR 状態 ---
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrError, setOcrError] = useState('');

  // --- UI 状態 ---
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // マスタデータをGASから取得（初回）
  useEffect(() => {
    getMasters()
      .then((data) => {
        setMasters(data);
        saveMasters(data);
      })
      .catch(() => {
        console.log('マスタデータの取得に失敗。ローカルキャッシュを使用します。');
      });
  }, []);

  // 事業区分（支出/収入で分離）
  const filteredCategories = isExpense
    ? (masters.expenseCategories || masters.categories || [])
    : (masters.incomeCategories || masters.categories || []);

  // 画像選択時: base64 保存 + OCR 自動実行
  const handleImageReady = useCallback(async (base64: string, mime: string) => {
    setImageBase64(base64);
    setImageMimeType(mime);
    setOcrResult(null);
    setOcrError('');

    // OCR を非同期実行
    setOcrRunning(true);
    try {
      const result = await runOcr(base64, mime);
      setOcrResult(result);

      // OCR結果をフォームに自動入力（空のフィールドのみ）
      if (result.date && !date) setDate(result.date);
      if (result.amount !== null && !amount) {
        setAmount(result.amount.toLocaleString());
      }
      if (result.description && !description) setDescription(result.description);
      if (result.payee && !payee) setPayee(result.payee);

      setToast({ message: 'OCR読取が完了しました', type: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR処理に失敗しました';
      setOcrError(msg);
      // OCR失敗は致命的ではない → 手入力で続行可能
      console.warn('OCR失敗:', msg);
    } finally {
      setOcrRunning(false);
    }
  }, [date, amount, description, payee]);

  const handleImageClear = useCallback(() => {
    setImageBase64('');
    setImageMimeType('');
    setOcrResult(null);
    setOcrError('');
  }, []);

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!submitter) newErrors.submitter = '提出者を選択してください';
    if (!date) newErrors.date = '日付を入力してください';
    if (!category) newErrors.category = '事業区分を選択してください';

    const amountNum = parseInt(amount.replace(/,/g, ''), 10);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = '正しい金額を入力してください';
    }
    if (amountNum > 10_000_000) {
      newErrors.amount = '金額が大きすぎます（1,000万円以下）';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      saveSubmitter(submitter);

      // OCR 信頼度を日本語に変換して送信
      let ocrConfidence = '手入力';
      if (ocrResult) {
        const map: Record<string, string> = { high: '高', medium: '中', low: '低' };
        ocrConfidence = map[ocrResult.confidence] || '手入力';
      }

      await submitEntry({
        type,
        date,
        submitter,
        category,
        amount: parseInt(amount.replace(/,/g, ''), 10),
        quantity,
        description,
        payee,
        note,
        imageBase64: imageBase64 || undefined,
        imageMimeType: imageMimeType || undefined,
        ocrConfidence,
      });

      setToast({ message: '登録しました！', type: 'success' });
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '送信に失敗しました';
      setToast({ message: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // 金額入力のカンマ区切り表示
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (raw === '') {
      setAmount('');
      return;
    }
    const num = parseInt(raw, 10);
    setAmount(num.toLocaleString());
  };

  // OCR 信頼度バッジ
  const confidenceInfo = ocrResult ? CONFIDENCE_MAP[ocrResult.confidence] : null;

  return (
    <div className="page-enter flex-1 flex flex-col">
      {/* ヘッダー */}
      <header className={`px-5 pt-6 pb-4 flex items-center gap-3
        ${isExpense
          ? 'bg-gradient-to-r from-matsuri-700 to-matsuri-600'
          : 'bg-gradient-to-r from-chochin to-amber-600'
        }`}
      >
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center 
            text-white text-lg active:bg-white/30 transition-colors"
          aria-label="戻る"
        >
          ‹
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">
            {isExpense ? '📷 支出を登録' : '💴 収入を登録'}
          </h1>
          <p className="text-xs text-white/70">
            {isExpense ? '領収書を撮影して経費申請' : '寄付・会費などの入金を記録'}
          </p>
        </div>
      </header>

      {/* フォーム本体 */}
      <form onSubmit={handleSubmit} className="flex-1 px-5 py-5 flex flex-col gap-5 page-content">
        {/* 領収書画像 */}
        <FormField label="領収書・証憑" hint="カメラで撮影 or ギャラリーから選択">
          <ReceiptUploader
            onImageReady={handleImageReady}
            onImageClear={handleImageClear}
          />
        </FormField>

        {/* OCR ステータス表示 */}
        {ocrRunning && (
          <div className="card px-4 py-3 flex items-center gap-3 border-l-4 border-matsuri-400">
            <Spinner size="sm" />
            <div>
              <p className="text-sm font-medium text-stone-700">AI が領収書を読み取り中...</p>
              <p className="text-xs text-stone-400">数秒お待ちください</p>
            </div>
          </div>
        )}

        {/* OCR 結果バッジ */}
        {ocrResult && confidenceInfo && (
          <div className={`card px-4 py-3 border-l-4 ${confidenceInfo.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confidenceInfo.color}`}>
                OCR信頼度: {confidenceInfo.label}
              </span>
              {ocrResult.confidence === 'low' && (
                <span className="text-xs text-red-500 font-medium">⚠ 読取結果を確認してください</span>
              )}
            </div>
            <p className="text-xs text-stone-500">
              読取結果がフォームに入力されました。内容をご確認のうえ修正してください。
            </p>
          </div>
        )}

        {/* OCR エラー */}
        {ocrError && (
          <div className="card px-4 py-3 border-l-4 border-amber-400 bg-amber-50/50">
            <p className="text-sm font-medium text-amber-800">OCR読取に失敗しました</p>
            <p className="text-xs text-amber-600 mt-0.5">{ocrError}</p>
            <p className="text-xs text-stone-500 mt-1">手入力で登録を続行できます。</p>
          </div>
        )}

        {/* 提出者 */}
        <FormField label="提出者" required error={errors.submitter}>
          <div className="relative">
            <input
              type="text"
              list="submitter-list"
              value={submitter}
              onChange={(e) => setSubmitter(e.target.value)}
              placeholder="名前を入力または選択"
              className="form-input"
            />
            <datalist id="submitter-list">
              {masters.submitters.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </FormField>

        {/* 日付（OCR で自動入力される場合あり） */}
        <FormField label="日付" required error={errors.date}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`form-input ${ocrResult?.date ? 'ring-2 ring-green-200' : ''}`}
          />
        </FormField>

        {/* 事業区分 */}
        <FormField label="事業区分" required error={errors.category}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="form-input form-select"
          >
            <option value="">選択してください</option>
            {filteredCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </FormField>

        {/* 金額（OCR で自動入力される場合あり） */}
        <FormField label="金額（円）" required error={errors.amount}>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">¥</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className={`form-input pl-9 text-right text-lg font-bold amount-display
                ${ocrResult?.amount !== null && ocrResult?.amount !== undefined ? 'ring-2 ring-green-200' : ''}`}
            />
          </div>
        </FormField>

        {/* 数量（任意） */}
        <FormField label="数量" hint="例: 30枚、50個、1パック">
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="30枚"
            className="form-input"
          />
        </FormField>

        {/* 但し書き */}
        <FormField label="但し書き" hint="例: 御祭礼費として">
          <div className="relative">
            <input
              type="text"
              list="description-list"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="御祭礼費として"
              className={`form-input ${ocrResult?.description ? 'ring-2 ring-green-200' : ''}`}
            />
            <datalist id="description-list">
              {masters.descriptions?.map((desc) => (
                <option key={desc} value={desc} />
              ))}
            </datalist>
          </div>
        </FormField>

        {/* 支払先 */}
        <FormField label={isExpense ? '支払先' : '入金元'} hint="例: ○○酒店">
          <div className="relative">
            <input
              type="text"
              list="payee-list"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder={isExpense ? '○○酒店' : '○○町会'}
              className={`form-input ${ocrResult?.payee ? 'ring-2 ring-green-200' : ''}`}
            />
            <datalist id="payee-list">
              {masters.payees?.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </FormField>

        {/* 備考 */}
        <FormField label="備考">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="補足があれば記入"
            rows={2}
            className="form-input resize-none"
          />
        </FormField>

        {/* 送信ボタン */}
        <div className="mt-2 pb-8">
          <button
            type="submit"
            disabled={submitting || ocrRunning}
            className={`w-full py-4 rounded-2xl font-bold text-white text-base
              shadow-lg transition-all active:scale-[0.97]
              flex items-center justify-center gap-2
              ${isExpense
                ? 'bg-gradient-to-r from-matsuri-600 to-matsuri-700 shadow-matsuri-200 hover:from-matsuri-700 hover:to-matsuri-800'
                : 'bg-gradient-to-r from-chochin to-amber-600 shadow-amber-100 hover:from-amber-700 hover:to-amber-800'
              }
              disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`}
          >
            {submitting ? (
              <>
                <Spinner size="sm" className="border-white/30 border-t-white" />
                <span>送信中...</span>
              </>
            ) : (
              <span>{isExpense ? '支出を登録する' : '収入を登録する'}</span>
            )}
          </button>
        </div>
      </form>

      {/* トースト通知 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
