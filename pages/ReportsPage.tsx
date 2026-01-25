
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { OfferingRecord, OfferingType } from '../types';

const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<'weekly' | 'trend'>('weekly');
  const [records, setRecords] = useState<OfferingRecord[]>([]);
  const [currentYearStats, setCurrentYearStats] = useState<{month: string, total: number}[]>([]);
  const [lastYearStats, setLastYearStats] = useState<{month: string, total: number}[]>([]);
  
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

  const refreshData = useCallback(async () => {
    const [recs, curr, last] = await Promise.all([
      storageService.getRecords(),
      storageService.getMonthlyStatsFromView(selectedYear),
      storageService.getMonthlyStatsFromView(String(parseInt(selectedYear) - 1))
    ]);
    setRecords(recs);
    setCurrentYearStats(curr);
    setLastYearStats(last);
  }, [selectedYear]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Weekly Logic
  const weeklySummary = useMemo(() => {
    const dayRecords = records.filter(r => r.date === selectedDate);
    const summary: Record<string, any> = {};
    dayRecords.forEach(r => {
      if (!summary[r.code]) summary[r.code] = { total: 0, name: r.offeringName || r.code, items: [] };
      summary[r.code].total += r.amount;
      const label = r.offeringNumber ? `No.${r.offeringNumber}` : (r.donorName || '익명');
      summary[r.code].items.push(r.note ? `${label}(${r.note})` : label);
    });
    return Object.entries(summary).sort((a,b) => a[0].localeCompare(b[0]));
  }, [records, selectedDate]);

  // Line Chart Logic
  const trendData = useMemo(() => {
    const months = Array.from({length: 12}, (_, i) => String(i + 1));
    const maxVal = Math.max(...currentYearStats.map(s => s.total), ...lastYearStats.map(s => s.total), 1);
    
    const currPoints = months.map(m => currentYearStats.find(s => s.month === m)?.total || 0);
    const lastPoints = months.map(m => lastYearStats.find(s => s.month === m)?.total || 0);

    return { months, currPoints, lastPoints, maxVal };
  }, [currentYearStats, lastYearStats]);

  const getY = (val: number) => 100 - (val / trendData.maxVal) * 100;
  const getX = (idx: number) => (idx / 11) * 100;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto px-2">
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
                <option value="2026">2026년</option>
                <option value="2025">2025년</option>
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Grace Offering Ledger</p>
             </div>
             <div className="text-right">
                <p className="text-3xl font-black text-blue-600">${weeklySummary.reduce((a,b) => a + b[1].total, 0).toLocaleString()}</p>
             </div>
          </div>
          <table className="w-full text-left table-fixed border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase w-20 text-center">코드</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase w-40">항목</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase w-32 text-right">금액</th>
                <th className="px-3 py-3 text-[10px] font-black text-slate-400 uppercase">성도 명단</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {weeklySummary.map(([code, data]) => (
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
        <div className="space-y-10 animate-in slide-in-from-bottom-5">
           <div className="bg-white p-12 rounded-[64px] border border-slate-100 shadow-sm relative">
              <div className="flex justify-between items-center mb-16">
                 <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Financial Trajectory Analysis</h3>
                    <div className="flex gap-6 mt-4">
                       <div className="flex items-center gap-2">
                          <div className="w-4 h-1 bg-blue-600 rounded-full"></div>
                          <span className="text-[10px] font-black text-slate-500 uppercase">{selectedYear}년</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-4 h-1 bg-slate-300 rounded-full"></div>
                          <span className="text-[10px] font-black text-slate-500 uppercase">{parseInt(selectedYear)-1}년</span>
                       </div>
                    </div>
                 </div>
                 <div className="bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Year-to-Date Peak</p>
                    <p className="text-xl font-black text-slate-900">{trendData.months[trendData.currPoints.indexOf(Math.max(...trendData.currPoints))]}월</p>
                 </div>
              </div>

              <div className="h-96 relative px-4">
                 <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    {/* Grid Lines */}
                    {[0, 25, 50, 75, 100].map(val => (
                       <line key={val} x1="0" y1={val} x2="100" y2={val} stroke="#f1f5f9" strokeWidth="0.5" />
                    ))}
                    
                    {/* Hover Guide Line */}
                    {hoveredMonthIdx !== null && (
                        <line x1={getX(hoveredMonthIdx)} y1="0" x2={getX(hoveredMonthIdx)} y2="100" stroke="#3b82f6" strokeWidth="0.2" strokeDasharray="2" />
                    )}

                    {/* Last Year Line (Slate) */}
                    <path 
                       d={`M ${trendData.lastPoints.map((v, i) => `${getX(i)} ${getY(v)}`).join(' L ')}`}
                       fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" 
                       className="opacity-30"
                    />

                    {/* This Year Line (Blue) */}
                    <path 
                       d={`M ${trendData.currPoints.map((v, i) => `${getX(i)} ${getY(v)}`).join(' L ')}`}
                       fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                       strokeDasharray="0"
                    />

                    {/* Interactive Areas & Points */}
                    {trendData.currPoints.map((v, i) => (
                       <g key={i}>
                          <rect 
                            x={getX(i) - 4} y="0" width="8" height="100" 
                            fill="transparent" 
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredMonthIdx(i)}
                            onMouseLeave={() => setHoveredMonthIdx(null)}
                          />
                          <circle cx={getX(i)} cy={getY(v)} r={hoveredMonthIdx === i ? "2.5" : "1.5"} fill="#3b82f6" className="pointer-events-none transition-all" />
                          <circle cx={getX(i)} cy={getY(trendData.lastPoints[i])} r={hoveredMonthIdx === i ? "2.5" : "1.5"} fill="#cbd5e1" className="pointer-events-none transition-all opacity-40" />
                       </g>
                    ))}
                 </svg>
                 
                 <div className="flex justify-between mt-8">
                    {trendData.months.map(m => <span key={m} className="text-[10px] font-black text-slate-400">{m}월</span>)}
                 </div>

                 {/* Tooltip Overlay */}
                 {hoveredMonthIdx !== null && (
                     <div 
                        className="absolute bg-slate-900 text-white p-4 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 z-20 pointer-events-none border border-white/10"
                        style={{ 
                            left: `${getX(hoveredMonthIdx)}%`, 
                            top: `${Math.min(getY(trendData.currPoints[hoveredMonthIdx]), 70)}%`,
                            transform: 'translate(-50%, -110%)' 
                        }}
                     >
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">{hoveredMonthIdx + 1}월 상세 실적</p>
                        <div className="space-y-1">
                            <div className="flex justify-between gap-6">
                                <span className="text-[10px] font-bold text-blue-400">{selectedYear}년</span>
                                <span className="text-[11px] font-black">${trendData.currPoints[hoveredMonthIdx].toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-6 opacity-60">
                                <span className="text-[10px] font-bold text-slate-400">{parseInt(selectedYear)-1}년</span>
                                <span className="text-[11px] font-black">${trendData.lastPoints[hoveredMonthIdx].toLocaleString()}</span>
                            </div>
                        </div>
                     </div>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-900 p-10 rounded-[56px] shadow-xl text-white">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Yearly Growth Insight</h3>
                 <p className="text-lg font-medium leading-relaxed text-slate-300">
                    현재까지 <span className="text-white font-black">{selectedYear}년</span> 총 누적 수입은 <span className="text-blue-400 font-black">${currentYearStats.reduce((a,b)=>a+b.total, 0).toLocaleString()}</span>입니다. 
                    지난해 동기 대비 <span className={`font-black ${currentYearStats.reduce((a,b)=>a+b.total, 0) >= lastYearStats.reduce((a,b)=>a+b.total, 0) ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(((currentYearStats.reduce((a,b)=>a+b.total, 0) - lastYearStats.reduce((a,b)=>a+b.total, 0)) / (lastYearStats.reduce((a,b)=>a+b.total, 0) || 1)) * 100).toFixed(1)}%
                    </span> 성과 변화를 보이고 있습니다.
                 </p>
              </div>
              <div className="bg-white p-10 rounded-[56px] border border-slate-100 shadow-sm">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Historical Comparison</h3>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                       <span className="text-sm font-bold text-slate-600">최고 실적 달 (Monthly Peak)</span>
                       <span className="text-sm font-black text-slate-900">{trendData.months[trendData.currPoints.indexOf(Math.max(...trendData.currPoints))]}월</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                       <span className="text-sm font-bold text-slate-600">작년 동기 실적</span>
                       <span className="text-sm font-black text-slate-400">${lastYearStats.reduce((a,b)=>a+b.total, 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                       <span className="text-sm font-bold text-slate-600">올해 월 평균 (Current Avg)</span>
                       <span className="text-sm font-black text-blue-600">${(currentYearStats.reduce((a,b)=>a+b.total,0)/12).toFixed(0).toLocaleString()}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
