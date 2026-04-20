const fs = require('fs');
const file = 'C:\\\\Users\\\\masam\\\\.gemini\\\\antigravity\\\\scratch\\\\mikoshi-kaikei\\\\web\\\\src\\\\pages\\\\Admin.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
  "import { getUnsettled, markSettled, getReport } from '../lib/api';",
  "import { getUnsettled, markSettled, getReport, deleteEntry, updateEntry } from '../lib/api';"
);

// 2. States
const stateAnchor = "  const [processing, setProcessing] = useState(false);";
const stateAdd = `
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<LedgerEntry>>({});
`;
content = content.replace(stateAnchor, stateAnchor + "\n" + stateAdd);

// 3. Handlers
const handlerAnchor = "  // 精算済処理";
const handlersAdd = `  // 削除処理
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
`;
content = content.replace(handlerAnchor, handlersAdd + "\n" + handlerAnchor);

// 4. Render item
const itemAnchor = `                {items.map((item) => (
                  <div key={item.id} onClick={() => toggleId(item.id)}`;

const renderItem = `                {items.map((item) => (
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
                  <div key={item.id} onClick={() => toggleId(item.id)}`;

const findBlock = `                    <div className={\`text-sm font-bold amount-display flex-shrink-0
                      \${item.type === '支出' ? 'text-matsuri-600' : 'text-green-700'}\`}>
                      {formatAmount(item.amount)}
                    </div>
                  </div>`;

const replaceBlock = `                    <div className="flex flex-col items-end gap-2 ml-2 flex-shrink-0">
                      <div className={\`text-sm font-bold amount-display \${item.type === '支出' ? 'text-matsuri-600' : 'text-green-700'}\`}>
                        {formatAmount(item.amount)}
                      </div>
                      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                        <button onClick={(e) => startEdit(item, e)} className="p-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 active:scale-95 transition-all shadow-sm">✏️</button>
                        <button onClick={(e) => handleDelete(item.id, e)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:scale-95 transition-all shadow-sm">🗑️</button>
                      </div>
                    </div>
                  </div>
                  )`;

content = content.replace(itemAnchor, renderItem);
content = content.replace(findBlock, replaceBlock);

fs.writeFileSync(file, content, 'utf8');
console.log('Admin.tsx updated successfully.');
