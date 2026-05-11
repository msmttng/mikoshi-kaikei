// ===================================
// アプリのルーティング定義
// ===================================
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { SubmitExpense } from './pages/SubmitExpense';
import { SubmitIncome } from './pages/SubmitIncome';
import { History } from './pages/History';
import { Admin } from './pages/Admin';
import { BottomNav } from './components/BottomNav';
import { IosInstallPrompt } from './components/IosInstallPrompt';

// GitHub Pages 用のルーティング (History API 利用)
function App() {
  return (
    <BrowserRouter basename="/mikoshi-kaikei">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/expense" element={<SubmitExpense />} />
        <Route path="/income" element={<SubmitIncome />} />
        <Route path="/history" element={<History />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <BottomNav />
      <IosInstallPrompt />
    </BrowserRouter>
  );
}

export default App;
