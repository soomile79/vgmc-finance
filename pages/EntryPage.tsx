import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { Donor, OfferingType } from '../types';

interface PendingItem {
  id: string;
  code: string;
  offeringName: string;
  amount: number;
  note: string;
  donorName: string;
  donorId: string;
  offeringNumber: string;
}

const EntryPage: React.FC = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [offeringTypes, setOfferingTypes] = useState<OfferingType[]>([]);
  
  const [donorSearch, setDonorSearch] = useState('');
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [showDonorResults, setShowDonorResults] = useState(false);

  const [typeSearch, setTypeSearch] = useState('');
  const [selectedType, setSelectedType] = useState<OfferingType | null>(null);
  const [showTypeResults, setShowTypeResults] = useState(false);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getInitialDate = () => {
    const d = new Date();
    const day = d.getDay(); 
    const diff = d.getDate() - day;
    const lastSunday = new Date(d.setDate(diff));
    return lastSunday.toLocaleDateString('en-CA'); 
  };

  const [date, setDate] = useState(getInitialDate());

  // --- 추가된 로직: LocalStorage 연동 ---
  // 1. 초기 상태를 로컬스토리지에서 가져옴
  const [pendingItems, setPendingItems] = useState<PendingItem[]>(() => {
    const saved = localStorage.getItem('pending_offering_items');
    return saved ? JSON.parse(saved) : [];
  });

  // 2. pendingItems가 변경될 때마다 로컬스토리지에 저장
  useEffect(() => {
    localStorage.setItem('pending_offering_items', JSON.stringify(pendingItems));
  }, [pendingItems]);
  // ------------------------------------

  const searchRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const donorInputRef = useRef<HTMLInputElement>(null);
  const typeInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const isSunday = useMemo(() => {
    if (!date) return true;
    const d = new Date(date + 'T12:00:00'); 
    return d.getDay() === 0;
  }, [date]);

  const refreshData = useCallback(async () => {
    try {
      const [dons, types] = await Promise.all([
        storageService.getDonors(),
        storageService.getOfferingTypes()
      ]);
      setDonors(dons);
      setOfferingTypes(types);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowDonorResults(false);
      if (typeRef.current && !typeRef.current.contains(event.target as Node)) setShowTypeResults(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [refreshData]);

  const filteredDonors = useMemo(() => {
    const query = donorSearch.trim().toLowerCase();
    if (!query) return [];
    if (selectedDonor && donorSearch === `[${selectedDonor.offeringNumber || '무'}] ${selectedDonor.name}`) return [];
    
    return donors.filter(d => 
      d.name.toLowerCase().includes(query) || (d.offeringNumber && d.offeringNumber.includes(query))
    ).sort((a,b) => {
      const numA = parseInt(a.offeringNumber || '99999');
      const numB = parseInt(b.offeringNumber || '99999');
      return numA - numB;
    });
  }, [donors, donorSearch, selectedDonor]);

  const filteredTypes = useMemo(() => {
    const query = typeSearch.toLowerCase().trim();
    if (!query || (selectedType && typeSearch.includes(selectedType.label))) return [];
    return offeringTypes.filter(t => 
      t.label.toLowerCase().includes(query) || t.code.includes(query)
    );
  }, [offeringTypes, typeSearch, selectedType]);

  const handleSelectDonor = (donor: Donor) => {
    setSelectedDonor(donor);
    setDonorSearch(`[${donor.offeringNumber || '무'}] ${donor.name}`);
    setShowDonorResults(false);
    setTimeout(() => typeInputRef.current?.focus(), 50);
  };

  const handleSelectType = (type: OfferingType) => {
    setSelectedType(type);
    setTypeSearch(`${type.label} (${type.code})`);
    setShowTypeResults(false);
    setTimeout(() => amountInputRef.current?.focus(), 50);
  };

  const addPendingItem = () => {
    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (!selectedType || isNaN(parsedAmount)) {
      alert('헌금 항목과 금액을 정확히 입력해주세요.');
      return;
    }
    
    const donorName = selectedDonor ? selectedDonor.name : (donorSearch || '익명');
    const donorId = selectedDonor ? selectedDonor.id : '';
    const offeringNumber = selectedDonor ? (selectedDonor.offeringNumber || '') : '';

    const newItem: PendingItem = {
      id: Math.random().toString(36).substring(2, 9),
      code: selectedType.code,
      offeringName: selectedType.label,
      amount: parsedAmount,
      note: note.trim(),
      donorName,
      donorId,
      offeringNumber
    };

    setPendingItems(prev => [...prev, newItem]);
    
    setDonorSearch('');
    setSelectedDonor(null);
    setAmount('');
    setNote('');
    setTypeSearch('');
    setSelectedType(null);
    
    setTimeout(() => donorInputRef.current?.focus(), 50);
  };

  const updatePendingAmount = (id: string, newAmountStr: string) => {
    const val = parseFloat(newAmountStr.replace(/[^0-9.]/g, '')) || 0;
    setPendingItems(prev => prev.map(item => item.id === id ? { ...item, amount: val } : item));
  };

  const handleFinalSubmit = useCallback(async () => {
    if (pendingItems.length === 0 || isSaving) return;
    
    if (!window.confirm(`총 ${pendingItems.length}건을 DB에 최종 저장하시겠습니까?`)) return;

    setIsSaving(true);
    try {
      const recordsToSave = pendingItems.map(item => ({
        donorId: item.donorId,
        donorName: item.donorName,
        offeringNumber: item.offeringNumber,
        code: item.code,
        offeringName: item.offeringName,
        amount: item.amount,
        note: item.note,
        date: date
      }));

      await storageService.addRecords(recordsToSave);
      
      // 저장 성공 후 로컬스토리지 비우기
      setPendingItems([]);
      localStorage.removeItem('pending_offering_items');
      
      alert('저장되었습니다.');
      donorInputRef.current?.focus();
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [pendingItems, date, isSaving]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (pendingItems.length > 0 && !isSaving) {
          e.preventDefault();
          handleFinalSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleFinalSubmit, pendingItems.length, isSaving]);

  const pendingSummary = useMemo(() => {
    const summary: Record<string, { total: number; donors: PendingItem[]; name: string }> = {};
    
    pendingItems.forEach(item => {
      if (!summary[item.code]) {
        summary[item.code] = { total: 0, donors: [], name: item.offeringName };
      }
      summary[item.code].total += item.amount;
      summary[item.code].donors.push(item);
    });

    return Object.entries(summary)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, data]) => {
        const sortedDonorStrings = [...data.donors].sort((a, b) => {
          const numA = parseInt(a.offeringNumber);
          const numB = parseInt(b.offeringNumber);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          if (!isNaN(numA)) return -1;
          if (!isNaN(numB)) return 1;
          return a.donorName.localeCompare(b.donorName);
        }).map(d => {
          const label = d.offeringNumber ? d.offeringNumber : d.donorName;
          return d.note ? `${label}(${d.note})` : label;
        });

        return [code, { ...data, donorStrings: sortedDonorStrings }] as const;
      });
  }, [pendingItems]);

  const pendingTotal = useMemo(() => 
    pendingItems.reduce((acc, curr) => acc + curr.amount, 0), 
  [pendingItems]);

  const inputStyle = "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-base font-bold outline-none focus:border-blue-500 shadow-sm transition-all";

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      {/* (생략된 UI 코드들은 기존과 동일) */}
      {!isSunday && (
        <div className="bg-amber-500 text-white px-6 py-4 rounded-[24px] flex items-center justify-between shadow-lg border border-amber-400/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <i className="fa-solid fa-triangle-exclamation text-xl"></i>
            </div>
            <div>
              <p className="font-black text-sm">입력 날짜 주의</p>
              <p className="text-xs opacity-90">{date}은 주일이 아닙니다.</p>
            </div>
          </div>
          <button onClick={() => dateInputRef.current?.showPicker()} className="bg-white text-amber-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-amber-50 shadow-sm">날짜 변경</button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm gap-4">
        <h2 className="text-xl font-black text-slate-800 tracking-tight shrink-0">헌금 입력 스테이션</h2>
        <div className="w-[1px] h-6 bg-slate-200 hidden md:block"></div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-xl border border-blue-100 bg-blue-50/30">
          <input id="offering-date" ref={dateInputRef} type="date" className="bg-transparent border-none focus:ring-0 text-slate-700 font-bold text-sm outline-none cursor-pointer" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-10">
          <div className="relative" ref={searchRef}>
            <label className="text-base font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">1. 성도</label>
            <input 
              ref={donorInputRef}
              type="text" 
              placeholder="홍길동..." 
              className={inputStyle}
              value={donorSearch}
              onFocus={() => setShowDonorResults(true)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onChange={e => { setDonorSearch(e.target.value); setSelectedDonor(null); setShowDonorResults(true); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !isComposing) {
                  e.preventDefault();
                  if (filteredDonors.length > 0) handleSelectDonor(filteredDonors[0]);
                  else if (donorSearch.trim()) { setShowDonorResults(false); typeInputRef.current?.focus(); }
                }
              }}
            />
            {showDonorResults && filteredDonors.length > 0 && (
              <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                {filteredDonors.map((d) => (
                  <li key={d.id} onClick={() => handleSelectDonor(d)} className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 border-b last:border-0 flex items-center justify-between group">
                    <span className="text-sm font-bold text-slate-800">{d.offeringNumber ? `[${d.offeringNumber}] ` : ''}{d.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative" ref={typeRef}>
            <label className="text-base font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">2. 항목</label>
            <input 
              ref={typeInputRef} 
              type="text" 
              placeholder="항목 검색..." 
              className={inputStyle} 
              value={typeSearch} 
              onFocus={() => setShowTypeResults(true)} 
              onChange={e => setTypeSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !isComposing) {
                  e.preventDefault();
                  if (filteredTypes.length > 0) handleSelectType(filteredTypes[0]);
                }
              }}
            />
            {showTypeResults && filteredTypes.length > 0 && (
              <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                {filteredTypes.map(t => (
                  <li key={t.code} onClick={() => handleSelectType(t)} className="px-4 py-2 cursor-pointer text-sm hover:bg-blue-50 font-bold text-slate-900 border-b last:border-0">
                    {t.label} ({t.code})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
              <div>
                <label className="text-base font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">3. 금액 ($)</label>
                <input ref={amountInputRef} type="text" placeholder="1000" className={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPendingItem()} />
              </div>
              <div>
                <label className="text-base font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">4. 메모</label>
                <input type="text" placeholder="메모..." className={inputStyle} value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPendingItem()} />
              </div>
          </div>

          <button onClick={addPendingItem} className="w-full bg-sky-700 text-white py-3 rounded-xl text-base font-black hover:bg-sky-600 transition-all active:scale-95 shadow-lg">항목 추가 (Enter)</button>
        </section>

        <section className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <h3 className="font-black text-slate-800 text-base">전송 대기 목록 ({pendingItems.length})</h3>
             <i className="fa-solid fa-clock-rotate-left text-slate-300 text-sm"></i>
          </div>
          <div className="p-2 space-y-1 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/20">
             {pendingItems.length === 0 && <div className="h-full flex items-center justify-center text-slate-300 italic text-xs">대기 항목 없음</div>}
             {[...pendingItems].reverse().map(item => (
               <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition-all shadow-sm">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs font-black text-sky-700 bg-blue-50 px-1.5 py-0.5 rounded uppercase shrink-0 min-w-[30px] text-center">{item.offeringNumber || '무'}</span>
                    <span className="text-sm font-bold text-slate-800 truncate">{item.donorName}</span>
                    <span className="text-sm font-medium text-slate-500 truncate shrink-0">{item.offeringName}</span>
                  </div>
                  <input 
                    type="text" 
                    className="w-20 bg-slate-50 border-none rounded-lg px-2 py-1 text-right font-black text-slate-900 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    value={item.amount}
                    onChange={e => updatePendingAmount(item.id, e.target.value)}
                  />
                  <button onClick={() => setPendingItems(pendingItems.filter(i => i.id !== item.id))} className="text-slate-200 hover:text-red-500 shrink-0"><i className="fa-solid fa-times-circle"></i></button>
               </div>
             ))}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-md flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <h3 className="font-black text-slate-800 text-base uppercase tracking-tight">저장 전 집계 확인</h3>
             <button 
                onClick={handleFinalSubmit} 
                disabled={pendingItems.length === 0 || isSaving} 
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-base shadow-lg transition-all ${isSaving ? 'bg-slate-100 text-slate-300' : 'bg-sky-700 text-white hover:bg-sky-600 active:scale-95'}`}
             >
                {isSaving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                {isSaving ? '저장 중...' : '최종 저장 (Ctrl+Enter)'}
             </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white border-b border-slate-100 text-sm font-black text-slate-400 uppercase ">
                <tr>
                  <th className="px-4 py-3 w-16">코드</th>
                  <th className="px-4 py-3 w-24">항목</th>
                  <th className="px-4 py-3 w-24 text-right">금액</th>
                  <th className="px-4 py-3">성도 명단</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pendingSummary.map(([code, data]) => (
                  <tr key={code} className="hover:bg-blue-50/20">
                    <td className="px-4 py-4 text-xs font-black text-blue-500">{code}</td>
                    <td className="px-4 py-4 text-sm font-black text-slate-800">{data.name}</td>
                    <td className="px-4 py-4 text-sm font-black text-right text-slate-900">${data.total.toLocaleString()}</td>
                    <td className="px-4 py-4 text-[11px] font-bold text-slate-400 leading-relaxed italic">
                      {data.donorStrings.join(', ')}
                    </td>
                  </tr>
                ))}
                {pendingItems.length === 0 && (
                  <tr><td colSpan={4} className="py-20 text-center text-slate-200 italic font-bold text-base">데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-5 bg-white-900 text-white border-t border-white-800 rounded-b-2xl shadow-inner">
            <div className="flex justify-between items-center">
              <span className="text-base font-black text-slate-500 uppercase tracking-wide">전체 합계 확인</span>
              <span className="text-2xl font-black text-sky-700 tracking-tighter">${pendingTotal.toLocaleString()}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default EntryPage;
