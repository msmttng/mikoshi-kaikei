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
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                paddingTop: '0.6rem',
                paddingBottom: '0.6rem',
                color: isActive ? '#1E3A5F' : '#94A3B8',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.15s',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '1.25rem', transform: isActive ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.15s' }}>
                {item.icon}
              </span>
              <span style={{ fontSize: '0.62rem', fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
              {isActive && (
                <div style={{ position: 'absolute', bottom: 2, width: 28, height: 2.5, borderRadius: 4, background: '#3B72B4' }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
