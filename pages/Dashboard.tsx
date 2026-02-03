import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { OfferingRecord, OfferingType, BudgetRecord } from '../types';

const Dashboard: React.FC = () => {
  const [yearRecords, setYearRecords] = useState<OfferingRecord[]>([]);
  const [offeringTypes, setOfferingTypes] = useState<OfferingType[]>([]);
  const [currentYearStats, setCurrentYearStats] = useState<{month: string, total: number}[]>([]);
  const [lastYearStats, setLastYearStats] = useState<{month: string, total: number}[]>([]);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [hoveredSlice, setHoveredSlice] = useState<any>(null);

  // 1. 초기 로드: 연도 목록 가져오기
  useEffect(() => {
    const init = async () => {
      const years = await storageService.getYearRange();
      setAvailableYears(years);
      if (years.length > 0) setSelectedYear(years[0]);
    };
    init();
  }, []);

  // 2. 데이터 로드 (연도 변경 시 실행)
  const loadYearlyData = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    try {
      const lastYear = (parseInt(selectedYear) - 1).toString();
      const [recs, types, currStats, lastStats, annualBudgets] = await Promise.all([
        storageService.getRecords(selectedYear),
        storageService.getOfferingTypes(),
        storageService.getMonthlyStatsFromView(selectedYear),
        storageService.getMonthlyStatsFromView(lastYear),
        storageService.getBudgets(selectedYear)
      ]);
      setYearRecords(recs);
      setOfferingTypes(types);
      setCurrentYearStats(currStats);
      setLastYearStats(lastStats);
      setBudgets(annualBudgets);
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadYearlyData();
  }, [loadYearlyData]);

  // 3. 분석 로직
  const analytics = useMemo(() => {
    const m = selectedMonth.padStart(2, '0');
    const currentMonthTotal = currentYearStats.find(s => s.month === m)?.total || 0;
    
    const prevMonthStr = m === '01' ? '12' : (parseInt(m) - 1).toString().padStart(2, '0');
    const prevMonthTotal = m === '01' 
      ? (lastYearStats.find(s => s.month === '12')?.total || 0)
      : (currentYearStats.find(s => s.month === prevMonthStr)?.total || 0);
    
    const lastYearMonthTotal = lastYearStats.find(s => s.month === m)?.total || 0;

    const momDiff = currentMonthTotal - prevMonthTotal;
    const yoyDiff = currentMonthTotal - lastYearMonthTotal;
    const momVar = prevMonthTotal > 0 ? (momDiff / prevMonthTotal) * 100 : 0;
    const yoyVar = lastYearMonthTotal > 0 ? (yoyDiff / lastYearMonthTotal) * 100 : 0;

    const currentYm = `${selectedYear}-${m}`;
    const monthRecords = yearRecords.filter(r => r.date?.startsWith(currentYm));
    
    const itemsMap: Record<string, { total: number, label: string }> = {};
    monthRecords.forEach(r => {
      const code = r.code || 'UNKNOWN';
      if (!itemsMap[code]) itemsMap[code] = { total: 0, label: r.offeringName || code };
      itemsMap[code].total += r.amount;
    });

    const sortedItems = Object.entries(itemsMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([code, data]) => ({ code, ...data }));

    const categoryStats: Record<string, { budget: number, actual: number }> = {};
    offeringTypes.forEach(t => { if (t.category) categoryStats[t.category] = { budget: 0, actual: 0 }; });
    budgets.forEach(b => {
      const type = offeringTypes.find(t => t.code === b.code);
      const cat = type?.category || '기타';
      if (!categoryStats[cat]) categoryStats[cat] = { budget: 0, actual: 0 };
      categoryStats[cat].budget += b.amount;
    });
    yearRecords.forEach(r => {
      const type = offeringTypes.find(t => t.code === r.code);
      const cat = type?.category || '기타';
      if (categoryStats[cat]) categoryStats[cat].actual += r.amount;
    });

    const budgetProgress = Object.entries(categoryStats)
      .map(([cat, data]) => ({
        label: cat, budget: data.budget, actual: data.actual,
        percent: data.budget > 0 ? (data.actual / data.budget) * 100 : 0
      }))
      .filter(item => item.budget > 0 || item.actual > 0)
      .sort((a, b) => b.actual - a.actual);

    return { currentMonthTotal, momVar, yoyVar, momDiff, yoyDiff, items: sortedItems, count: monthRecords.length, budgetProgress };
  }, [currentYearStats, lastYearStats, yearRecords, selectedYear, selectedMonth, budgets, offeringTypes]);

  const donutSlices = useMemo(() => {
    let cumulativePercent = 0;
    return analytics.items.map((item) => {
      const percent = (item.total / (analytics.currentMonthTotal || 1)) * 100;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;
      return { ...item, percent, startPercent };
    });
  }, [analytics]);

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  if (loading && !selectedYear) return <div className="p-20 text-center font-black text-slate-300 animate-pulse text-xl">데이터 분석 시스템 가동 중...</div>;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      {/* 상단 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Dashboard</h2>
          <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-base">{selectedYear}년 {selectedMonth}월 경영 리포트</p>
        </div>
        <div className="flex gap-4">
          <select className="px-5 py-3 rounded-2xl font-black text-slate-900 border-2 border-slate-100 bg-white shadow-sm outline-none focus:border-blue-500 text-lg" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select className="px-5 py-3 rounded-2xl font-black text-slate-900 border-2 border-slate-100 bg-white shadow-sm outline-none focus:border-blue-500 text-lg" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">당월 총 수입</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">${analytics.currentMonthTotal.toLocaleString()}</p>
          <p className="text-base font-bold text-blue-500 mt-3">총 {analytics.count}건 집계됨</p>
        </div>
        <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">전월 대비 (MoM)</p>
          <div className="flex items-baseline gap-3">
            <p className={`text-3xl font-black ${analytics.momVar >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {analytics.momVar >= 0 ? '▲' : '▼'} {Math.abs(analytics.momVar).toFixed(1)}%
            </p>
            <span className="text-lg font-bold text-slate-400">(${Math.abs(analytics.momDiff).toLocaleString()})</span>
          </div>
        </div>
        <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">작년 동월 대비 (YoY)</p>
          <div className="flex items-baseline gap-3">
            <p className={`text-3xl font-black ${analytics.yoyVar >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                {analytics.yoyVar >= 0 ? '▲' : '▼'} {Math.abs(analytics.yoyVar).toFixed(1)}%
            </p>
            <span className="text-lg font-bold text-slate-400">(${Math.abs(analytics.yoyDiff).toLocaleString()})</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center font-black text-slate-200 animate-pulse text-2xl">상세 분석 데이터를 불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* 도넛 차트 섹션 */}
          <div className="lg:col-span-7 bg-white p-12 rounded-[64px] border border-slate-100 shadow-sm flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-12">
               <h3 className="text-xl font-black text-slate-800 tracking-tight">수입 항목별 비중</h3>
               <span className="text-sm font-bold text-slate-400 uppercase bg-slate-50 px-4 py-2 rounded-full">상세 퍼센트 분석</span>
            </div>
            
            <div className="relative w-80 h-80">
                <svg viewBox="-1 -1 2 2" className="w-full h-full -rotate-90 transform">
                  {donutSlices.map((slice, i) => {
                    const [startX, startY] = getCoordinatesForPercent(slice.startPercent / 100);
                    const [endX, endY] = getCoordinatesForPercent((slice.startPercent + slice.percent) / 100);
                    const largeArcFlag = slice.percent > 50 ? 1 : 0;
                    const pathData = `M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];
                    return (
                      <path key={i} d={pathData} fill={colors[i % colors.length]} className="cursor-pointer transition-all hover:scale-[1.02] hover:opacity-90"
                        onMouseEnter={() => setHoveredSlice(slice)} onMouseLeave={() => setHoveredSlice(null)} />
                    );
                  })}
                  <circle r="0.75" fill="white" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {hoveredSlice ? (
                    <div className="text-center animate-in fade-in zoom-in duration-300">
                      <p className="text-lg font-black text-slate-400 uppercase mb-1 truncate max-w-[150px]">{hoveredSlice.label}</p>
                      <p className="text-4xl font-black text-slate-900 tracking-tighter">${hoveredSlice.total.toLocaleString()}</p>
                      <p className="text-2xl font-black text-blue-600 mt-1">{hoveredSlice.percent.toFixed(1)}%</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-400 uppercase mb-1">Total</p>
                      <p className="text-4xl font-black text-slate-900 tracking-tighter">${analytics.currentMonthTotal.toLocaleString()}</p>
                      <p className="text-sm font-bold text-slate-400 mt-1">{selectedMonth}월 수입 분포</p>
                    </div>
                  )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-10 gap-y-4 mt-16 w-full">
                {donutSlices.slice(0, 10).map((s, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'][i % 7] }}></div>
                      <span className="text-lg font-bold text-slate-700 truncate max-w-[160px]">{s.label}</span>
                    </div>
                    <span className="text-lg font-black text-slate-900">{s.percent.toFixed(1)}%</span>
                  </div>
                ))}
            </div>
          </div>

          {/* 예산 성과 섹션 */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-slate-50 p-12 rounded-[30px] border border-slate-100 h-full">
              <h3 className="text-base font-black text-slate-400 uppercase tracking-widest mb-5">카테고리 예산 성과 (YTD)</h3>
              <div className="space-y-2">
                  {analytics.budgetProgress.map((item, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100 transition-all hover:scale-[1.01]">
                      <div className="flex justify-between items-end mb-2">
                          <div>
                            <p className="text-base font-black text-slate-800">{item.label}</p>
                            <p className="text-sm font-bold text-slate-400 mt-1">예산: ${item.budget.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-black text-slate-900">${item.actual.toLocaleString()}</p>
                            <p className={`text-sm font-black mt-1 ${item.percent >= 100 ? 'text-emerald-500' : 'text-blue-500'}`}>{item.percent.toFixed(1)}% 달성</p>
                          </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${item.percent >= 100 ? 'bg-emerald-400' : 'bg-blue-600'}`} style={{ width: `${Math.min(item.percent, 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                  {analytics.budgetProgress.length === 0 && (
                    <div className="text-center py-20 text-slate-300 font-bold italic text-lg">설정된 예산 데이터가 없습니다.</div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
