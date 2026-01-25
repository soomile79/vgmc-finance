
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { Donor, OfferingRecord, OfferingType } from '../types';

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
  const [records, setRecords] = useState<OfferingRecord[]>([]);
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
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

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
      const [recs, dons, types] = await Promise.all([
        storageService.getRecords(),
        storageService.getDonors(),
        storageService.getOfferingTypes()
      ]);
      setRecords(recs);
      setDonors(dons);
      setOfferingTypes(types);
    } catch (err) {
      console.error("데이터 동기화 실패:", err);
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
    setAmount('');
    setNote('');
    setTypeSearch('');
    setSelectedType(null);
    setTimeout(() => typeInputRef.current?.focus(), 50);
  };

  const handleFinalSubmit = useCallback(async () => {
    if (pendingItems.length === 0 || isSaving) return;
    
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

      // DB(Supabase)에만 즉시 저장 -> 속도 향상
      await storageService.addRecords(recordsToSave);
      
      setPendingItems([]);
      setSelectedDonor(null); 
      setDonorSearch('');     
      
      await refreshData();
      // alert('DB에 저장되었습니다. 구글 시트 반영은 [전체 데이터] 페이지에서 진행해 주세요.');
      donorInputRef.current?.focus();
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [pendingItems, date, isSaving, refreshData]);

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

  const dayReportSummary = useMemo(() => {
    const dayRecords = records.filter(r => r.date === date);
    const summary: Record<string, { total: number; donors: string[] }> = {};
    
    dayRecords.forEach(r => {
      if (!summary[r.code]) summary[r.code] = { total: 0, donors: [] };
      summary[r.code].total += Number(r.amount);
      const label = r.offeringNumber ? r.offeringNumber : r.donorName;
      summary[r.code].donors.push(`${label}${r.note ? `(${r.note})` : ''}`);
    });
    return Object.entries(summary).sort((a, b) => a[0].localeCompare(b[0]));
  }, [records, date]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
    {/* 주일 아님 경고 배너 */}
    {!isSunday && (
      <div className="bg-amber-500 text-white px-6 py-4 rounded-[24px] flex items-center justify-between shadow-lg border border-amber-400/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
            <i className="fa-solid fa-triangle-exclamation text-xl"></i>
          </div>
          <div>
            <p className="font-black text-sm">입력 날짜 주의</p>
            <p className="text-xs opacity-90">{date}은 주일이 아닙니다. 확인 후 입력해 주세요.</p>
          </div>
        </div>
        <button 
          onClick={() => dateInputRef.current?.showPicker()} 
          className="bg-white text-amber-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-amber-50 transition-all shadow-sm"
        >
          날짜 변경
        </button>
      </div>
    )}

    {/* 헤더 스테이션 영역 */}
    <div className="flex flex-col md:flex-row md:items-center bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm gap-4 md:gap-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight shrink-0">
          헌금 입력 스테이션
        </h2>
        {/* 모바일에서는 숨겨지는 수직 구분선 */}
        <div className="w-[1px] h-6 bg-slate-200 hidden md:block"></div>
      </div>

      {/* 달력 인풋 박스 */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl border border-blue-100 bg-blue-50/30 hover:bg-blue-50 transition-colors group self-start md:self-auto">
        <label htmlFor="offering-date" className="cursor-pointer">
          <i className="fa-solid fa-calendar-check text-blue-500 text-xs group-hover:scale-110 transition-transform"></i>
        </label>
        <input
          id="offering-date"
          ref={dateInputRef}
          type="date"
          className="bg-transparent border-none focus:ring-0 text-slate-700 font-bold text-base outline-none cursor-pointer"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>
    </div>
  
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-10">
          <div className="relative" ref={searchRef}>
            <label className="text-lg font-black text-neutral-400 uppercase tracking-wider mb-4 block ml-1">1. 성도 (번호/이름)</label>
            <div className="relative">
              <input 
                ref={donorInputRef}
                type="text" 
                placeholder="홍길동..." 
                className={`w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-lg font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all shadow-sm ${selectedDonor ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-50' : ''}`}
                value={donorSearch}
                onFocus={() => setShowDonorResults(true)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onChange={e => { 
                  setDonorSearch(e.target.value); 
                  setSelectedDonor(null); 
                  setShowDonorResults(true); 
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !isComposing) {
                    e.preventDefault();
                    if (filteredDonors.length > 0) {
                      handleSelectDonor(filteredDonors[0]);
                    } else if (donorSearch.trim()) {
                      setShowDonorResults(false);
                      typeInputRef.current?.focus();
                    }
                  }
                }}
              />
              {selectedDonor && (
                <button onClick={() => {setSelectedDonor(null); setDonorSearch(''); donorInputRef.current?.focus();}} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500">
                  <i className="fa-solid fa-circle-xmark"></i>
                </button>
              )}
            </div>
           {showDonorResults && filteredDonors.length > 0 && (
            <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
              {filteredDonors.map((d) => (
                <li
                  key={d.id}
                  onClick={() => handleSelectDonor(d)}
                  className="group px-4 py-3 cursor-pointer transition-all
                            hover:bg-blue-50 border-b last:border-0
                            flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {/* 헌금번호 */}
                    <span className="text-sm font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-full group-hover:bg-blue-100">
                      {d.offeringNumber || '번호없음'}
                    </span>

                    {/* 이름 */}
                    <span className="text-base font-bold text-slate-800 group-hover:text-blue-700">
                      {d.name}
                    </span>
                  </div>

                  {/* 선택 표시 */}
                  {selectedDonor?.id === d.id && (
                    <i className="fa-solid fa-check text-blue-600"></i>
                  )}
                </li>
              ))}
            </ul>
          )}
          </div>
          
          <div className="relative" ref={typeRef}>
            <label className="text-lg font-black text-neutral-400 uppercase tracking-wider mb-4 block ml-1">2. 헌금 항목</label>
            <input 
              ref={typeInputRef} 
              type="text" 
              placeholder="십일조, 감사..." 
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-lg font-bold outline-none focus:border-blue-500 transition-all shadow-sm" 
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
              <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {filteredTypes.map(t => (
                  <li key={t.code} onClick={() => handleSelectType(t)} className="px-4 py-2 cursor-pointer text-base hover:bg-blue-600 hover:text-white font-bold transition-all text-slate-900 border-b border-slate-50 last:border-0">
                    {t.label} ({t.code})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="text-lg font-black text-neutral-400 uppercase tracking-wider mb-4 block ml-1">3. 금액 ($)</label>
                <input ref={amountInputRef} type="text" placeholder="0" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold text-base outline-none focus:border-blue-500 shadow-sm" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPendingItem()} />
             </div>
             <div>
                <label className="text-lg font-black text-neutral-400 uppercase tracking-wider mb-4 block ml-1">4. 메모</label>
                <input type="text" placeholder="생일감사 등..." className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold text-sm outline-none focus:border-blue-500 shadow-sm" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPendingItem()} />
             </div>
          </div>

          <button onClick={addPendingItem} className="w-1/3 bg-sky-700 text-white py-3 rounded-xl text-base font-black hover:bg-sky-600 transition-all shadow-md active:scale-95"> 항목 추가 (Enter) </button>
        </section>

        <section className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[520px]">
          <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
             <h3 className="font-black text-neutral-400 text-lg uppercase tracking-tight">전송 대기 ({pendingItems.length})</h3>
             <button 
                onClick={handleFinalSubmit} 
                disabled={pendingItems.length === 0 || isSaving} 
                className={`flex items-center gap-2 px-5 py-2 rounded-lg font-black text-white-400 text-base shadow-sm transition-all ${isSaving ? 'bg-slate-100 text-slate-400' : 'bg-sky-700 text-white hover:bg-sky-600 active:scale-95'}`}
             >
                {isSaving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-database"></i>}
                {isSaving ? '저장 중...' : '저장 (Ctrl+Enter)'}
             </button>
          </div>
          <div className="p-3 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
             {pendingItems.length === 0 && <div className="h-full flex items-center justify-center text-slate-300 font-bold italic text-sm text-center">대기 중인 항목이 없습니다.</div>}
             {pendingItems.map(item => (
               <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <div className="flex items-center space-x-4">
                  <p className="text-sm font-black text-slate-400 uppercase">{item.offeringNumber ? `${item.offeringNumber}` : item.donorName}</p>
                  <p className="font-bold text-slate-700 text-sm">{item.offeringName} ({item.code})</p>
                  <p className="text-sm font-black text-sky-700">${item.amount.toLocaleString()}</p>
                </div>
                  <button onClick={() => setPendingItems(pendingItems.filter(i => i.id !== item.id))} className="text-slate-200 hover:text-red-500 transition-colors">
                     <i className="fa-solid fa-circle-minus text-xl"></i>
                  </button>
               </div>
             ))}
          </div>
        </section>

        <section className="lg:col-span-4 bg-white text-slate-800 p-6 rounded-2xl shadow-md flex flex-col h-[520px] border border-slate-200">
        {/* Header */}
        <h3 className="text-lg font-black text-neutral-400 uppercase mb-4"> 최종 저장 로그 <span className="font-medium">({date})</span> </h3>

        {/* List */}
        <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {dayReportSummary.length === 0 ? (
            <p className="text-slate-400 font-semibold italic text-center py-20 text-sm">
              기록이 없습니다.
            </p>
          ) : (
            dayReportSummary.map(([code, data]) => (
              <div
                key={code}
                className="rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sky-700 text-sm">
                    {offeringTypes.find(t => t.code === code)?.label || code}
                  </span>
                  <span className="font-black text-sm text-slate-900">
                    ${data.total.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {data.donors.join(', ')}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-slate-200 flex justify-between items-center">
          <span className="text-lx font-black text-slate-500 uppercase tracking-wide">
            일일 합계
          </span>
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            $
            {dayReportSummary
              .reduce((acc, curr) => acc + curr[1].total, 0)
              .toLocaleString()}
          </span>
        </div>
      </section>

      </div>
    </div>
  );
};

export default EntryPage;
