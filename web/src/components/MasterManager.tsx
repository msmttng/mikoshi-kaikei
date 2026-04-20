import { useState, useEffect } from 'react';
import { getMasters, updateMasterList, updateCarryoverBalance } from '../lib/api';
import type { MasterData } from '../lib/types';
import { Spinner } from './Spinner';
import { Toast } from './Toast';

interface Props {
  adminKey: string;
}

type TabType = 'submitters' | 'descriptions' | 'payees' | 'carryover';

const TAB_CONFIG = {
  submitters: { label: '提出者', sectionName: '提出者リスト' },
  descriptions: { label: '但し書き', sectionName: '但し書きリスト' },
  payees: { label: '支払先', sectionName: '支払先リスト' },
  carryover: { label: '前年度繰越金', sectionName: '前年度繰越金' },
};

export function MasterManager({ adminKey }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('submitters');
  const [masters, setMasters] = useState<MasterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // 編集用のローカルステート
  const [localItems, setLocalItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [carryoverValue, setCarryoverValue] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchMasters = async () => {
    setLoading(true);
    try {
      const data = await getMasters();
      setMasters(data);
    } catch (err) {
      setToast({ message: 'マスターデータの取得に失敗しました', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  // タブ切り替えやマスターデータ更新時にローカルのリストをリセット
  useEffect(() => {
    if (!masters) return;
    if (activeTab === 'submitters') setLocalItems([...(masters.submitters || [])]);
    if (activeTab === 'descriptions') setLocalItems([...(masters.descriptions || [])]);
    if (activeTab === 'payees') setLocalItems([...(masters.payees || [])]);
    if (activeTab === 'carryover') setCarryoverValue(String(masters.carryoverBalance || 0));
  }, [activeTab, masters]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (localItems.includes(trimmed)) {
      setToast({ message: 'すでに存在しています', type: 'error' });
      return;
    }
    setLocalItems([...localItems, trimmed]);
    setNewItem('');
  };

  const handleRemove = (indexToRemove: number) => {
    setLocalItems(localItems.filter((_, i) => i !== indexToRemove));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...localItems];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;
    setLocalItems(newItems);
  };

  const moveDown = (index: number) => {
    if (index === localItems.length - 1) return;
    const newItems = [...localItems];
    const temp = newItems[index + 1];
    newItems[index + 1] = newItems[index];
    newItems[index] = temp;
    setLocalItems(newItems);
  };

  const handleSave = async () => {
    setProcessing(true);
    try {
      if (activeTab === 'carryover') {
        const balance = parseInt(carryoverValue.replace(/[^\d]/g, ''), 10) || 0;
        await updateCarryoverBalance(balance, adminKey);
        setToast({ message: '前年度繰越金を更新しました', type: 'success' });
      } else {
        const sectionName = TAB_CONFIG[activeTab].sectionName;
        await updateMasterList(sectionName, localItems, adminKey);
        setToast({ message: `${TAB_CONFIG[activeTab].label}リストを更新しました`, type: 'success' });
      }
      await fetchMasters();
    } catch (err) {
      setToast({ message: '更新に失敗しました', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading && !masters) {
    return <div className="py-12 flex justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* サブタブ */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {(Object.keys(TAB_CONFIG) as TabType[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm
              ${activeTab === key ? 'bg-matsuri-600 text-white' : 'bg-stone-200 text-stone-600'}`}
          >
            {TAB_CONFIG[key].label}
          </button>
        ))}
      </div>

      <div className="card p-4 bg-stone-50 border border-stone-200 shadow-sm">
        <h2 className="text-sm font-bold text-stone-700 mb-4">{TAB_CONFIG[activeTab].label}マスターの編集</h2>
        
        {activeTab === 'carryover' ? (
          <div className="py-2 mb-2">
            <label className="block text-sm font-bold text-stone-600 mb-2">前年度からの繰越残高</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">¥</span>
              <input
                type="text"
                inputMode="numeric"
                value={carryoverValue ? Number(carryoverValue.replace(/[^\d]/g, '')).toLocaleString() : ''}
                onChange={(e) => setCarryoverValue(e.target.value.replace(/[^\d]/g, ''))}
                className="form-input pl-9 text-lg font-bold"
                placeholder="0"
              />
            </div>
          </div>
        ) : (
          <>
            {/* 追加フォーム */}
            <form onSubmit={handleAdd} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder={`新しい${TAB_CONFIG[activeTab].label}を入力`}
                className="form-input flex-1 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!newItem.trim()}
                className="px-4 py-2 bg-stone-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 active:scale-95 transition-all"
              >
                追加
              </button>
            </form>

            {/* リスト表示 */}
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          {localItems.length === 0 ? (
            <p className="text-xs text-stone-400 py-2 text-center">項目がありません</p>
          ) : (
            localItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-stone-100 shadow-sm">
                <span className="text-sm font-medium text-stone-700">{item}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    className="w-7 h-7 flex items-center justify-center bg-stone-100 text-stone-500 rounded-lg hover:bg-stone-200 active:scale-90 transition-all font-bold text-[10px] disabled:opacity-30 disabled:scale-100"
                    aria-label="上へ"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveDown(i)}
                    disabled={i === localItems.length - 1}
                    className="w-7 h-7 flex items-center justify-center bg-stone-100 text-stone-500 rounded-lg hover:bg-stone-200 active:scale-90 transition-all font-bold text-[10px] disabled:opacity-30 disabled:scale-100"
                    aria-label="下へ"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => handleRemove(i)}
                    className="w-7 h-7 ml-1 flex items-center justify-center bg-red-50 text-red-600 rounded-full hover:bg-red-100 active:scale-90 transition-all font-bold text-xs"
                    aria-label="削除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        </>
        )}

        {/* 保存アクション */}
        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-stone-200">
          <button
            onClick={fetchMasters}
            disabled={processing}
            className="px-4 py-2 text-xs font-bold text-stone-600 bg-stone-200 rounded-lg active:scale-95 transition-all"
          >
            リセット
          </button>
          <button
            onClick={handleSave}
            disabled={processing}
            className="px-6 py-2 text-xs font-bold text-white bg-green-600 rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? <Spinner size="sm" /> : '変更を保存'}
          </button>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
