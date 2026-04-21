// ===================================
// ホーム画面
// ===================================
// 繰越金表示 + 大きなボタン2つ + 最近の提出（直近5件）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyHistory, getMasters } from '../lib/api';
import { getSubmitter, getCachedMasters, saveMasters, DEFAULT_MASTERS } from '../lib/storage';
import type { LedgerEntry, MasterData } from '../lib/types';

const formatDateStr = (dStr: string) => {
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

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
      {/* ヘッダー（Indigo Slate Pro） */}
      <header style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #263C61 100%)',
        borderBottom: '3px solid #3B72B4',
        padding: '1.25rem 1.25rem 1rem'
      }}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏮</span>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#E0EAFF', letterSpacing: '-0.01em' }}>
              仲羽田青年会 経費精算サイト
            </h1>
            <p style={{ fontSize: '0.68rem', color: '#7FA8D4', marginTop: '1px' }}>Nakabata Seinenkai</p>
          </div>
        </div>
      </header>

      {/* 繰越金カード */}
      {masters.carryoverBalance > 0 && (
        <div className="px-5 mb-4 mt-4">
          <div style={{
            background: '#E8F0FE',
            borderRadius: '12px',
            borderLeft: '4px solid #3B72B4',
            padding: '0.85rem 1.1rem'
          }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#3B72B4', letterSpacing: '0.06em' }}>
              前年度繰越金
            </p>
            <p className="amount-display" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E3A5F', marginTop: '2px', letterSpacing: '-0.02em' }}>
              {formatAmount(masters.carryoverBalance)}
            </p>
          </div>
        </div>
      )}

      {/* メインアクションボタン */}
      <div className="px-5 flex flex-col gap-3">
        {/* 支出登録ボタン */}
        <button
          onClick={() => navigate('/expense')}
          className="btn-ripple w-full flex items-center gap-4 active:scale-[0.98] transition-transform"
          style={{ background: 'white', border: '1px solid #D8E3F0', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 10px rgba(30,58,95,0.06)' }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #3B72B4, #1E3A5F)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="text-xl">📷</span>
          </div>
          <div className="text-left flex-1">
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E3A5F' }}>支出を登録</div>
            <div style={{ fontSize: '0.72rem', color: '#5A7FA8', marginTop: '2px' }}>領収書を撮影して経費申請</div>
          </div>
          <span style={{ color: '#B8D0EB', fontSize: '1.1rem' }}>›</span>
        </button>

        {/* 収入登録ボタン */}
        <button
          onClick={() => navigate('/income')}
          className="btn-ripple w-full flex items-center gap-4 active:scale-[0.98] transition-transform"
          style={{ background: 'white', border: '1px solid #D8E3F0', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 10px rgba(30,58,95,0.06)' }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #5A90CC, #3B72B4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="text-xl">💴</span>
          </div>
          <div className="text-left flex-1">
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E3A5F' }}>収入を登録</div>
            <div style={{ fontSize: '0.72rem', color: '#5A7FA8', marginTop: '2px' }}>奉納・会費などの入金を記録</div>
          </div>
          <span style={{ color: '#B8D0EB', fontSize: '1.1rem' }}>›</span>
        </button>
      </div>

      {/* 最近の提出 */}
      <div className="px-5 mt-6 flex-1">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: '#3B72B4' }}>
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
                className="card px-4 py-3 w-full text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap
                      ${item.type === '支出' ? 'bg-matsuri-50 text-matsuri-600' : 'bg-amber-50 text-amber-700'}`}>
                      {item.type}
                    </span>
                    <span className="text-[10px] text-stone-400 whitespace-nowrap">{formatDateStr(item.date)}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap
                    ${item.status === '未精算' ? 'badge-unsettled' : 'badge-settled'}`}>
                    {item.status}
                  </span>
                </div>
                
                <div className="flex items-start justify-between mt-1.5 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-stone-700 truncate">
                      {item.category}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5 leading-snug break-words">
                      {item.description || item.payee || '(詳細なし)'}
                    </div>
                  </div>
                  <div className={`text-sm font-bold amount-display flex-shrink-0
                    ${item.type === '支出' ? 'text-matsuri-600' : 'text-green-700'}`}>
                    {item.type === '支出' ? '-' : '+'}{formatAmount(item.amount)}
                  </div>
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
