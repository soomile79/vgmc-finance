import React, { useState, useEffect, useMemo, useRef } from 'react';
import { storageService } from '../services/storageService';
import { OfferingRecord, Donor, OfferingType } from '../types';

const DonorStatsPage: React.FC = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [records, setRecords] = useState<OfferingRecord[]>([]);
  const [offeringTypes, setOfferingTypes] = useState<OfferingType[]>([]);
  
  const [donorSearch, setDonorSearch] = useState('');
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  const [yearFilter, setYearFilter] = useState('');
  const [dbMonthlyStats, setDbMonthlyStats] = useState<any[]>([]);

  // 툴팁용 상태: SVG 외부에서 텍스트를 선명하게 띄우기 위함
  const [hoveredPoint, setHoveredPoint] = useState<{x: number, y: number, amount: number, date: string} | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const recs = await storageService.getRecords();
      setDonors(await storageService.getDonors());
      setRecords(recs);
      setOfferingTypes(await storageService.getOfferingTypes());

      if (recs.length > 0 && !yearFilter) {
        const latestYear = recs.map(r => r.date.split('-')[0]).sort().reverse()[0];
        setYearFilter(latestYear);
      } else if (!yearFilter) {
        setYearFilter(new Date().getFullYear().toString());
      }
    };
    loadData();

    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    records.forEach(r => {
      const y = r.date.split('-')[0];
      if (y) years.add(y);
    });
    if (years.size === 0) years.add(new Date().getFullYear().toString());
    return Array.from(years).sort().reverse();
  }, [records]);

  const filteredSearchDonors = useMemo(() => {
    const query = donorSearch.toLowerCase().trim();
    if (!query || (selectedDonor && donorSearch.includes(selectedDonor.name))) return [];
    
    return donors.filter(d => 
      d.name.toLowerCase().includes(query) || (d.offeringNumber && d.offeringNumber.includes(query))
    ).sort((a,b) => {
        const numA = parseInt(a.offeringNumber || '9999');
        const numB = parseInt(b.offeringNumber || '9999');
        return numA - numB;
    }).slice(0, 15);
  }, [donorSearch, donors, selectedDonor]);

  const handleSelectDonor = async (d: Donor) => {
    setSelectedDonor(d);
    setDonorSearch(`[${d.offeringNumber || '무'}] ${d.name}`);
    setShowResults(false);

    if (d.offeringNumber) {
      try {
        const stats = await storageService.getDonorMonthlyStats(d.offeringNumber);
        setDbMonthlyStats(stats);
      } catch (err) {
        console.error("개인 통계 로드 실패:", err);
      }
    } else {
      setDbMonthlyStats([]);
    }
  };

  const donorData = useMemo(() => {
    if (!selectedDonor || !dbMonthlyStats.length) return null;
    
    const targetYear = yearFilter ? parseInt(yearFilter) : new Date().getFullYear();

    const currentYearRecords = dbMonthlyStats
      .filter(s => s.year === targetYear)
      .map(s => ({
        date: `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day || '01').padStart(2, '0')}`,
        code: s.donation_code,
        amount: Number(s.total) || 0
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    
    const totalYearly = currentYearRecords.reduce((a, b) => a + b.amount, 0);

    const last24Months = Array.from({ length: 24 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (23 - i));
      const y = d.getFullYear();
      const m = d.getMonth() + 1;

      const monthTotal = dbMonthlyStats
        .filter(s => s.year === y && s.month === m)
        .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);

      return {
        month: `${m}월`,
        amount: monthTotal,
        dateLabel: `${y}-${String(m).padStart(2, '0')}`
      };
    });

    const summaryMap: Record<string, number> = {};
    dbMonthlyStats.filter(s => s.year === targetYear).forEach(s => {
      summaryMap[s.donation_code] = (summaryMap[s.donation_code] || 0) + (Number(s.total) || 0);
    });

    const sortedSummary = Object.entries(summaryMap).map(([code, total]) => ({
      code,
      label: offeringTypes.find(t => t.code === code)?.label || `코드 ${code}`,
      total
    })).sort((a, b) => b.total - a.total);

    return {
      totalYearly,
      last24Months,
      summary: sortedSummary,
      records: currentYearRecords
    };
  }, [selectedDonor, yearFilter, offeringTypes, dbMonthlyStats]);

  const inputClass = "w-full px-8 py-5 border-4 border-slate-100 rounded-[32px] bg-white text-slate-900 text-xl font-black focus:border-sky-700 outline-none transition-all shadow-xl";

  return (
    <div className="space-y-12 max-w-[1600px] mx-auto animate-in fade-in duration-700 pb-32 px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end print:hidden">
        <div className="lg:col-span-8 relative" ref={searchRef}>
          <label className="text-2xl font-black text-sky-700 uppercase mb-4 block ml-4">성도 통합 검색</label>
          <div className="relative group">
          <i className="fa-solid fa-magnifying-glass absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 text-base group-focus-within:text-blue-500 transition-colors"></i>
          <input 
            ref={inputRef}
            type="text" 
            placeholder="교인 이름을 입력하세요..." 
            className={`${inputClass} pl-20`}
            value={donorSearch}
            onFocus={() => setShowResults(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredSearchDonors.length > 0) {
                    handleSelectDonor(filteredSearchDonors[0]);
                  }
              } else if (e.key === 'Escape') {
                setDonorSearch(''); // 입력값 클리어
                setShowResults(false); // 결과창 숨기기 (필요시)
                inputRef.current?.focus(); // 포커스 유지
              }
            }}
            onChange={(e) => { setDonorSearch(e.target.value); setShowResults(true); }}
          />
        </div>
          {showResults && filteredSearchDonors.length > 0 && (
            <ul className="absolute z-50 w-full mt-4 bg-white border-2 border-slate-100 rounded-[40px] shadow-base max-h-96 overflow-y-auto">
              {filteredSearchDonors.map(d => (
                <li key={d.id} onClick={() => handleSelectDonor(d)} className="px-10 py-6 hover:bg-sky-700 hover:text-white cursor-pointer group transition-all flex justify-between items-center border-b border-slate-50 last:border-0">
                  <div className="flex items-center space-x-2">
                     <span className="text-base font-black">{d.name} </span>
                     <span className="bg-slate-100 group-hover:bg-sky-800 px-4 py-2 rounded-2xl text-xs text-slate-500 group-hover:text-white transition-colors">
                        {d.offeringNumber || '없음'}
                     </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="lg:col-span-4">
          <label className="text-xl font-black text-slate-400 uppercase mb-4 block ml-4">분석 연도</label>
          <select className={inputClass} value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
             {availableYears.map(y => <option key={y} value={y}>{y}년 분석</option>)}
          </select>
        </div>
      </div>

      {selectedDonor && donorData ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-bottom-10 duration-700">
          <div className="lg:col-span-4 space-y-10">
             <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="absolute left-0 top-0 bottom-0 w-5 bg-sky-700"></div>
               <div className="flex flex-col gap-4 ml-6 mr-4">
                  <div className="flex items-center gap-3">
                     <span className="bg-slate-100 text-slate-500 text-xs font-black px-2.5 py-1 rounded-lg">{selectedDonor.offeringNumber}</span>
                     <h2 className="text-2xl font-black text-slate-800">{selectedDonor.name} <span className="text-slate-400 font-medium text-lg ml-1">성도님</span></h2>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                     <span className="text-slate-500 font-bold">{yearFilter}년 총 헌금액</span>
                     <span className="text-sky-700 font-black text-3xl">${donorData.totalYearly.toLocaleString()}</span>
                  </div>
               </div>
             </div>

             <div className="bg-white p-10 rounded-[60px] border border-slate-200 shadow-sm">
                <h3 className="text-base font-black text-slate-400 uppercase tracking-widest mb-8">항목별 상세 수입</h3>
                <div className="space-y-6">
                   {donorData.summary.map(s => (
                     <div key={s.code}>
                        <div className="flex justify-between mb-2 px-2 text-base font-black text-slate-800">
                            <span>{s.label}</span>
                            <span>${s.total.toLocaleString()}</span>
                        </div>
                        <div className="h-3 bg-slate-50 rounded-full overflow-hidden">
                           <div className="h-full bg-sky-700 rounded-full transition-all" style={{ width: `${donorData.totalYearly > 0 ? (s.total / donorData.totalYearly) * 100 : 0}%` }}></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          <div className="lg:col-span-8 space-y-10">
            {/* --- 수정된 그래프 섹션 시작 --- */}
            <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm relative">
                <h3 className="text-base font-black text-slate-400 uppercase tracking-[0.1em] mb-12 flex items-center gap-4">
                  <i className="fa-solid fa-chart-line text-sky-700"></i> 24개월 봉헌 히스토리
                </h3>
                
                <div className="h-64 w-full relative px-2">
                  {/* HTML 기반 선명한 툴팁 */}
                  {hoveredPoint && (
                    <div 
                      className="absolute z-50 pointer-events-none bg-slate-900 text-white p-3 rounded-2xl shadow-2xl transition-all duration-200 ease-out -translate-x-1/2 -translate-y-[120%]"
                      style={{ 
                        left: `${hoveredPoint.x / 10}%`, 
                        top: `${hoveredPoint.y}%` 
                      }}
                    >
                      <p className="text-[10px] font-bold text-sky-400 mb-1">{hoveredPoint.date}</p>
                      <p className="text-sm font-black">${hoveredPoint.amount.toLocaleString()}</p>
                      <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                    </div>
                  )}

                  <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {[0, 50, 100].map((v) => (
                      <line key={v} x1="0" y1={v} x2="1000" y2={v} stroke="#f1f5f9" strokeWidth="1" />
                    ))}

                    {(() => {
                      const chartData = donorData.last24Months;
                      const maxVal = Math.max(...chartData.map(d => d.amount), 1);
                      const points = chartData.map((d, i) => ({
                        x: (i / (chartData.length - 1)) * 1000,
                        y: 100 - (d.amount / maxVal) * 100,
                        amount: d.amount,
                        dateLabel: d.dateLabel
                      }));

                      // 큐빅 베지어 곡선 생성
                      let pathD = `M ${points[0].x} ${points[0].y}`;
                      for (let i = 0; i < points.length - 1; i++) {
                        const curr = points[i];
                        const next = points[i + 1];
                        const cpX = (curr.x + next.x) / 2;
                        pathD += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`;
                      }

                      const fillPath = `${pathD} L 1000 100 L 0 100 Z`;

                      return (
                        <>
                          <path d={fillPath} fill="url(#areaGradient)" />
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#0ea5e9" 
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeJoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          {points.map((p, i) => (
                            <g 
                              key={i} 
                              className="group cursor-pointer"
                              onMouseEnter={() => setHoveredPoint({ x: p.x, y: p.y, amount: p.amount, date: p.dateLabel })}
                              onMouseLeave={() => setHoveredPoint(null)}
                            >
                              {/* 마우스 감지 영역 (히트 영역) */}
                              <circle cx={p.x} cy={p.y} r="15" fill="transparent" />
                              {/* 실제 점 */}
                              <circle 
                                cx={p.x} cy={p.y} r="1" 
                                className="fill-white stroke-sky-500 stroke-[3px] transition-all group-hover:r-6 group-hover:stroke-indigo-600 shadow-lg" 
                              />
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                  
                  <div className="flex justify-between mt-8 border-t border-slate-50 pt-4">
                    {donorData.last24Months.map((d, i) => (i % 4 === 0) && (
                      <span key={i} className="text-[9px] font-black text-slate-300">{d.dateLabel.split('-')[1]}월</span>
                    ))}
                  </div>
                </div>
            </div>
            {/* --- 수정된 그래프 섹션 끝 --- */}

            <div className="bg-white rounded-[60px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                   <h3 className="text-base font-black uppercase tracking-widest">Timeline (선택 연도 상세)</h3>
                   <span className="text-base font-bold bg-blue-600 px-3 py-1 rounded-lg">{donorData.records.length}건</span>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 text-sm font-black text-slate-400 uppercase border-b sticky top-0 z-10">
                         <tr>
                            <th className="px-8 py-4">날짜</th>
                            <th className="px-8 py-4">종류</th>
                            <th className="px-8 py-4 text-right">금액 ($)</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {donorData.records.map((r, i) => (
                           <tr key={i} className="hover:bg-blue-50/20">
                              <td className="px-8 py-4 text-sm font-bold text-slate-400">{r.date}</td>
                              <td className="px-8 py-4 text-base font-black text-slate-800">{offeringTypes.find(t => t.code === r.code)?.label || r.code}</td>
                              <td className="px-8 py-4 text-base font-black text-slate-900 text-right">${r.amount.toLocaleString()}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-48 rounded-[80px] border-4 border-dashed border-slate-100 text-center flex flex-col items-center">
            <i className="fa-solid fa-user-tag text-2xl text-slate-200 mb-10"></i>
            <p className="text-xl font-black text-slate-400">데이터를 분석할 성도님을 선택해주세요</p>
        </div>
      )}
    </div>
  );
};

export default DonorStatsPage;
