// ===================================
// 履歴画面
// ===================================
// 自分の提出履歴一覧（最新順）
// 各行に支払状況バッジ、行タップで詳細モーダル

import { useState, useEffect, useCallback } from 'react';
import { getMyHistory, deleteEntry, updateEntry } from '../lib/api';
import { getSubmitter, getCachedMasters, DEFAULT_MASTERS } from '../lib/storage';
import { Spinner } from '../components/Spinner';
import { Toast } from '../components/Toast';
import type { LedgerEntry } from '../lib/types';

const formatDateStr = (dStr: string) => {
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

export function History() {
  const [items, setItems] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmitter, setSelectedSubmitter] = useState(getSubmitter());
  const [selectedItem, setSelectedItem] = useState<LedgerEntry | null>(null);

  const [editingItem, setEditingItem] = useState<LedgerEntry | null>(null);
  const [editData, setEditData] = useState<Partial<LedgerEntry>>({});
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const masters = getCachedMasters() || DEFAULT_MASTERS;

  // 履歴を取得
  const fetchHistory = useCallback(() => {
    if (!selectedSubmitter) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getMyHistory(selectedSubmitter)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selectedSubmitter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (id: string) => {
    if (!confirm('このデータを完全に削除しますか？')) return;
    setProcessing(true);
    try {
      await deleteEntry(id, undefined, selectedSubmitter);
      setToast({ message: '削除しました', type: 'success' });
      setSelectedItem(null);
      fetchHistory();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '削除失敗', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedItem) return;
    setProcessing(true);
    try {
      await updateEntry({
        id: selectedItem.id,
        submitter_auth: selectedSubmitter,
        ...editData
      });
      setToast({ message: '修正を保存しました', type: 'success' });
      setEditingItem(null);
      setSelectedItem(null);
      fetchHistory();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '保存失敗', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const formatAmount = (n: number) => `¥${n.toLocaleString()}`;

  return (
    <div className="page-enter flex-1 flex flex-col">
      {/* ヘッダー（陽） */}
      <header style={{
        background: 'linear-gradient(135deg, var(--color-matsuri-900) 0%, var(--color-matsuri-800) 100%)',
        borderBottom: '3px solid var(--color-matsuri-500)',
        padding: '1.1rem 1.25rem'
      }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📋</span> 提出履歴
        </h1>
      </header>

      {/* 提出者フィルタ */}
      <div className="px-5 mb-4">
        <select
          value={selectedSubmitter}
          onChange={(e) => setSelectedSubmitter(e.target.value)}
          className="form-input form-select text-sm"
        >
          <option value="">提出者を選択</option>
          {masters.submitters.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* 一覧 */}
      <div className="px-5 flex-1 page-content">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {!loading && !selectedSubmitter && (
          <div className="card p-6 text-center">
            <p className="text-stone-500 text-sm">提出者を選択してください</p>
          </div>
        )}

        {!loading && selectedSubmitter && items.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-stone-500 text-sm">履歴がありません</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="flex flex-col gap-2 pb-4">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="card px-4 py-3 w-full text-left active:scale-[0.99] transition-transform"
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
                    {item.description && (
                      <div className="text-[11px] text-stone-500 mt-0.5 leading-snug break-words">
                        {item.description}
                      </div>
                    )}
                    {item.payee && (
                      <div className="text-[10px] text-stone-400 mt-1 truncate">支払先: {item.payee}</div>
                    )}
                  </div>
                  <div className={`text-sm font-bold amount-display flex-shrink-0
                    ${item.type === '支出' ? 'text-matsuri-600' : 'text-green-700'}`}>
                    {item.type === '支出' ? '-' : '+'}{formatAmount(item.amount)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 詳細モーダル */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={() => { setSelectedItem(null); setEditingItem(null); }}
        >
          <div
            className="w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-6 pb-8 
              animate-[toastSlideIn_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-800">
                {editingItem ? '内容を修正' : '詳細'}
              </h3>
              <button
                onClick={() => { setSelectedItem(null); setEditingItem(null); }}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center 
                  text-stone-500 text-sm active:bg-stone-200"
              >
                ✕
              </button>
            </div>

            {/* 詳細内容 */}
            {editingItem ? (
              <div className="space-y-3">
                <input type="date" className="form-input text-sm p-2 w-full"
                  value={editData.date || ''} onChange={e => setEditData({...editData, date: e.target.value})} />
                
                <select className="form-input text-sm p-2 w-full"
                  value={editData.category || ''} onChange={e => setEditData({...editData, category: e.target.value})}>
                  <option value="">事業区分</option>
                  {(selectedItem.type === '支出' ? masters.expenseCategories : masters.incomeCategories)?.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <input type="number" className="form-input text-sm p-2 w-full" placeholder="金額"
                  value={editData.amount || ''} onChange={e => setEditData({...editData, amount: Number(e.target.value)})} />
                
                <input type="text" className="form-input text-sm p-2 w-full" placeholder="数量"
                  value={editData.quantity || ''} onChange={e => setEditData({...editData, quantity: e.target.value})} />
                
                <input type="text" className="form-input text-sm p-2 w-full" placeholder="但し書き"
                  value={editData.description || ''} onChange={e => setEditData({...editData, description: e.target.value})} />
                
                <input type="text" className="form-input text-sm p-2 w-full" placeholder="支払先"
                  value={editData.payee || ''} onChange={e => setEditData({...editData, payee: e.target.value})} />
                
                <textarea className="form-input text-sm p-2 w-full" placeholder="備考" rows={2}
                  value={editData.note || ''} onChange={e => setEditData({...editData, note: e.target.value})} />

                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditingItem(null)} disabled={processing}
                    className="flex-1 py-2 bg-stone-100 rounded-lg text-sm font-bold">
                    キャンセル
                  </button>
                  <button onClick={handleUpdate} disabled={processing}
                    className="flex-1 py-2 bg-matsuri-700 text-white rounded-lg text-sm font-bold">
                    保存する
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <DetailRow label="種別" value={selectedItem.type} />
                <DetailRow label="日付" value={selectedItem.date} />
                <DetailRow label="事業区分" value={selectedItem.category} />
                <DetailRow
                  label="金額"
                  value={formatAmount(selectedItem.amount)}
                  className={selectedItem.type === '支出' ? 'text-matsuri-600 font-bold' : 'text-green-700 font-bold'}
                />
                {selectedItem.quantity && (
                  <DetailRow label="数量" value={selectedItem.quantity} />
                )}
                {selectedItem.description && (
                  <DetailRow label="但し書き" value={selectedItem.description} />
                )}
                {selectedItem.payee && (
                  <DetailRow label="支払先" value={selectedItem.payee} />
                )}
                <DetailRow label="状態" value={selectedItem.status} />
                {selectedItem.note && (
                  <DetailRow label="備考" value={selectedItem.note} />
                )}

                {/* 領収書画像 */}
                {selectedItem.receiptUrl && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-stone-500 mb-2">領収書</p>
                    <a
                      href={selectedItem.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block card p-3 text-center text-sm text-matsuri-600 font-medium
                        active:bg-matsuri-50 transition-colors"
                    >
                      📄 領収書画像を開く
                    </a>
                  </div>
                )}

                {/* アクションボタン (未精算の場合のみ) */}
                {selectedItem.status === '未精算' && (
                  <div className="flex gap-3 pt-4 border-t border-stone-100">
                    <button onClick={() => { setEditingItem(selectedItem); setEditData({...selectedItem}); }}
                      className="flex-1 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-bold active:scale-95 transition-all">
                      ✏️ 修正する
                    </button>
                    <button onClick={() => handleDelete(selectedItem.id)} disabled={processing}
                      className="flex-1 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-50">
                      🗑️ 削除する
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BottomNav 用の余白 */}
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

// 詳細行コンポーネント
function DetailRow({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-stone-100">
      <span className="text-xs font-semibold text-stone-500">{label}</span>
      <span className={`text-sm text-stone-800 ${className}`}>{value}</span>
    </div>
  );
}
