// ===================================
// アプリのルーティング定義
// ===================================
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { SubmitExpense } from './pages/SubmitExpense';
import { SubmitIncome } from './pages/SubmitIncome';
import { History } from './pages/History';
import { Admin } from './pages/Admin';
import { BottomNav } from './components/BottomNav';
import { IosInstallPrompt } from './components/IosInstallPrompt';

// GitHub Pages は SPA のパスルーティングに対応しないため
// HashRouter を使用（例: /#/expense）
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/expense" element={<SubmitExpense />} />
        <Route path="/income" element={<SubmitIncome />} />
        <Route path="/history" element={<History />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <BottomNav />
      <IosInstallPrompt />
    </HashRouter>
  );
}

export default App;
