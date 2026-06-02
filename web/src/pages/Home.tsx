// ===================================
// ホーム画面
// ===================================
// 繰越金表示 + 大きなボタン2つ + 最近の提出（直近5件）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyHistory, getMasters, submitEntry } from '../lib/api';
import { getSubmitter, getCachedMasters, saveMasters, DEFAULT_MASTERS, getOfflineQueue, setOfflineQueue } from '../lib/storage';
import { Spinner } from '../components/Spinner';
import { Toast } from '../components/Toast';
import type { LedgerEntry, MasterData, SubmitPayload } from '../lib/types';

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
  const [offlineQueue, setOfflineQueueState] = useState<SubmitPayload[]>(getOfflineQueue());
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
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

  const handleSyncOfflineQueue = async () => {
    if (!navigator.onLine) {
      setToast({ message: 'オフラインです。電波の良いところで再試行してください。', type: 'error' });
      return;
    }
    
    setSyncing(true);
    let successCount = 0;
    const remainingQueue = [...offlineQueue];
    
    try {
      for (let i = 0; i < offlineQueue.length; i++) {
        await submitEntry(offlineQueue[i]);
        successCount++;
        remainingQueue.shift(); // 成功したものを先頭から取り除く
      }
      setToast({ message: `${successCount}件のデータを送信しました！`, type: 'success' });
    } catch (err) {
      setToast({ message: `送信中にエラーが発生しました（${successCount}件成功）`, type: 'error' });
    } finally {
      setOfflineQueueState(remainingQueue);
      setOfflineQueue(remainingQueue);
      setSyncing(false);
      // 送信成功したら履歴をリロード
      if (submitter) {
        getMyHistory(submitter)
          .then((items) => setRecentItems(items.slice(0, 5)))
          .catch(() => {});
      }
    }
  };

  return (
    <div className="page-enter flex-1 flex flex-col">
      {/* ヘッダー（白テーマ＆羽紋ロゴ） */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '2px solid #E5E9E8',
        padding: '1.25rem 1.25rem 1rem'
      }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1F2937', flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="44" stroke="currentColor" stroke-width="6" fill="none"/>
              <path d="M42 22c-8 6-12 20-12 38c0 14 6 22 12 22s12-8 12-22c0-18-4-32-12-38z" fill="currentColor"/>
              <path d="M58 22c8 6 12 20 12 38c0 14-6 22-12 22s-12-8-12-22c0-18 4-32 12-38z" fill="#C5A059"/>
              <line x1="30" y1="46" x2="48" y2="40" stroke="#FFFFFF" stroke-width="4"/>
              <line x1="30" y1="58" x2="48" y2="52" stroke="#FFFFFF" stroke-width="4"/>
              <line x1="52" y1="40" x2="70" y2="46" stroke="#FFFFFF" stroke-width="4"/>
              <line x1="52" y1="52" x2="70" y2="58" stroke="#FFFFFF" stroke-width="4"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1F2937', letterSpacing: '-0.01em' }}>
              仲羽田青年会 経費精算サイト
            </h1>
            <p style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '1px', fontWeight: 500 }}>Nakabata Seinenkai</p>
          </div>
        </div>
      </header>

      {/* オフライン未送信キューのバナー */}
      {offlineQueue.length > 0 && (
        <div className="px-5 mt-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <span>⚠️</span>
              <span>未送信のデータが {offlineQueue.length} 件あります</span>
            </div>
            <p className="text-xs text-amber-700 leading-snug">
              電波の悪い場所で登録されたデータです。<br/>
              通信環境の良い場所で送信ボタンを押してください。
            </p>
            <button
              onClick={handleSyncOfflineQueue}
              disabled={syncing}
              className="w-full py-2.5 bg-amber-500 text-white rounded-lg font-bold text-sm shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              {syncing ? <Spinner size="sm" /> : '📤 今すぐ送信する'}
            </button>
          </div>
        </div>
      )}


      {/* メインアクションボタン */}
      <div className="px-5 flex flex-col gap-3 mt-6">
        {/* 支出登録ボタン */}
        <button
          onClick={() => navigate('/expense')}
          className="btn-ripple w-full flex items-center gap-4 active:scale-[0.98] transition-transform"
          style={{ background: 'white', border: '2px solid #CBD5E1', borderRadius: '12px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, var(--color-matsuri-500), var(--color-matsuri-900))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="text-xl">📷</span>
          </div>
          <div className="text-left flex-1">
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-matsuri-900)' }}>支出を登録</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-matsuri-600)', marginTop: '2px' }}>領収書を撮影して経費申請</div>
          </div>
          <span style={{ color: 'var(--color-matsuri-500)', fontSize: '1.25rem', fontWeight: 'bold' }}>›</span>
        </button>

        {/* 収入登録ボタン */}
        <button
          onClick={() => navigate('/income')}
          className="btn-ripple w-full flex items-center gap-4 active:scale-[0.98] transition-transform"
          style={{ background: 'white', border: '2px solid #CBD5E1', borderRadius: '12px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, var(--color-matsuri-400), var(--color-matsuri-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="text-xl">💴</span>
          </div>
          <div className="text-left flex-1">
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-matsuri-900)' }}>収入を登録</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-matsuri-600)', marginTop: '2px' }}>奉納・会費などの入金を記録</div>
          </div>
          <span style={{ color: 'var(--color-matsuri-500)', fontSize: '1.25rem', fontWeight: 'bold' }}>›</span>
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
