import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { Donor, OfferingType } from '../types';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'codes' | 'sync'>('members');
  const [donors, setDonors] = useState<Donor[]>([]);
  const [codes, setCodes] = useState<OfferingType[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [showNoNumberOnly, setShowNoNumberOnly] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Donor | null>(null);
  const [editingCode, setEditingCode] = useState<OfferingType | null>(null);

  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // ESC 키 이벤트 핸들러
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMemberModalOpen(false);
        setIsCodeModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const dons = await storageService.getDonors();
      const offeringTypes = await storageService.getOfferingTypes();
      setDonors(dons);
      setCodes(offeringTypes);
      
      setIsUrlLoading(true);
      const savedUrl = await storageService.fetchGoogleSheetUrl();
      setGoogleSheetUrl(savedUrl);
      setIsUrlLoading(false);
    } catch (err) {
      console.error("Refresh Settings Data Error:", err);
      setIsUrlLoading(false);
    }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  const sortedAndFilteredDonors = useMemo(() => {
    return donors.filter(d => {
      const matchSearch = d.name.toLowerCase().includes(memberSearch.toLowerCase()) || (d.offeringNumber && d.offeringNumber.includes(memberSearch));
      const matchNoNumber = showNoNumberOnly ? !d.offeringNumber || d.offeringNumber.trim() === '' : true;
      return matchSearch && matchNoNumber;
    }).sort((a,b) => {
      const numA = parseInt(a.offeringNumber || '99999');
      const numB = parseInt(b.offeringNumber || '99999');
      return numA - numB || a.name.localeCompare(b.name);
    });
  }, [donors, memberSearch, showNoNumberOnly]);

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    // 1. 중복 체크
    const duplicateName = donors.find(d => 
      d.id !== editingMember.id && d.name.trim() === editingMember.name.trim()
    );
    
    const duplicateNumber = donors.find(d => 
      d.id !== editingMember.id && 
      editingMember.offeringNumber && // 입력한 번호가 있고
      editingMember.offeringNumber.trim() !== '' && 
      d.offeringNumber === editingMember.offeringNumber.trim() // 기존 번호와 일치할 때
    );

    // 2. 경고 및 확인 (Confirm) 로직
    if (duplicateName) {
      // 이름이 중복된 경우
      if (!window.confirm(`이미 '${editingMember.name}' 성도님이 등록되어 있습니다.\n동명이인으로 추가 등록하시겠습니까?`)) {
        return; // '취소' 클릭 시 중단
      }
    } else if (duplicateNumber) {
      // 번호만 중복된 경우 (가족 공유 등)
      if (!window.confirm(`[${editingMember.offeringNumber}]번은 이미 '${duplicateNumber.name}' 성도님이 사용 중입니다.\n가족 공유 번호로 등록하시겠습니까?`)) {
        return; // '취소' 클릭 시 중단
      }
    }

    // 3. 저장 진행 (사용자가 확인을 눌렀거나 중복이 없는 경우)
    try {
      await storageService.saveDonor(editingMember);
      setIsMemberModalOpen(false);
      setEditingMember(null);
      await refreshData();
    } catch (err) {
      alert("성도 정보 저장 중 오류가 발생했습니다.");
    }
  };

  const handleSaveCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCode) return;
    try {
      await storageService.saveOfferingType(editingCode);
      setIsCodeModalOpen(false);
      setEditingCode(null);
      await refreshData();
    } catch (err) {
      alert("코드 저장 중 오류가 발생했습니다.");
    }
  };

  const handleSaveSyncUrl = async () => {
    if (!googleSheetUrl.trim()) return alert("주소를 입력해주세요.");
    setSaveStatus('saving');
    try {
      await storageService.saveGoogleSheetUrl(googleSheetUrl);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      alert("주소 저장에 실패했습니다.");
      setSaveStatus('idle');
    }
  };

  const handleDeleteMember = async (id: string) => {
    if(window.confirm('이 교인을 삭제(비활성화)하시겠습니까?')) {
      try {
        await storageService.deleteDonor(id);
        setDonors(prev => prev.filter(d => d.id !== id));
        alert("삭제되었습니다.");
      } catch (err) {
        alert("삭제 중 오류가 발생했습니다.");
        refreshData();
      }
    }
  };

  const duplicateWarning = useMemo(() => {
  if (!editingMember || !editingMember.name) return null;
  const found = donors.find(d => 
    d.id !== editingMember.id && 
    (d.name === editingMember.name || (editingMember.offeringNumber && d.offeringNumber === editingMember.offeringNumber))
  );
  return found ? `이미 존재함: ${found.name}(${found.offeringNumber || '번호없음'})` : null;
}, [editingMember, donors]);

  const inputClass = "w-full px-5 py-4 rounded-2xl border-2 border-slate-300 bg-white text-slate-900 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-bold placeholder:text-slate-400";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">시스템 설정</h2>
          <p className="text-sm text-slate-500 font-medium">관리자 전용 설정 메뉴입니다.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('members')} className={`px-4 py-2 rounded-lg text-xs font-bold ${activeTab === 'members' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>성도 관리</button>
          <button onClick={() => setActiveTab('codes')} className={`px-4 py-2 rounded-lg text-xs font-bold ${activeTab === 'codes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>코드 관리</button>
          <button onClick={() => setActiveTab('sync')} className={`px-4 py-2 rounded-lg text-xs font-bold ${activeTab === 'sync' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>시트 연동</button>
        </div>
      </div>

      {activeTab === 'members' && (
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex gap-4 w-full md:w-auto items-center">
              <input 
                type="text" 
                placeholder="이름/번호로 검색..." 
                className="px-6 py-2 border-2 border-slate-300 bg-white text-slate-900 rounded-xl focus:border-blue-500 outline-none min-w-[300px] text-sm font-bold"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={showNoNumberOnly} onChange={e => setShowNoNumberOnly(e.target.checked)} />
                <span className="text-sm font-black text-slate-600">무번호만</span>
              </label>
            </div>
            <button onClick={() => { setEditingMember({ id: Math.random().toString(36).substring(2, 11), name: '', offeringNumber: '', note: '' }); setIsMemberModalOpen(true); }} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black shadow-lg">새 성도 등록</button>
          </div>

          {/* 수정된 부분: 4컬럼 그리드 형식의 심플 리스트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {sortedAndFilteredDonors.map(donor => (
              <div key={donor.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="w-6 font-black text-blue-600 text-sm shrink-0">{donor.offeringNumber || '-'}</span>
                  <span className="font-bold text-slate-800 shrink-0">{donor.name}</span>
                  <span className="text-slate-400 text-xs truncate italic">{donor.note}</span>
                </div>
                <div className="flex gap-3 ml-2 shrink-0">
                  <button onClick={() => { setEditingMember(donor); setIsMemberModalOpen(true); }} className="text-slate-400 hover:text-blue-600"><i className="fa-solid fa-pen text-xs"></i></button>
                  <button onClick={() => handleDeleteMember(donor.id)} className="text-slate-400 hover:text-red-600"><i className="fa-solid fa-trash text-xs"></i></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'codes' && (
        <section className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
             <h3 className="font-black text-slate-800 uppercase tracking-tight">헌금 종류 관리</h3>
             <button onClick={() => { setEditingCode({ code: '', label: '' }); setIsCodeModalOpen(true); }} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black shadow-lg">항목 등록</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {codes.map(c => (
              <div key={c.code} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-blue-300 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-mono font-black border border-blue-100">
                    {c.code}
                  </div>
                  <div>
                    <div className="font-black text-slate-800">{c.label}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CODE: {c.code}</div>
                  </div>
                </div>
                <button onClick={() => { setEditingCode(c); setIsCodeModalOpen(true); }} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center">
                  <i className="fa-solid fa-pen text-xs"></i>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'sync' && (
        <section className="bg-white p-12 rounded-[40px] border border-slate-200 shadow-sm space-y-8 animate-in slide-in-from-bottom-5">
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cloud Google Sheets Sync</h3>
            <p className="text-slate-500 font-medium mt-2">입력된 헌금 데이터를 실시간으로 구글 시트에 기록합니다. (클라우드 저장 방식)</p>
          </div>
          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 space-y-6">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">Apps Script Webhook URL</label>
              <div className="relative">
                <input 
                  disabled={isUrlLoading}
                  className={`${inputClass} ${isUrlLoading ? 'opacity-50 animate-pulse' : ''}`} 
                  placeholder={isUrlLoading ? "서버에서 정보를 불러오는 중..." : "https://script.google.com/macros/s/.../exec"} 
                  value={googleSheetUrl}
                  onChange={e => {
                    setGoogleSheetUrl(e.target.value);
                    setSaveStatus('idle');
                  }}
                />
                {isUrlLoading && (
                  <div className="absolute right-6 top-1/2 -translate-y-1/2">
                    <i className="fa-solid fa-spinner animate-spin text-blue-500"></i>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={handleSaveSyncUrl}
                disabled={saveStatus === 'saving' || isUrlLoading}
                className={`min-w-[240px] px-8 py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
                  saveStatus === 'success' 
                    ? 'bg-emerald-500 text-white shadow-emerald-100' 
                    : saveStatus === 'saving'
                      ? 'bg-slate-300 text-slate-500'
                      : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'
                }`}
              >
                {saveStatus === 'saving' && <i className="fa-solid fa-spinner animate-spin"></i>}
                {saveStatus === 'success' && <i className="fa-solid fa-check"></i>}
                {saveStatus === 'idle' && '서버에 저장 및 전체 동기화'}
                {saveStatus === 'saving' && 'DB 저장 중...'}
                {saveStatus === 'success' && '클라우드 저장 완료'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 모달 영역 */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={() => setIsMemberModalOpen(false)}>
          <form onSubmit={handleSaveMember} className="bg-white rounded-[32px] w-full max-w-lg p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">정보 수정/등록</h3>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">이름</label>
                <input required className={inputClass} value={editingMember?.name || ''} onChange={e => setEditingMember({...editingMember!, name: e.target.value})} autoFocus />
                {duplicateWarning && <p className="text-red-500 text-xs font-bold mt-1">{duplicateWarning}</p>}
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">헌금번호</label>
                <input className={inputClass} value={editingMember?.offeringNumber || ''} onChange={e => setEditingMember({...editingMember!, offeringNumber: e.target.value})} />
                
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">비고 (Note)</label>
                <input className={inputClass} value={editingMember?.note || ''} onChange={e => setEditingMember({...editingMember!, note: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button type="button" onClick={() => setIsMemberModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black">취소 (ESC)</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 active:scale-95 transition-all">저장</button>
            </div>
          </form>
        </div>
      )}

      {isCodeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={() => setIsCodeModalOpen(false)}>
          <form onSubmit={handleSaveCode} className="bg-white rounded-[32px] w-full max-w-lg p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">헌금 종류 수정/등록</h3>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">코드 (예: T, G, M)</label>
                <input required className={inputClass} value={editingCode?.code || ''} onChange={e => setEditingCode({...editingCode!, code: e.target.value.toUpperCase()})} autoFocus />
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">항목명 (Label)</label>
                <input required className={inputClass} value={editingCode?.label || ''} onChange={e => setEditingCode({...editingCode!, label: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button type="button" onClick={() => setIsCodeModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black">취소 (ESC)</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 active:scale-95 transition-all">저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
