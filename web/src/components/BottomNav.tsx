// ===================================
// ボトムナビゲーションコンポーネント
// ===================================
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: '🏠', label: 'ホーム' },
  { path: '/history', icon: '📋', label: '履歴' },
  { path: '/admin', icon: '⚙️', label: '管理' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // 登録画面ではナビを非表示
  if (location.pathname === '/expense' || location.pathname === '/income') {
    return null;
  }

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-[480px] mx-auto flex">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors
                ${isActive
                  ? 'text-matsuri-700'
                  : 'text-stone-400 hover:text-stone-600'
                }`}
            >
              <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-matsuri-700' : ''}`}>
                {item.label}
              </span>
              {/* アクティブインジケーター */}
              {isActive && (
                <div className="absolute bottom-1 w-8 h-0.5 rounded-full bg-matsuri-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
