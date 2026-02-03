import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { OfferingRecord } from '../types';

const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<'weekly' | 'trend'>('weekly');
  const [records, setRecords] = useState<OfferingRecord[]>([]);
  const [currentYearStats, setCurrentYearStats] = useState<{month: string, total: number}[]>([]);
  const [lastYearStats, setLastYearStats] = useState<{month: string, total: number}[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  const getInitialDate = () => {
    const d = new Date();
    const day = d.getDay(); 
    const diff = d.getDate() - day;
    const lastSunday = new Date(d.setDate(diff));
    return lastSunday.toLocaleDateString('en-CA'); 
  };

  const [selectedDate, setSelectedDate] = useState(getInitialDate());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // 1. 연도 목록 초기화
  useEffect(() => {
    const initYears = async () => {
      const years = await storageService.getYearRange();
      setAvailableYears(years);
      if (years.length > 0) setSelectedYear(years[0]);
    };
    initYears();
  }, []);

  // 2. 데이터 새로고침
  const refreshData = useCallback(async () => {
    try {
      const lastYear = (parseInt(selectedYear) - 1).toString();
      const [recs, curr, last] = await Promise.all([
        storageService.getRecords(selectedYear), // 해당 연도 전체 데이터
        storageService.getMonthlyStatsFromView(selectedYear),
        storageService.getMonthlyStatsFromView(lastYear)
      ]);
      setRecords(recs);
      setCurrentYearStats(curr);
      setLastYearStats(last);
    } catch (err) {
      console.error("Report Data Load Error:", err);
    }
  }, [selectedYear]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Weekly Summary (주간 집계)
  const weeklySummary = useMemo(() => {
    const dayRecords = records.filter(r => r.date === selectedDate);
    const summary: Record<string, any> = {};

    dayRecords.forEach(r => {
      if (!summary[r.code]) {
        summary[r.code] = { total: 0, name: r.offeringName || r.code, rawItems: [] };
      }
      summary[r.code].total += r.amount;
      summary[r.code].rawItems.push({
        num: r.offeringNumber ? parseInt(String(r.offeringNumber)) : null,
        name: r.donorName || '익명',
        note: r.note
      });
    });

    return Object.entries(summary)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, data]: [string, any]) => {
        const sortedItems = data.rawItems
          .sort((a: any, b: any) => {
            if (a.num !== null && b.num !== null) return a.num - b.num;
            if (a.num !== null) return -1;
            if (b.num !== null) return 1;
            return a.name.localeCompare(b.name);
          })
          .map((item: any) => {
            const label = item.num ? `${item.num}` : item.name;
            return item.note ? `${label}(${item.note})` : label;
          });

        return [code, { ...data, items: sortedItems }];
      });
  }, [records, selectedDate]);

  // ⭐ Trend Data (연간 트렌드) - 데이터 매칭 로직 수정
  const trendData = useMemo(() => {
    // DB(storageService)에서 넘어오는 "01", "02" 형식과 일치하도록 패딩 추가
    const months = Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0'));
    
    const currPoints = months.map(m => currentYearStats.find(s => s.month === m)?.total || 0);
    const lastPoints = months.map(m => lastYearStats.find(s => s.month === m)?.total || 0);
    const maxVal = Math.max(...currPoints, ...lastPoints, 1000); // 최소 높이 보장

    return { months, currPoints, lastPoints, maxVal };
  }, [currentYearStats, lastYearStats]);

  const getY = (val: number) => 100 - (val / trendData.maxVal) * 100;
  const getX = (idx: number) => (idx / 11) * 100;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto px-2">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm print:hidden">
        <div className="flex bg-slate-100 p-1.5 rounded-xl">
          <button onClick={() => setReportType('weekly')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${reportType === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>주간 집계표</button>
          <button onClick={() => setReportType('trend')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${reportType === 'trend' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>연간 트렌드</button>
        </div>
        <div className="flex items-center gap-4">
           {reportType === 'weekly' ? (
             <input type="date" className="px-4 py-2 border border-slate-200 rounded-xl bg-white font-bold text-xs" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
           ) : (
             <select className="px-4 py-2 border border-slate-200 rounded-xl bg-white font-bold text-xs" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
             </select>
           )}
           <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-xs hover:bg-blue-600 transition-all"><i className="fa-solid fa-print mr-2"></i> 인쇄</button>
        </div>
      </div>

      {reportType === 'weekly' ? (
        <section className="bg-white p-12 rounded-[48px] border border-slate-100 shadow-sm print:p-0 print:border-0">
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-6 mb-8">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{selectedDate} 헌금 집계표</h1>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">VGMC Ledger Overview</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-sky-700">${weeklySummary.reduce((a, b: any) => a + b[1].total, 0).toLocaleString()}</p>
              </div>
          </div>
          <table className="w-full text-left table-fixed border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-3 text-sm font-black text-slate-400 uppercase w-20 text-center">코드</th>
                <th className="px-3 py-3 text-sm font-black text-slate-400 uppercase w-40">항목</th>
                <th className="px-3 py-3 text-sm font-black text-slate-400 uppercase w-32 text-right">금액</th>
                <th className="px-3 py-3 text-sm font-black text-slate-400 uppercase">성도 명단</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {weeklySummary.map(([code, data]: [string, any]) => (
                <tr key={code}>
                  <td className="px-3 py-4 font-mono font-bold text-blue-500 text-xs text-center">{code}</td>
                  <td className="px-3 py-4 text-sm font-black text-slate-800">{data.name}</td>
                  <td className="px-3 py-4 text-sm font-black text-right text-slate-900">${data.total.toLocaleString()}</td>
                  <td className="px-6 py-4 text-[11px] font-bold text-slate-400 leading-relaxed">{data.items.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="space-y-10">
           <div className="bg-white p-12 rounded-[64px] border border-slate-100 shadow-sm relative">
              <div className="flex justify-between items-center mb-16">
                 <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">수입 추이 분석</h3>
                    <div className="flex gap-6 mt-4">
                       <div className="flex items-center gap-2">
                          <div className="w-4 h-1 bg-blue-600 rounded-full"></div>
                          <span className="text-sm font-black text-slate-500 uppercase">{selectedYear}년</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-4 h-1 bg-slate-300 rounded-full"></div>
                          <span className="text-sm font-black text-slate-500 uppercase">{parseInt(selectedYear)-1}년</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="h-96 relative px-4">
                 <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    {[0, 25, 50, 75, 100].map(val => (
                       <line key={val} x1="0" y1={val} x2="100" y2={val} stroke="#f1f5f9" strokeWidth="0.5" />
                    ))}
                    
                    {/* 지난해 라인 (배경) */}
                    <path 
                       d={`M ${trendData.lastPoints.map((v, i) => `${getX(i)} ${getY(v)}`).join(' L ')}`}
                       fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-30"
                    />

                    {/* 올해 라인 (메인) */}
                    <path 
                       d={`M ${trendData.currPoints.map((v, i) => `${getX(i)} ${getY(v)}`).join(' L ')}`}
                       fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                    />

                    {trendData.currPoints.map((v, i) => (
                       <g key={i}>
                          <rect 
                            x={getX(i) - 4} y="0" width="8" height="100" fill="transparent" className="cursor-pointer"
                            onMouseEnter={() => setHoveredMonthIdx(i)} onMouseLeave={() => setHoveredMonthIdx(null)}
                          />
                          <circle cx={getX(i)} cy={getY(v)} r={hoveredMonthIdx === i ? "2.5" : "1.5"} fill="#3b82f6" className="pointer-events-none transition-all" />
                       </g>
                    ))}
                 </svg>
                 
                 <div className="flex justify-between mt-8">
                    {trendData.months.map(m => <span key={m} className="text-[10px] font-black text-slate-400">{parseInt(m)}월</span>)}
                 </div>

                 {/* 툴팁 */}
                  {hoveredMonthIdx !== null && (
                     <div 
                        className="absolute bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-20 pointer-events-none border border-white/10 min-w-[160px] animate-in fade-in zoom-in duration-200"
                        style={{ 
                            left: `${getX(hoveredMonthIdx)}%`, 
                            // 툴팁이 너무 위로 올라가지 않게 최소 높이 조절
                            top: `${Math.max(getY(trendData.currPoints[hoveredMonthIdx]), 20)}%`, 
                            transform: 'translate(-50%, -110%)' 
                        }}
                     >
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">
                           {hoveredMonthIdx + 1}월 실적 비교
                        </p>
                        <div className="space-y-2">
                            {/* 올해 데이터 */}
                            <div className="flex justify-between items-center gap-4">
                                <div className="flex items-center gap-2">
                                   <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                   <span className="text-xs font-bold text-slate-300">{selectedYear}년</span>
                                </div>
                                <span className="text-sm font-black text-white">
                                   ${trendData.currPoints[hoveredMonthIdx].toLocaleString()}
                                </span>
                            </div>

                            {/* 작년 데이터 */}
                            <div className="flex justify-between items-center gap-4">
                                <div className="flex items-center gap-2">
                                   <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                                   <span className="text-xs font-bold text-slate-400">{parseInt(selectedYear) - 1}년</span>
                                </div>
                                <span className="text-sm font-black text-slate-300">
                                   ${trendData.lastPoints[hoveredMonthIdx].toLocaleString()}
                                </span>
                            </div>

                            {/* 증감 표시 (옵션) */}
                            <div className="pt-2 mt-1 border-t border-white/5 flex justify-between items-center">
                               <span className="text-[10px] font-bold text-slate-500 uppercase">성장률</span>
                               <span className={`text-[10px] font-black ${
                                  trendData.currPoints[hoveredMonthIdx] >= trendData.lastPoints[hoveredMonthIdx] 
                                  ? 'text-emerald-400' : 'text-rose-400'
                               }`}>
                                  {trendData.lastPoints[hoveredMonthIdx] > 0 
                                    ? (((trendData.currPoints[hoveredMonthIdx] - trendData.lastPoints[hoveredMonthIdx]) / trendData.lastPoints[hoveredMonthIdx]) * 100).toFixed(1) + '%'
                                    : '-%'}
                               </span>
                            </div>
                        </div>
                        {/* 툴팁 화살표 */}
                        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-white/10"></div>
                     </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
