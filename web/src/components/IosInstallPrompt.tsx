// ===================================
// iOS ホーム画面追加案内モーダル
// ===================================
// 初回アクセス時に iOS Safari ユーザーに PWA インストール手順を案内

import { useState, useEffect } from 'react';

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 条件: iOS Safari + スタンドアロンでない + 未表示
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = ('standalone' in window.navigator) && (window.navigator as unknown as { standalone: boolean }).standalone;
    const hasDismissed = localStorage.getItem('mikoshi_ios_prompt_dismissed');

    if (isIos && !isStandalone && !hasDismissed) {
      // 2秒後に表示（初回ロード後）
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('mikoshi_ios_prompt_dismissed', '1');
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end justify-center"
      onClick={dismiss}>
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl px-6 pt-6 pb-10 
          animate-[toastSlideIn_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <div className="flex justify-end mb-2">
          <button
            onClick={dismiss}
            className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center 
              text-stone-500 text-sm active:bg-stone-200"
          >
            ✕
          </button>
        </div>

        {/* アイコン */}
        <div className="text-center mb-4">
          <span className="text-5xl">⛩️</span>
        </div>

        {/* テキスト */}
        <h3 className="text-lg font-bold text-center text-stone-800 mb-2">
          ホーム画面に追加
        </h3>
        <p className="text-sm text-stone-600 text-center mb-6 leading-relaxed">
          このアプリをホーム画面に追加すると、<br />
          アプリのように素早くアクセスできます。
        </p>

        {/* 手順 */}
        <div className="space-y-4 mb-6">
          <Step num={1}>
            画面下部の <ShareIcon /> <strong>共有ボタン</strong> をタップ
          </Step>
          <Step num={2}>
            メニューから <strong>「ホーム画面に追加」</strong> を選択
          </Step>
          <Step num={3}>
            右上の <strong>「追加」</strong> をタップして完了！
          </Step>
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={dismiss}
          className="w-full py-3 rounded-xl bg-matsuri-600 text-white font-bold text-sm
            active:bg-matsuri-700 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// 手順ステップコンポーネント
function Step({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-matsuri-50 text-matsuri-700 
        flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
        {num}
      </div>
      <p className="text-sm text-stone-700 leading-relaxed">{children}</p>
    </div>
  );
}

// iOS 共有アイコン（SVG）
function ShareIcon() {
  return (
    <svg
      className="inline-block w-5 h-5 text-blue-500 mx-0.5 -mt-0.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16,6 12,2 8,6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
