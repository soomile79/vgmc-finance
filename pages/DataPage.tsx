import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { OfferingRecord, Donor, OfferingType } from '../types';

type SortKey = 'date' | 'offeringNumber' | 'code' | 'amount';
type SortOrder = 'asc' | 'desc';

const DataPage: React.FC = () => {
  const [records, setRecords] = useState<OfferingRecord[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [offeringTypes, setOfferingTypes] = useState<OfferingType[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [editingRecord, setEditingRecord] = useState<OfferingRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditModalOpen(false);
        setEditingRecord(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    const initMetadata = async () => {
      try {
        const years = await storageService.getYearRange();
        setAvailableYears(years);
        if (years.length > 0) {
          setFilterYear(years[0]);
        }
      } catch (err) {
        console.error("연도 로드 실패:", err);
      }
    };
    initMetadata();
  }, []);

  const refreshData = useCallback(async () => {
    if (!filterYear) return;

    try {
      const recs = await storageService.getRecords(filterYear, filterMonth); 
      setRecords(recs);
      
      const [d, t] = await Promise.all([
        storageService.getDonors(),
        storageService.getOfferingTypes()
      ]);
      setDonors(d);
      setOfferingTypes(t);
      setPendingCount(storageService.getPendingSyncIds().length);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    }
  }, [filterYear, filterMonth]); 

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const filteredRecords = useMemo(() => {
    return records
      .filter(r => {
        const searchTerm = filterSearch.trim().toLowerCase();
        if (searchTerm === '') return true;

        const matchName = (r.donorName || '').toLowerCase().includes(searchTerm);
        const matchNumber = (r.offeringNumber || '').toString().includes(searchTerm); 
        const matchNote = (r.note || '').toLowerCase().includes(searchTerm);
        const matchType = (r.offeringName || '').toLowerCase().includes(searchTerm);

        return matchName || matchNumber || matchNote || matchType;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortKey === 'date') comp = a.date.localeCompare(b.date);
        else if (sortKey === 'offeringNumber') {
          const numA = parseInt(a.offeringNumber?.toString() || '99999');
          const numB = parseInt(b.offeringNumber?.toString() || '99999');
          comp = numA - numB;
        }
        else if (sortKey === 'code') comp = (a.code || '').localeCompare(b.code || '');
        else if (sortKey === 'amount') comp = a.amount - b.amount;
        
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [records, filterSearch, sortKey, sortOrder]);

  const totalAmount = useMemo(() => {
    return filteredRecords.reduce((sum, record) => sum + record.amount, 0);
  }, [filteredRecords]);

  const exportToCSV = () => {
    if (filteredRecords.length === 0) return alert('내보낼 데이터가 없습니다.');
    const headers = ['날짜', '코드', '항목명', '번호', '성도명', '금액', '메모'];
    const rows = filteredRecords.map(r => [
      r.date, 
      r.code, 
      r.offeringName, 
      r.offeringNumber || '', 
      r.donorName, 
      r.amount.toString(), 
      (r.note || '').replace(/,/g, ' ')
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `헌금내역_${filterYear}년_${filterMonth || '전체'}월.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (window.confirm('정말로 이 내역을 삭제하시겠습니까?')) {
      try {
        await storageService.deleteRecord(id);
        setRecords(prev => prev.filter(r => String(r.id) !== String(id)));
        setPendingCount(storageService.getPendingSyncIds().length);
      } catch (err) {
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    try {
      await storageService.updateRecord(editingRecord);
      setIsEditModalOpen(false);
      setEditingRecord(null);
      await refreshData();
      alert('수정되었습니다.');
    } catch (err) {
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  const handleManualSync = async () => {
    const pendingIds = storageService.getPendingSyncIds();
    if (pendingIds.length === 0) return alert('동기화할 내용이 없습니다.');
    setIsSyncing(true);
    try {
      const pendingRecords = await storageService.getRecords(undefined, undefined, pendingIds);
      await storageService.syncToGoogleSheets(pendingRecords);
      setPendingCount(0);
      alert('구글 시트 동기화 완료');
    } catch (err) {
      alert('동기화 오류 발생');
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('asc'); }
  };

  const labelStyle = "text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block";
  const inputStyle = "w-full px-5 py-3 rounded-xl border-2 border-slate-100 font-bold outline-none focus:border-blue-500 transition-all text-sm";

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 px-4">
      {/* 상단 컨트롤 바 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm gap-6 print:hidden">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">통합 데이터베이스</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-400">데이터를 필터링하고 분석할 수 있습니다.</p>
            {filteredRecords.length > 0 && (
              <span className="bg-sky-700 text-white px-3 py-1 rounded-lg text-sm font-black flex items-center gap-2">
                <span>{filteredRecords.length}건</span>
                <span className="opacity-30">|</span>
                <span>${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={exportToCSV} className="px-5 py-2.5 rounded-xl font-black text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2">
            <i className="fa-solid fa-file-excel"></i> CSV
          </button>
          
          <button onClick={handleManualSync} disabled={isSyncing || pendingCount === 0} className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all relative ${pendingCount > 0 ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
            <i className="fa-solid fa-cloud-arrow-up"></i> {isSyncing ? '동기화 중' : '시트 동기화'}
            {pendingCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full animate-bounce">{pendingCount}</span>}
          </button>

          <div className="flex gap-2">
            <select className="px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-xs bg-white outline-none focus:border-blue-500" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
               {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select className="px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-xs bg-white outline-none focus:border-blue-500" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
               <option value="">전체 월</option>
               {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => (
                 <option key={m} value={m}>{m}월</option>
               ))}
            </select>
          </div>
          
          <div className="relative">
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <input type="text" placeholder="검색어 입력..." className="pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500 w-[200px]" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 테이블 섹션 */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[1000px]">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b cursor-pointer hover:text-blue-500" onClick={() => toggleSort('date')}>날짜 {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b cursor-pointer hover:text-blue-500" onClick={() => toggleSort('code')}>코드 {sortKey === 'code' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b">항목명</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b cursor-pointer hover:text-blue-500" onClick={() => toggleSort('offeringNumber')}>번호 {sortKey === 'offeringNumber' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b">성도명</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b text-right cursor-pointer hover:text-blue-500" onClick={() => toggleSort('amount')}>금액 ($) {sortKey === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b">메모</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b text-center">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredRecords.length === 0 ? (
              <tr><td colSpan={8} className="py-20 text-center font-bold text-slate-300 italic">내역이 없습니다.</td></tr>
            ) : filteredRecords.map(r => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-all group">
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{r.date}</td>
                <td className="px-6 py-4 font-mono text-blue-500 font-black">{r.code}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.offeringName}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{r.offeringNumber || <span className="text-slate-200">무</span>}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{r.donorName}</td>
                <td className="px-6 py-4 text-right font-black text-slate-900">${r.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td className="px-6 py-4 text-xs text-slate-400 italic truncate max-w-[150px]">{r.note || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center gap-4">
                    <button onClick={() => { setEditingRecord(r); setIsEditModalOpen(true); }} className="text-slate-300 hover:text-blue-600 transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                    <button onClick={() => handleDelete(r.id)} className="text-slate-300 hover:text-red-600 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filteredRecords.length > 0 && (
            <tfoot className="bg-sky-800 text-white">
              <tr>
                <td colSpan={5} className="px-6 py-5 text-base font-black text-white text-right uppercase tracking-wide">
                  총 합 :
                </td>
                <td className="px-6 py-5 text-right font-black text-xl">
                  ${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 수정 모달 */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6" onClick={() => setIsEditModalOpen(false)}>
          <form onSubmit={handleUpdate} className="bg-white rounded-[40px] w-full max-w-xl p-10 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">상세 내역 수정</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className={labelStyle}>날짜</label>
                <input type="date" required className={inputStyle} value={editingRecord.date} onChange={e => setEditingRecord({...editingRecord, date: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className={labelStyle}>금액 ($)</label>
                <input type="number" step="any" required className={`${inputStyle} text-right`} value={editingRecord.amount} onChange={e => setEditingRecord({...editingRecord, amount: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="col-span-1">
                <label className={labelStyle}>코드</label>
                <input type="text" className={inputStyle} value={editingRecord.code} onChange={e => setEditingRecord({...editingRecord, code: e.target.value.toUpperCase()})} />
              </div>
              <div className="col-span-1">
                <label className={labelStyle}>항목명</label>
                <input type="text" className={inputStyle} value={editingRecord.offeringName} onChange={e => setEditingRecord({...editingRecord, offeringName: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className={labelStyle}>헌금번호</label>
                <input type="text" className={inputStyle} value={editingRecord.offeringNumber || ''} onChange={e => setEditingRecord({...editingRecord, offeringNumber: e.target.value})} />
              </div>
              <div className="col-span-1">
                <label className={labelStyle}>성도명</label>
                <input type="text" className={inputStyle} value={editingRecord.donorName} onChange={e => setEditingRecord({...editingRecord, donorName: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className={labelStyle}>메모</label>
                <input type="text" className={inputStyle} value={editingRecord.note || ''} onChange={e => setEditingRecord({...editingRecord, note: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black transition-colors hover:bg-slate-200">취소</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 active:scale-95 transition-all">저장하기</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default DataPage;
