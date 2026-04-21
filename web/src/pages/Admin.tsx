// ===================================
// 管理者画面（認証付き・タブ切替）
// ===================================
// URL: /#/admin  → 認証フォーム表示
// 機能: 未精算一覧 + 一括精算 + 会計サマリー + スプレッドシートリンク

import { useState, useEffect, useCallback } from 'react';
import { getUnsettled, getSettled, markSettled, revertToUnsettled, getReport, deleteEntry, updateEntry, generateReportSheet } from '../lib/api';
import { getAdminKey, saveAdminKey, getCachedMasters } from '../lib/storage';
import { Spinner } from '../components/Spinner';
import { Toast } from '../components/Toast';
import { MasterManager } from '../components/MasterManager';
import { AccountingCharts } from '../components/AccountingCharts';
import type { LedgerEntry, AccountingReport } from '../lib/types';

const formatDateStr = (dStr: string) => {
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

// スプレッドシート URL
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1Ar-HSbG_5dVPJEforaEBfc0jy1Ip2A202QH_RMPexSA/edit';

type Tab = 'unsettled' | 'settled' | 'report' | 'masters';

export function Admin() {
  // --- 認証 ---
  const [adminKey, setAdminKey] = useState(() => getAdminKey() || '');
  const [keyInput, setKeyInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  // --- タブ ---
  const [activeTab, setActiveTab] = useState<Tab>('unsettled');

  // --- 未精算タブ ---
  const [items, setItems] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<LedgerEntry>>({});

  // --- 精算済みタブ ---
  const [settledItems, setSettledItems] = useState<LedgerEntry[]>([]);
  const [settledLoading, setSettledLoading] = useState(false);
  const [settledSelectedIds, setSettledSelectedIds] = useState<Set<string>>(new Set());
  const [settledEditingId, setSettledEditingId] = useState<string | null>(null);
  const [settledEditData, setSettledEditData] = useState<Partial<LedgerEntry>>({});
  const [settledYear, setSettledYear] = useState(() => new Date().getFullYear().toString());
  const [report, setReport] = useState<AccountingReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportYear, setReportYear] = useState(() =>
    new Date().getFullYear().toString()
  );
  
  const masters = getCachedMasters();

  // --- UI ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 認証チェック: 保存されたキーがあれば自動認証
  useEffect(() => {
    if (adminKey) {
      authenticate(adminKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 認証処理
  const authenticate = async (key: string) => {
    setAuthError('');
    setLoading(true);
    try {
      await getUnsettled(key);
      setAdminKey(key);
      setAuthenticated(true);
      saveAdminKey(key);
    } catch {
      setAuthError('認証に失敗しました。管理者キーを確認してください。');
      setAuthenticated(false);
      saveAdminKey('');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyInput.trim()) {
      authenticate(keyInput.trim());
    }
  };

  // 未精算一覧を取得
  const fetchItems = useCallback(() => {
    if (!adminKey) return;
    setLoading(true);
    getUnsettled(adminKey)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [adminKey]);

  // 精算済み一覧を取得
  const fetchSettled = useCallback(() => {
    if (!adminKey) return;
    setSettledLoading(true);
    getSettled(adminKey, settledYear)
      .then(setSettledItems)
      .catch(() => setSettledItems([]))
      .finally(() => setSettledLoading(false));
  }, [adminKey, settledYear]);

  // 会計レポートを取得
  const fetchReport = useCallback(() => {
    if (!adminKey) return;
    setReportLoading(true);
    getReport(adminKey, reportYear)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setReportLoading(false));
  }, [adminKey, reportYear]);

  // 認証後にデータ取得
  useEffect(() => {
    if (authenticated) {
      fetchItems();
    }
  }, [authenticated, fetchItems]);

  // タブ切替時にレポート取得
  useEffect(() => {
    if (authenticated && activeTab === 'report') {
      fetchReport();
    }
  }, [authenticated, activeTab, fetchReport]);

  // 精算済みタブ表示時に自動取得
  useEffect(() => {
    if (authenticated && activeTab === 'settled') {
      fetchSettled();
    }
  }, [authenticated, activeTab, fetchSettled]);

  // 年度変更時に自動リフレッシュ
  useEffect(() => {
    if (authenticated && activeTab === 'report') {
      fetchReport();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportYear]);

  // 精算済み年度変更時に自動取得
  useEffect(() => {
    if (authenticated && activeTab === 'settled') {
      fetchSettled();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledYear]);

  // チェックボックス操作
  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(
      selectedIds.size === items.length
        ? new Set()
        : new Set(items.map((i) => i.id))
    );
  };

  // 削除処理
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('本当にこのデータを削除しますか？')) return;
    setProcessing(true);
    try {
      await deleteEntry(id, adminKey);
      setToast({ message: '削除しました', type: 'success' });
      fetchItems();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '削除失敗', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateSheet = async () => {
    if (!adminKey) return;
    setProcessing(true);
    try {
      const res = await generateReportSheet(adminKey, reportYear) as { message: string, sheetUrl: string, pdfBase64?: string };
      if (res.pdfBase64) {
        setToast({ message: '報告書を作成しました。ダウンロードを開始します...', type: 'success' });
        
        // Base64からBlobへ変換
        const byteCharacters = atob(res.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // ダウンロードのトリガー
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${reportYear}年度_会計報告書.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        
      } else {
        setToast({ message: res.message || '報告書シートを生成しました', type: 'success' });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '報告書シートの生成に失敗しました';
      setToast({ message: `生成エラー: ${errMsg}`, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // 編集処理
  const startEdit = (item: LedgerEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditData({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setProcessing(true);
    try {
      await updateEntry({
        id: editingId,
        adminKey,
        date: editData.date,
        submitter: editData.submitter,
        category: editData.category,
        amount: Number(editData.amount),
        quantity: editData.quantity,
        description: editData.description,
        payee: editData.payee,
        note: editData.note,
      });
      setToast({ message: '更新しました', type: 'success' });
      setEditingId(null);
      fetchItems();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '更新失敗', type: 'error' });
      setProcessing(false);
    }
  };

  // 精算済処理
  const handleSettle = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const result = await markSettled(Array.from(selectedIds), adminKey);
      setToast({ message: `${result.count}件を精算済にしました`, type: 'success' });
      setSelectedIds(new Set());
      fetchItems();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '更新に失敗', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // 精算済み → 未精算に戻す
  const handleRevert = async () => {
    if (settledSelectedIds.size === 0) return;
    if (!confirm(`${settledSelectedIds.size}件を未精算に戻しますか？`)) return;
    setProcessing(true);
    try {
      const result = await revertToUnsettled(Array.from(settledSelectedIds), adminKey);
      setToast({ message: `${result.count}件を未精算に戻しました`, type: 'success' });
      setSettledSelectedIds(new Set());
      fetchSettled();
      fetchItems();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '戻し処理に失敗', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // 精算済みデータの削除
  const handleSettledDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('このデータを完全に削除しますか？元に戻せません。')) return;
    setProcessing(true);
    try {
      await deleteEntry(id, adminKey);
      setToast({ message: '削除しました', type: 'success' });
      fetchSettled();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '削除失敗', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // 精算済みデータの編集開始
  const startSettledEdit = (item: LedgerEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setSettledEditingId(item.id);
    setSettledEditData({ ...item });
  };

  const cancelSettledEdit = () => {
    setSettledEditingId(null);
    setSettledEditData({});
  };

  const saveSettledEdit = async () => {
    if (!settledEditingId) return;
    setProcessing(true);
    try {
      await updateEntry({
        id: settledEditingId,
        adminKey,
        date: settledEditData.date,
        submitter: settledEditData.submitter,
        category: settledEditData.category,
        amount: Number(settledEditData.amount),
        quantity: settledEditData.quantity,
        description: settledEditData.description,
        payee: settledEditData.payee,
        note: settledEditData.note,
      });
      setToast({ message: '更新しました', type: 'success' });
      setSettledEditingId(null);
      fetchSettled();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : '更新失敗', type: 'error' });
      setProcessing(false);
    }
  };

  // ログアウト
  const handleLogout = () => {
    setAuthenticated(false);
    setAdminKey('');
    setKeyInput('');
    saveAdminKey('');
  };

  const formatAmount = (n: number) => `¥${n.toLocaleString()}`;

  // 提出者別合計
  const submitterTotals = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.submitter] = (acc[item.submitter] || 0) + item.amount;
    return acc;
  }, {});

  // ==============================
  // 認証画面
  // ==============================
  if (!authenticated) {
    return (
      <div className="page-enter flex-1 flex flex-col items-center justify-center px-5">
        <div className="card p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <span className="text-4xl block mb-3">🔐</span>
            <h1 className="text-lg font-bold text-stone-800">管理者ログイン</h1>
            <p className="text-xs text-stone-500 mt-1">管理者キーを入力してください</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="管理者キー"
              className="form-input text-center text-lg tracking-widest"
              autoFocus
            />

            {authError && (
              <p className="text-xs text-red-500 text-center font-medium">{authError}</p>
            )}

            <button
              type="submit"
              disabled={!keyInput.trim() || loading}
              style={{
                width: '100%', padding: '0.9rem', borderRadius: 12, fontWeight: 700,
                color: 'white', background: !keyInput.trim() || loading ? '#9BB8D8' : 'linear-gradient(135deg, #1E3A5F, #3B72B4)',
                border: 'none', cursor: !keyInput.trim() || loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(30,58,95,0.2)',
              }}
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" />
                  <span>認証中...</span>
                </>
              ) : (
                <span>ログイン</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==============================
  // メイン管理画面
  // ==============================
  return (
    <div className="page-enter flex-1 flex flex-col">
      {/* ヘッダー */}
      <header style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #263C61 100%)',
        borderBottom: '3px solid #3B72B4',
        padding: '1rem 1.25rem 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#E0EAFF', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚙️</span> 管理者画面
            </h1>
            <p style={{ fontSize: '0.65rem', color: '#7FA8D4', marginTop: 1 }}>経費精算の管理・会計報告</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ fontSize: '0.7rem', color: '#B8D0EB', padding: '0.3rem 0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer' }}
          >
            ログアウト
          </button>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.2)', borderRadius: '10px 10px 0 0', padding: '0.3rem 0.3rem 0' }}>
          <button
            onClick={() => setActiveTab('unsettled')}
            style={{
              flex: 1, fontSize: '0.65rem', fontWeight: 700, padding: '0.5rem 0.1rem',
              borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'unsettled' ? 'white' : 'transparent',
              color: activeTab === 'unsettled' ? '#1E3A5F' : 'rgba(255,255,255,0.55)',
            }}
          >
            📋 未精算 {items.length > 0 && `(${items.length})`}
          </button>
          <button
            onClick={() => setActiveTab('settled')}
            style={{
              flex: 1, fontSize: '0.65rem', fontWeight: 700, padding: '0.5rem 0.1rem',
              borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'settled' ? 'white' : 'transparent',
              color: activeTab === 'settled' ? '#1E3A5F' : 'rgba(255,255,255,0.55)',
            }}
          >
            ✅ 精算済み
          </button>
          <button
            onClick={() => setActiveTab('report')}
            style={{
              flex: 1, fontSize: '0.65rem', fontWeight: 700, padding: '0.5rem 0.1rem',
              borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'report' ? 'white' : 'transparent',
              color: activeTab === 'report' ? '#1E3A5F' : 'rgba(255,255,255,0.55)',
            }}
          >
            📊 会計
          </button>
          <button
            onClick={() => setActiveTab('masters')}
            style={{
              flex: 1, fontSize: '0.65rem', fontWeight: 700, padding: '0.5rem 0.1rem',
              borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'masters' ? 'white' : 'transparent',
              color: activeTab === 'masters' ? '#1E3A5F' : 'rgba(255,255,255,0.55)',
            }}
          >
            ⚙️ マスター
          </button>
        </div>
      </header>

      {/* ===== 未精算タブ ===== */}
      {activeTab === 'unsettled' && (
        <div className="flex-1 flex flex-col">
          {/* 提出者別サマリー */}
          {Object.keys(submitterTotals).length > 0 && (
            <div className="px-5 py-4">
              <h2 className="text-sm font-bold text-stone-600 mb-2">提出者別 未精算合計</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(submitterTotals).map(([name, total]) => (
                  <div key={name} className="card px-3 py-2">
                    <div className="text-xs text-stone-500">{name}</div>
                    <div className="text-sm font-bold text-matsuri-700 amount-display">
                      {formatAmount(total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* アクションバー */}
          {items.length > 0 && (
            <div className="px-5 py-3 flex items-center gap-3 border-t border-stone-100">
              <button onClick={toggleAll}
                className="text-xs font-medium text-matsuri-600 px-3 py-1.5 rounded-lg
                  bg-matsuri-50 active:bg-matsuri-100 transition-colors">
                {selectedIds.size === items.length ? '全解除' : '全選択'}
              </button>
              <div className="flex-1 text-xs text-stone-400">
                {selectedIds.size > 0 ? `${selectedIds.size}件 選択中` : ''}
              </div>
              <button onClick={handleSettle}
                disabled={selectedIds.size === 0 || processing}
                className="text-xs font-bold text-white px-4 py-2 rounded-xl
                  bg-gradient-to-r from-green-600 to-green-700
                  disabled:opacity-40 disabled:cursor-not-allowed
                  active:scale-[0.97] transition-all flex items-center gap-1.5">
                {processing ? (
                  <><Spinner size="sm" className="border-white/30 border-t-white" /><span>処理中...</span></>
                ) : (
                  <span>精算済にする</span>
                )}
              </button>
            </div>
          )}

          {/* 一覧 */}
          <div className="px-5 flex-1">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="card p-6 text-center">
                <span className="text-3xl block mb-2">🎉</span>
                <p className="text-stone-500 text-sm">未精算の項目はありません</p>
              </div>
            )}
            {!loading && items.length > 0 && (
              <div className="flex flex-col gap-2 pb-4">
                {items.map((item) => (
                  editingId === item.id ? (
                    <div key={item.id} className="card px-4 py-4 flex flex-col gap-3 shadow-md bg-stone-50 border border-matsuri-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-stone-700 text-sm">📝 データの編集</span>
                        <div className="flex gap-2 text-xs">
                          <button onClick={cancelEdit} className="px-3 py-1.5 bg-stone-200 text-stone-600 rounded-lg font-bold active:scale-95 transition-all">キャンセル</button>
                          <button onClick={saveEdit} disabled={processing} className="px-3 py-1.5 bg-gradient-to-r from-matsuri-600 to-matsuri-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 active:scale-95 transition-all">保存</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex flex-col gap-1">
                          <label className="text-stone-500 font-medium">日付</label>
                          <input type="date" value={editData.date || ''} onChange={e => setEditData({...editData, date: e.target.value})} className="form-input text-xs py-1.5 px-2" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-stone-500 font-medium">提出者</label>
                          <input type="text" value={editData.submitter || ''} onChange={e => setEditData({...editData, submitter: e.target.value})} className="form-input text-xs py-1.5 px-2" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-stone-500 font-medium">事業区分</label>
                          <input type="text" value={editData.category || ''} onChange={e => setEditData({...editData, category: e.target.value})} className="form-input text-xs py-1.5 px-2" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-stone-500 font-medium">金額</label>
                          <input type="number" value={editData.amount || 0} onChange={e => setEditData({...editData, amount: Number(e.target.value)})} className="form-input text-xs py-1.5 px-2" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-stone-500 font-medium">数量</label>
                          <input type="text" value={editData.quantity || ''} onChange={e => setEditData({...editData, quantity: e.target.value})} className="form-input text-xs py-1.5 px-2" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-stone-500 font-medium">支払先</label>
                          <input type="text" value={editData.payee || ''} onChange={e => setEditData({...editData, payee: e.target.value})} className="form-input text-xs py-1.5 px-2" />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1">
                          <label className="text-stone-500 font-medium">但し書き・説明</label>
                          <input type="text" value={editData.description || ''} onChange={e => setEditData({...editData, description: e.target.value})} className="form-input text-xs py-1.5 px-2" />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1">
                          <label className="text-stone-500 font-medium">備考</label>
                          <input type="text" value={editData.note || ''} onChange={e => setEditData({...editData, note: e.target.value})} className="form-input text-xs py-1.5 px-2" />
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div key={item.id} onClick={() => toggleId(item.id)}
                    className={`card px-4 py-3 flex items-center gap-3 cursor-pointer
                      transition-all active:scale-[0.99]
                      ${selectedIds.has(item.id) ? 'ring-2 ring-green-400 bg-green-50/50' : ''}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center
                      transition-colors flex-shrink-0
                      ${selectedIds.has(item.id) ? 'bg-green-600 border-green-600' : 'border-stone-300'}`}>
                      {selectedIds.has(item.id) && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* 1行目: 日付とバッジ */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap
                          ${item.type === '支出' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {item.type}
                        </span>
                        <span className="text-[10px] text-stone-400 whitespace-nowrap">{formatDateStr(item.date)}</span>
                      </div>
                      {/* 2行目: 提出者名 */}
                      <div className="text-sm font-bold text-stone-700 truncate">
                        {item.submitter}
                      </div>
                      {/* 3行目: カテゴリと詳細 */}
                      <div className="text-[11px] text-stone-500 mt-0.5 leading-snug break-words">
                        {item.category}{item.description && ` — ${item.description}`}
                      </div>
                      {item.quantity && (
                        <div className="text-[10px] text-stone-400 mt-0.5">数量: {item.quantity}</div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end justify-between self-stretch flex-shrink-0 ml-2">
                      <div className={`text-sm font-bold amount-display ${item.type === '支出' ? 'text-matsuri-600' : 'text-green-700'}`}>
                        {formatAmount(item.amount)}
                      </div>
                      <div className="flex gap-2 mt-auto pt-2" onClick={e => e.stopPropagation()}>
                        <button onClick={(e) => startEdit(item, e)} className="p-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 active:scale-95 transition-all shadow-sm">✏️</button>
                        <button onClick={(e) => handleDelete(item.id, e)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:scale-95 transition-all shadow-sm">🗑️</button>
                      </div>
                    </div>
                  </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 精算済みタブ ===== */}
      {activeTab === 'settled' && (
        <div className="flex-1 flex flex-col">
          {/* 年度フィルター + アクションバー */}
          <div className="px-5 py-3 flex items-center gap-2 border-b border-stone-100">
            <select
              value={settledYear}
              onChange={(e) => setSettledYear(e.target.value)}
              className="form-input form-select text-xs py-1.5 w-24"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - i;
                return <option key={y} value={y.toString()}>{y}年</option>;
              })}
            </select>
            <button onClick={fetchSettled}
              style={{ fontSize: '0.7rem', color: 'white', padding: '0.35rem 0.75rem', borderRadius: 8, background: 'linear-gradient(135deg, #1E3A5F, #3B72B4)', border: 'none', cursor: 'pointer' }}>
              🔄
            </button>
            <div className="flex-1 text-xs text-stone-400">
              {settledSelectedIds.size > 0 ? `${settledSelectedIds.size}件 選択中` : `${settledItems.length}件`}
            </div>
            {settledSelectedIds.size > 0 && (
              <button onClick={handleRevert}
                disabled={processing}
                className="text-xs font-bold text-white px-3 py-1.5 rounded-lg active:scale-95 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #B08030, #E0A030)' }}>
                ↩ 未精算に戻す
              </button>
            )}
          </div>

          {/* 一覧 */}
          <div className="px-5 flex-1 pb-4">
            {settledLoading && (
              <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
            )}
            {!settledLoading && settledItems.length === 0 && (
              <div className="card p-6 text-center mt-4">
                <p className="text-stone-500 text-sm">{settledYear}年の精算済みデータはありません</p>
              </div>
            )}
            {!settledLoading && settledItems.length > 0 && (
              <div className="flex flex-col gap-2 mt-3">
                {settledItems.map((item) => (
                  settledEditingId === item.id ? (
                    <div key={item.id} className="card px-4 py-4 flex flex-col gap-3 shadow-md bg-stone-50 border border-matsuri-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-stone-700 text-sm">📝 データの編集</span>
                        <div className="flex gap-2 text-xs">
                          <button onClick={cancelSettledEdit} className="px-3 py-1.5 bg-stone-200 text-stone-600 rounded-lg font-bold active:scale-95 transition-all">キャンセル</button>
                          <button onClick={saveSettledEdit} disabled={processing} className="px-3 py-1.5 bg-gradient-to-r from-matsuri-600 to-matsuri-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 active:scale-95 transition-all">保存</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex flex-col gap-1"><label className="text-stone-500 font-medium">日付</label><input type="date" value={settledEditData.date || ''} onChange={e => setSettledEditData({...settledEditData, date: e.target.value})} className="form-input text-xs py-1.5 px-2" /></div>
                        <div className="flex flex-col gap-1"><label className="text-stone-500 font-medium">提出者</label><input type="text" value={settledEditData.submitter || ''} onChange={e => setSettledEditData({...settledEditData, submitter: e.target.value})} className="form-input text-xs py-1.5 px-2" /></div>
                        <div className="flex flex-col gap-1"><label className="text-stone-500 font-medium">事業区分</label><input type="text" value={settledEditData.category || ''} onChange={e => setSettledEditData({...settledEditData, category: e.target.value})} className="form-input text-xs py-1.5 px-2" /></div>
                        <div className="flex flex-col gap-1"><label className="text-stone-500 font-medium">金額</label><input type="number" value={settledEditData.amount || 0} onChange={e => setSettledEditData({...settledEditData, amount: Number(e.target.value)})} className="form-input text-xs py-1.5 px-2" /></div>
                        <div className="flex flex-col gap-1"><label className="text-stone-500 font-medium">数量</label><input type="text" value={settledEditData.quantity || ''} onChange={e => setSettledEditData({...settledEditData, quantity: e.target.value})} className="form-input text-xs py-1.5 px-2" /></div>
                        <div className="flex flex-col gap-1"><label className="text-stone-500 font-medium">支払先</label><input type="text" value={settledEditData.payee || ''} onChange={e => setSettledEditData({...settledEditData, payee: e.target.value})} className="form-input text-xs py-1.5 px-2" /></div>
                        <div className="col-span-2 flex flex-col gap-1"><label className="text-stone-500 font-medium">但し書き</label><input type="text" value={settledEditData.description || ''} onChange={e => setSettledEditData({...settledEditData, description: e.target.value})} className="form-input text-xs py-1.5 px-2" /></div>
                        <div className="col-span-2 flex flex-col gap-1"><label className="text-stone-500 font-medium">備考</label><input type="text" value={settledEditData.note || ''} onChange={e => setSettledEditData({...settledEditData, note: e.target.value})} className="form-input text-xs py-1.5 px-2" /></div>
                      </div>
                    </div>
                  ) : (
                    <div key={item.id}
                      onClick={() => setSettledSelectedIds(prev => { const s = new Set(prev); s.has(item.id) ? s.delete(item.id) : s.add(item.id); return s; })}
                      className={`card px-4 py-3 flex items-center gap-3 cursor-pointer transition-all active:scale-[0.99]
                        ${settledSelectedIds.has(item.id) ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0
                        ${settledSelectedIds.has(item.id) ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
                        {settledSelectedIds.has(item.id) && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap
                            ${item.type === '支出' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{item.type}</span>
                          <span className="text-[10px] text-stone-400 whitespace-nowrap">{formatDateStr(item.date)}</span>
                          {item.settledDate && <span className="text-[10px] text-green-600 whitespace-nowrap">精算:{item.settledDate.substring(0,10)}</span>}
                        </div>
                        <div className="text-sm font-bold text-stone-700 truncate">{item.submitter}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5">{item.category}{item.description && ` — ${item.description}`}</div>
                      </div>
                      <div className="flex flex-col items-end justify-between self-stretch flex-shrink-0 ml-2">
                        <div className={`text-sm font-bold amount-display ${item.type === '支出' ? 'text-matsuri-600' : 'text-green-700'}`}>
                          {formatAmount(item.amount)}
                        </div>
                        <div className="flex gap-2 mt-auto pt-2" onClick={e => e.stopPropagation()}>
                          <button onClick={(e) => startSettledEdit(item, e)} className="p-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 active:scale-95 transition-all shadow-sm">✏️</button>
                          <button onClick={(e) => handleSettledDelete(item.id, e)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:scale-95 transition-all shadow-sm">🗑️</button>
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 会計サマリータブ ===== */}
      {activeTab === 'report' && (
        <div className="flex-1 px-5 py-5">
          {/* 年度選択 */}
          <div className="flex items-center gap-3 mb-5">
            <label className="text-sm font-bold" style={{ color: '#1E3A5F' }}>年度:</label>
            <select
              value={reportYear}
              onChange={(e) => setReportYear(e.target.value)}
              className="form-input form-select w-32 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - i;
                return <option key={y} value={y.toString()}>{y}年度</option>;
              })}
            </select>
            <button onClick={fetchReport}
              style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', padding: '0.4rem 1rem', borderRadius: 8, background: 'linear-gradient(135deg, #1E3A5F, #3B72B4)', border: 'none', cursor: 'pointer' }}>
              {reportLoading ? '取得中...' : '🔄 更新'}
            </button>
          </div>

          {reportLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {!reportLoading && report && (
            <div className="flex flex-col gap-4">
              {/* 繰越金カード */}
              <div className="card p-4 bg-gradient-to-r from-stone-50 to-white border border-stone-200/60">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-semibold text-stone-400">前年度繰越金</p>
                    <p className="text-lg font-bold text-stone-800 amount-display">{formatAmount(report.carryoverBalance)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-stone-400">次年度繰越金</p>
                    <p className={`text-lg font-bold amount-display ${report.nextCarryover >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatAmount(report.nextCarryover)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 収支バー */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4 border-l-4 border-green-500">
                  <p className="text-[11px] font-semibold text-stone-400">収入合計</p>
                  <p className="text-lg font-bold text-green-700 amount-display">{formatAmount(report.incomeTotal)}</p>
                </div>
                <div className="card p-4 border-l-4 border-matsuri-500">
                  <p className="text-[11px] font-semibold text-stone-400">支出合計</p>
                  <p className="text-lg font-bold text-matsuri-600 amount-display">{formatAmount(report.expenseTotal)}</p>
                </div>
              </div>

              {/* 収入内訳 */}
              {Object.keys(report.incomeByCategory).length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-bold text-stone-600 mb-3 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span> 収入内訳
                  </h3>
                  <div className="flex flex-col gap-2">
                    {Object.entries(report.incomeByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amt]) => (
                        <div key={cat} className="flex items-center justify-between">
                          <span className="text-sm text-stone-600">{cat}</span>
                          <span className="text-sm font-bold text-green-700 amount-display">{formatAmount(amt)}</span>
                        </div>
                      ))}
                  </div>
                  <AccountingCharts data={report.incomeByCategory} colors={['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d']} />
                </div>
              )}

              {/* 支出内訳 */}
              {Object.keys(report.expenseByCategory).length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-bold text-stone-600 mb-3 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-matsuri-500"></span> 支出内訳
                  </h3>
                  <div className="flex flex-col gap-3">
                    {Object.entries(report.expenseByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amt]) => {
                        const budget = masters?.expenseBudgets?.[cat];
                        const ratio = budget ? Math.min(Math.round((amt / budget) * 100), 100) : 0;
                        return (
                          <div key={cat} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-stone-600">{cat}</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-matsuri-600 amount-display">{formatAmount(amt)}</span>
                                {budget && (
                                  <span className="text-[10px] text-stone-400 font-medium ml-1">/ {formatAmount(budget)}</span>
                                )}
                              </div>
                            </div>
                            {budget && (
                              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-0.5">
                                <div 
                                  className={`h-full rounded-full transition-all ${ratio >= 90 ? 'bg-red-500' : 'bg-matsuri-400'}`} 
                                  style={{ width: `${ratio}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  <AccountingCharts data={report.expenseByCategory} colors={['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d']} />
                </div>
              )}

              {/* データなし */}
              {Object.keys(report.incomeByCategory).length === 0 &&
               Object.keys(report.expenseByCategory).length === 0 && (
                <div className="card p-6 text-center">
                  <p className="text-stone-500 text-sm">{reportYear}年度のデータはまだありません</p>
                </div>
              )}
            </div>
          )}

          {/* スプレッドシートリンクと報告書エクスポート */}
          <div className="px-5 pb-5 flex flex-col gap-3 mt-4">
            <button
              onClick={handleGenerateSheet}
              disabled={processing}
              className="w-full py-3 bg-stone-800 text-white font-bold rounded-xl active:scale-95 transition-all text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processing ? '生成中...' : '📄 会計報告書を生成 (PDF)'}
            </button>
            <button
              onClick={() => window.open(SPREADSHEET_URL, '_blank')}
              className="w-full py-3 text-sm font-bold text-matsuri-700 bg-matsuri-50 border-2 border-matsuri-100 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              📊 スプレッドシートを開く
            </button>
          </div>
        </div>
      )}

      {/* ===== マスター管理タブ ===== */}
      {activeTab === 'masters' && (
        <div className="flex-1 px-5 py-5">
          <MasterManager adminKey={adminKey} />
        </div>
      )}

      {/* トースト */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
