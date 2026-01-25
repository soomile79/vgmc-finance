
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { OfferingRecord, OfferingType, BudgetRecord } from '../types';

const Dashboard: React.FC = () => {
  const [records, setRecords] = useState<OfferingRecord[]>([]);
  const [offeringTypes, setOfferingTypes] = useState<OfferingType[]>([]);
  const [currentYearStats, setCurrentYearStats] = useState<{month: string, total: number}[]>([]);
  const [lastYearStats, setLastYearStats] = useState<{month: string, total: number}[]>([]);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [hoveredSlice, setHoveredSlice] = useState<any>(null);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, types, currStats, lastStats, annualBudgets] = await Promise.all([
        storageService.getRecords(),
        storageService.getOfferingTypes(),
        storageService.getMonthlyStatsFromView(selectedYear),
        storageService.getMonthlyStatsFromView(String(parseInt(selectedYear) - 1)),
        storageService.getBudgets(selectedYear)
      ]);
      setRecords(recs);
      setOfferingTypes(types);
      setCurrentYearStats(currStats);
      setLastYearStats(lastStats);
      setBudgets(annualBudgets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const analytics = useMemo(() => {
    const m = selectedMonth;
    const pm = m === '1' ? '12' : String(parseInt(m) - 1);
    
    const currentMonthTotal = currentYearStats.find(s => s.month === m)?.total || 0;
    const prevMonthTotal = m === '1' 
      ? (lastYearStats.find(s => s.month === '12')?.total || 0)
      : (currentYearStats.find(s => s.month === pm)?.total || 0);
    const lastYearMonthTotal = lastYearStats.find(s => s.month === m)?.total || 0;

    const momDiff = currentMonthTotal - prevMonthTotal;
    const yoyDiff = currentMonthTotal - lastYearMonthTotal;
    const momVar = prevMonthTotal > 0 ? (momDiff / prevMonthTotal) * 100 : 0;
    const yoyVar = lastYearMonthTotal > 0 ? (yoyDiff / lastYearMonthTotal) * 100 : 0;

    const currentYm = `${selectedYear}-${m.padStart(2, '0')}`;
    const monthRecords = records.filter(r => r.date?.startsWith(currentYm));
    
    const itemsMap: Record<string, { total: number, count: number, label: string }> = {};
    monthRecords.forEach(r => {
      if (!itemsMap[r.code]) itemsMap[r.code] = { total: 0, count: 0, label: r.offeringName || r.code };
      itemsMap[r.code].total += r.amount;
      itemsMap[r.code].count += 1;
    });

    const sortedItems = Object.entries(itemsMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([code, data]) => ({ code, ...data }));

    // 카테고리별 예산 달성률 계산 (YTD)
    const categoryStats: Record<string, { budget: number, actual: number }> = {};
    
    // 1. 모든 항목에 대해 카테고리 초기화
    offeringTypes.forEach(t => {
      const cat = t.category || '기타';
      if (!categoryStats[cat]) categoryStats[cat] = { budget: 0, actual: 0 };
    });

    // 2. 예산 합산
    budgets.forEach(b => {
      const type = offeringTypes.find(t => t.code === b.code);
      const cat = type?.category || '기타';
      if (!categoryStats[cat]) categoryStats[cat] = { budget: 0, actual: 0 };
      categoryStats[cat].budget += b.amount;
    });

    // 3. 실적 합산 (올해 누적)
    records.filter(r => r.date?.startsWith(selectedYear)).forEach(r => {
      const type = offeringTypes.find(t => t.code === r.code);
      const cat = type?.category || '기타';
      if (categoryStats[cat]) {
        categoryStats[cat].actual += r.amount;
      }
    });

    const budgetProgress = Object.entries(categoryStats)
      .map(([cat, data]) => ({
        label: cat,
        budget: data.budget,
        actual: data.actual,
        percent: data.budget > 0 ? (data.actual / data.budget) * 100 : 0
      }))
      .filter(item => item.budget > 0 || item.actual > 0)
      .sort((a, b) => b.actual - a.actual);

    return { 
        currentMonthTotal, prevMonthTotal, lastYearMonthTotal, 
        momVar, yoyVar, momDiff, yoyDiff,
        items: sortedItems, count: monthRecords.length,
        budgetProgress 
    };
  }, [currentYearStats, lastYearStats, records, selectedYear, selectedMonth, budgets, offeringTypes]);

  // Donut Chart Drawing Logic
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

  if (loading) return <div className="p-20 text-center font-black text-slate-300 animate-pulse">데이터를 심층 분석 중입니다...</div>;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Performance Analysis</h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-base">{selectedYear}년 {selectedMonth}월 성과 보고</p>
        </div>
        <div className="flex gap-3">
          <select className="px-4 py-2 rounded-xl font-black text-slate-900 border-2 border-slate-100 bg-white shadow-sm outline-none focus:border-blue-500" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            <option value="2026">2026년</option>
            <option value="2025">2025년</option>
          </select>
          <select className="px-4 py-2 rounded-xl font-black text-slate-900 border-2 border-slate-100 bg-white shadow-sm outline-none focus:border-blue-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {Array.from({length: 12}, (_, i) => (i + 1).toString()).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm">
          <p className="text-base font-black text-slate-400 uppercase tracking-widest mb-2">당월 총 수입</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter">${analytics.currentMonthTotal.toLocaleString()}</p>
          <p className="text-sm font-bold text-blue-500 mt-2">총 {analytics.count}건의 거래 분석됨</p>
        </div>
        <div className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm">
          <p className="text-base font-black text-slate-400 uppercase tracking-widest mb-2">전월 대비 (MoM)</p>
          <div className="flex items-end gap-3">
            <p className={`text-4xl font-black tracking-tighter ${analytics.momVar >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {analytics.momVar >= 0 ? '▲' : '▼'} {Math.abs(analytics.momVar).toFixed(1)}%
            </p>
            <span className={`text-sm font-bold mb-1 ${analytics.momDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ({analytics.momDiff >= 0 ? '+' : ''}${analytics.momDiff.toLocaleString()})
            </span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[48px] shadow-2xl relative overflow-hidden group">
          <p className="text-base font-black text-slate-500 uppercase tracking-widest mb-2">작년 동월 대비 (YoY)</p>
          <div className="flex items-end gap-3">
            <p className={`text-4xl font-black tracking-tighter ${analytics.yoyVar >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                {analytics.yoyVar >= 0 ? '▲' : '▼'} {Math.abs(analytics.yoyVar).toFixed(1)}%
            </p>
            <span className={`text-sm font-bold mb-1 ${analytics.yoyDiff >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                ({analytics.yoyDiff >= 0 ? '+' : ''}${analytics.yoyDiff.toLocaleString()})
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 bg-white p-12 rounded-[64px] border border-slate-100 shadow-sm flex flex-col items-center">
           <div className="w-full flex justify-between items-center mb-12">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">수입 내역 (%)</h3>
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">마우스 오버시 상세 금액 확인</span>
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
                    <path
                      key={i}
                      d={pathData}
                      fill={colors[i % colors.length]}
                      className="cursor-pointer transition-all hover:opacity-80"
                      onMouseEnter={() => setHoveredSlice(slice)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  );
                })}
                <circle r="0.75" fill="white" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 {hoveredSlice ? (
                   <div className="text-center animate-in fade-in zoom-in duration-200">
                      <p className="text-base font-black text-slate-400 uppercase tracking-widest mb-1">{hoveredSlice.label}</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">${hoveredSlice.total.toLocaleString()}</p>
                      <p className="text-sm font-bold text-blue-600">{hoveredSlice.percent.toFixed(1)}%</p>
                   </div>
                 ) : (
                   <div className="text-center">
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">${analytics.currentMonthTotal.toLocaleString()}</p>
                      <p className="text-sm font-bold text-slate-400">{selectedMonth}월 수입 비중</p>
                   </div>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 w-full">
              {donutSlices.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'][i % 7] }}></div>
                   <span className="text-base font-black text-slate-600 truncate">{s.label} ({s.percent.toFixed(0)}%)</span>
                </div>
              ))}
           </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
           <div className="bg-slate-50 p-10 rounded-[56px] border border-slate-100 flex-1">
              <h3 className="text-base font-black text-slate-400 uppercase tracking-widest mb-8">카테고리 별 예산 성과 (YTD)</h3>
              <div className="space-y-8">
                 {analytics.budgetProgress.length > 0 ? analytics.budgetProgress.map((item, idx) => (
                   <div key={idx} className="space-y-2">
                      <div className="flex justify-between items-end">
                         <div>
                            <p className="text-base font-black text-slate-800 uppercase tracking-tight">{item.label}</p>
                            <p className="text-sm font-bold text-slate-400">예산: ${item.budget.toLocaleString()}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-base font-black text-slate-900">${item.actual.toLocaleString()}</p>
                            <p className={`text-sm font-black uppercase ${item.percent >= 100 ? 'text-emerald-500' : 'text-blue-500'}`}>{item.percent.toFixed(1)}% 달성</p>
                         </div>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                         <div className={`h-full transition-all duration-1000 ${item.percent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(item.percent, 100)}%` }}></div>
                      </div>
                   </div>
                 )) : (
                   <div className="text-center py-20">
                      <i className="fa-solid fa-file-invoice-dollar text-4xl text-slate-200 mb-4"></i>
                      <p className="text-slate-300 font-bold italic">분류별 예산 설정이 필요합니다.</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
