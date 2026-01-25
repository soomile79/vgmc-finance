
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { OfferingRecord, Donor, OfferingType } from '../types';

type SortKey = 'date' | 'offeringNumber' | 'code';
type SortOrder = 'asc' | 'desc';

const DataPage: React.FC = () => {
  const [records, setRecords] = useState<OfferingRecord[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [offeringTypes, setOfferingTypes] = useState<OfferingType[]>([]);
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterSearch, setFilterSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [editingRecord, setEditingRecord] = useState<OfferingRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshData = useCallback(async () => {
    try {
      const recs = await storageService.getRecords();
      setRecords(recs);
      setDonors(await storageService.getDonors());
      setOfferingTypes(await storageService.getOfferingTypes());
      setPendingCount(storageService.getPendingSyncIds().length);
    } catch (err) {
      console.error("Data Load Failed:", err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (window.confirm('정말로 이 내역을 삭제하시겠습니까? DB에서 즉시 삭제됩니다.')) {
      try {
        await storageService.deleteRecord(id);
        
        // 로컬 상태 즉시 반영
        setRecords(prev => prev.filter(r => String(r.id) !== String(id)));
        
        // 동기화 대기 목록 처리
        const pending = storageService.getPendingSyncIds();
        if (pending.includes(id)) {
          const nextPending = pending.filter(p => p !== id);
          localStorage.setItem('pending_sync_ids', JSON.stringify(nextPending));
          setPendingCount(nextPending.length);
        }
        console.log(`Deleted record: ${id}`);
      } catch (err) {
        console.error("Deletion Failed:", err);
        alert('삭제 중 오류가 발생했습니다.');
        refreshData(); 
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
      alert('성공적으로 수정되었습니다.');
    } catch (err) {
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  const handleManualSync = async () => {
    const pendingIds = storageService.getPendingSyncIds();
    if (pendingIds.length === 0) return alert('동기화할 내용이 없습니다.');
    setIsSyncing(true);
    try {
      const pendingRecords = await storageService.getRecords(pendingIds);
      await storageService.syncToGoogleSheets(pendingRecords);
      setPendingCount(0);
      alert('구글 시트 동기화가 완료되었습니다.');
    } catch (err) {
      alert('동기화 중 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('asc'); }
  };

  const filteredRecords = useMemo(() => {
    let result = records.filter(r => {
      if (!r.date) return false;
      const matchYear = filterYear === '' || r.date.startsWith(filterYear);
      const matchSearch = filterSearch === '' || 
        (r.donorName || '').toLowerCase().includes(filterSearch.toLowerCase()) || 
        (r.offeringNumber || '').includes(filterSearch) ||
        (r.note || '').toLowerCase().includes(filterSearch.toLowerCase());
      return matchYear && matchSearch;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'date') comparison = a.date.localeCompare(b.date);
      else if (sortKey === 'offeringNumber') comparison = (parseInt(a.offeringNumber) || 99999) - (parseInt(b.offeringNumber) || 99999);
      else if (sortKey === 'code') comparison = (a.code || '').localeCompare(b.code || '');
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [records, filterYear, filterSearch, sortKey, sortOrder]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    records.forEach(r => years.add(r.date.split('-')[0]));
    years.add(new Date().getFullYear().toString());
    return Array.from(years).sort().reverse();
  }, [records]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 px-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm gap-6 print:hidden">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">수입 통합 데이터베이스</h2>
          <p className="text-sm font-medium text-slate-400">전체 기부 내역을 조회, 수정, 영구 삭제할 수 있습니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleManualSync} disabled={isSyncing || pendingCount === 0} className={`px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all relative ${pendingCount > 0 ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
            <i className="fa-solid fa-cloud-arrow-up"></i> 시트 동기화
            {pendingCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full animate-bounce">{pendingCount}</span>}
          </button>
          <select className="px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm bg-white outline-none focus:border-blue-500" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
             <option value="">전체 연도</option>
             {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <div className="relative">
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <input type="text" placeholder="이름/번호/메모 검색" className="pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[1000px]">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b cursor-pointer hover:text-blue-500" onClick={() => toggleSort('date')}>날짜 {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b">코드</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b">항목명</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b cursor-pointer hover:text-blue-500" onClick={() => toggleSort('offeringNumber')}>번호</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b">성도명</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b text-right">금액 ($)</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b">메모</th>
              <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 border-b text-center">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredRecords.length === 0 ? (
              <tr><td colSpan={8} className="py-20 text-center font-bold text-slate-300 italic">조회된 내역이 없습니다.</td></tr>
            ) : filteredRecords.map(r => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-all group">
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{r.date}</td>
                <td className="px-6 py-4 font-mono text-blue-500 font-black">{r.code}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.offeringName}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{r.offeringNumber || '-'}</td>
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
        </table>
      </div>

      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <form onSubmit={handleUpdate} className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">상세 내역 수정</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">날짜</label>
                   <input type="date" className="w-full px-5 py-3 rounded-xl border-2 border-slate-100 font-bold outline-none focus:border-blue-500" value={editingRecord.date} onChange={e => setEditingRecord({...editingRecord, date: e.target.value})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">코드</label>
                   <input type="text" className="w-full px-5 py-3 rounded-xl border-2 border-slate-100 font-bold outline-none focus:border-blue-500" value={editingRecord.code} onChange={e => setEditingRecord({...editingRecord, code: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">금액 ($)</label>
                 <input type="number" step="any" className="w-full px-5 py-3 rounded-xl border-2 border-slate-100 font-bold outline-none text-right focus:border-blue-500" value={editingRecord.amount} onChange={e => setEditingRecord({...editingRecord, amount: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">메모</label>
                 <input type="text" className="w-full px-5 py-3 rounded-xl border-2 border-slate-100 font-bold outline-none focus:border-blue-500" value={editingRecord.note || ''} onChange={e => setEditingRecord({...editingRecord, note: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black">취소</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 active:scale-95 transition-all">변경 사항 저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default DataPage;
