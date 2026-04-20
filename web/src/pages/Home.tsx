// ===================================
// ホーム画面
// ===================================
// 繰越金表示 + 大きなボタン2つ + 最近の提出（直近5件）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyHistory, getMasters } from '../lib/api';
import { getSubmitter, getCachedMasters, saveMasters, DEFAULT_MASTERS } from '../lib/storage';
import type { LedgerEntry, MasterData } from '../lib/types';

export function Home() {
  const navigate = useNavigate();
  const [recentItems, setRecentItems] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState<MasterData>(
    getCachedMasters() || DEFAULT_MASTERS
  );
  const submitter = getSubmitter();

  // マスタデータ取得（繰越金を含む）
  useEffect(() => {
    getMasters()
      .then((data) => {
        setMasters(data);
        saveMasters(data);
      })
      .catch(() => {/* GAS未接続時はキャッシュを使用 */});
  }, []);

  // 提出者名が保存されていれば、最近の履歴を取得
  useEffect(() => {
    if (!submitter) return;
    setLoading(true);
    getMyHistory(submitter)
      .then((items) => setRecentItems(items.slice(0, 5)))
      .catch(() => {/* GAS未接続時は空表示 */})
      .finally(() => setLoading(false));
  }, [submitter]);

  // 金額のフォーマット（カンマ区切り）
  const formatAmount = (n: number) => `¥${n.toLocaleString()}`;

  const hasSetup = masters.submitters.length > 0;

  return (
    <div className="page-enter flex-1 flex flex-col">
      {/* ヘッダー */}
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">⛩️</span>
          <div>
            <h1 className="text-xl font-bold text-matsuri-800 tracking-tight">
              神輿会 経費精算
            </h1>
            <p className="text-xs text-stone-500 font-medium">
              {submitter ? `${submitter} さん` : 'ようこそ'}
            </p>
          </div>
        </div>
      </header>

      {/* 繰越金カード */}
      {masters.carryoverBalance > 0 && (
        <div className="px-5 mb-4">
          <div className="card px-5 py-4 bg-gradient-to-r from-stone-50 to-white
            border border-stone-200/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  前年度繰越金
                </p>
                <p className="text-2xl font-bold text-stone-800 amount-display mt-0.5">
                  {formatAmount(masters.carryoverBalance)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メインアクションボタン */}
      <div className="px-5 flex flex-col gap-3">
        {/* 支出登録ボタン */}
        <button
          onClick={() => navigate('/expense')}
          className="btn-ripple card w-full p-5 flex items-center gap-4 
            active:scale-[0.98] transition-transform"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-matsuri-500 to-matsuri-700 
            flex items-center justify-center shadow-md shadow-matsuri-200">
            <span className="text-2xl">📷</span>
          </div>
          <div className="text-left flex-1">
            <div className="text-base font-bold text-stone-800">支出を登録</div>
            <div className="text-xs text-stone-500 mt-0.5">
              領収書を撮影して経費申請
            </div>
          </div>
          <span className="text-stone-300 text-lg">›</span>
        </button>

        {/* 収入登録ボタン */}
        <button
          onClick={() => navigate('/income')}
          className="btn-ripple card w-full p-5 flex items-center gap-4 
            active:scale-[0.98] transition-transform"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-chochin to-chochin-light 
            flex items-center justify-center shadow-md shadow-amber-100">
            <span className="text-2xl">💴</span>
          </div>
          <div className="text-left flex-1">
            <div className="text-base font-bold text-stone-800">収入を登録</div>
            <div className="text-xs text-stone-500 mt-0.5">
              奉納・会費などの入金を記録
            </div>
          </div>
          <span className="text-stone-300 text-lg">›</span>
        </button>
      </div>

      {/* 最近の提出 */}
      <div className="px-5 mt-6 flex-1">
        <h2 className="text-sm font-bold text-stone-600 mb-3 flex items-center gap-1.5">
          <span>📝</span> 最近の提出
        </h2>

        {!submitter && !hasSetup && (
          <div className="card p-4 text-center">
            <p className="text-sm text-stone-500">
              支出または収入を登録すると、<br />ここに履歴が表示されます
            </p>
          </div>
        )}

        {submitter && loading && (
          <div className="card p-6 flex items-center justify-center gap-2">
            <div className="spinner" />
            <span className="text-sm text-stone-500">読み込み中...</span>
          </div>
        )}

        {submitter && !loading && recentItems.length === 0 && (
          <div className="card p-4 text-center">
            <p className="text-sm text-stone-500">まだ提出がありません</p>
          </div>
        )}

        {recentItems.length > 0 && (
          <div className="flex flex-col gap-2">
            {recentItems.map((item) => (
              <div
                key={item.id}
                className="card px-4 py-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 font-medium">
                      {item.date}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                      ${item.status === '未精算' ? 'badge-unsettled' : 'badge-settled'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-stone-700 mt-0.5 truncate">
                    {item.category} — {item.description || item.payee || '(詳細なし)'}
                  </div>
                </div>
                <div className={`text-sm font-bold amount-display ml-3
                  ${item.type === '支出' ? 'text-matsuri-600' : 'text-green-700'}`}>
                  {item.type === '支出' ? '-' : '+'}{formatAmount(item.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* フッター余白（BottomNav 分） */}
      <div className="h-20" />
    </div>
  );
}
