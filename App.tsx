
import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import EntryPage from './pages/EntryPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import DataPage from './pages/DataPage';
import DonorStatsPage from './pages/DonorStatsPage';
import BudgetPage from './pages/BudgetPage';

const Sidebar = () => {
  const location = useLocation();
  const menuItems = [
    { path: '/', label: '월별 분석', icon: 'fa-chart-pie' },
    { path: '/entry', label: '헌금 입력', icon: 'fa-keyboard' },
    { path: '/data', label: '전체 데이터', icon: 'fa-database' },
    { path: '/donor-stats', label: '교인별 통계', icon: 'fa-users' },
    { path: '/budget', label: '예산 관리', icon: 'fa-file-invoice' },
    { path: '/reports', label: '연간 추세/보고서', icon: 'fa-file-invoice-dollar' },
    { path: '/settings', label: '시스템 설정', icon: 'fa-cog' },
  ];

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-800 min-h-screen hidden md:block text-slate-300">
      <div className="p-8">
        <Link to="/">
          <img
            src="/logo_kr.png"
            alt="밴쿠버 지구촌 교회"
            className="w-full h-auto max-h-16 object-contain group-hover:opacity-80 transition-opacity"
          />
        </Link>
        <p className="text-base text-white-500 font-bold uppercase tracking-widest mt-10">헌금 관리 시스템</p>
      </div>
      <nav className="mt-4 px-4 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${
              location.pathname === item.path
                ? 'bg-sky-700 text-white shadow-lg shadow-sky-900/50 font-bold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
};

const MobileNav = () => {
  const location = useLocation();
  const menuItems = [
    { path: '/', label: '분석', icon: 'fa-chart-pie' },
    { path: '/entry', label: '입력', icon: 'fa-keyboard' },
    { path: '/budget', label: '예산', icon: 'fa-file-invoice' },
    { path: '/reports', label: '추세', icon: 'fa-file-invoice-dollar' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-2 flex justify-between items-center z-50">
      {menuItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`flex flex-col items-center gap-1 ${
            location.pathname === item.path ? 'text-sky-700' : 'text-slate-400'
          }`}
        >
          <i className={`fa-solid ${item.icon} text-lg`}></i>
          <span className="text-[10px]">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 pb-20 md:pb-0 overflow-y-auto h-screen">
          <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center px-6 md:px-10 sticky top-0 z-40">
            <div className="flex-1 md:hidden">
                 <h1 className="text-xl font-bold text-blue-600">VGMC</h1>
            </div>
            <div className="flex items-center gap-4 ml-auto">
               <div className="flex items-center gap-2 text-slate-400">
                 <i className="fa-solid fa-circle-user text-xl"></i>
                 <span className="text-sm font-bold text-slate-600">VGMC 재정부</span>
               </div>
            </div>
          </header>
          <div className="p-4 md:p-10 max-w-[1920px] mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/entry" element={<EntryPage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/donor-stats" element={<DonorStatsPage />} />
              <Route path="/budget" element={<BudgetPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Routes>
          </div>
        </main>
        <MobileNav />
      </div>
    </HashRouter>
  );
};

export default App;
