// ===================================
// トースト通知コンポーネント
// ===================================
import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onClose, 300); // アニメーション完了後に削除
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // 種別ごとの色設定
  const colors = {
    success: 'bg-gradient-to-r from-green-600 to-green-700',
    error: 'bg-gradient-to-r from-red-600 to-red-700',
    info: 'bg-gradient-to-r from-blue-600 to-blue-700',
  };

  // 種別ごとのアイコン
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-[448px]">
      <div
        className={`${colors[type]} ${exiting ? 'toast-exit' : 'toast-enter'} 
          rounded-2xl px-5 py-4 text-white shadow-lg flex items-center gap-3`}
      >
        <span className="text-xl flex-shrink-0 w-7 h-7 rounded-full bg-white/20 
          flex items-center justify-center text-sm font-bold">
          {icons[type]}
        </span>
        <span className="text-sm font-medium leading-snug">{message}</span>
      </div>
    </div>
  );
}
