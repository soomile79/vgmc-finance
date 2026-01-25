
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

  const refreshData = useCallback(async () => {
    try {
      const dons = await storageService.getDonors();
      const offeringTypes = await storageService.getOfferingTypes();
      setDonors(dons);
      setCodes(offeringTypes);
      
      // DB에서 저장된 URL을 비동기로 로드
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
      // DB에 주소를 영구 저장
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

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                <tr><th className="px-6 py-4 w-32">번호</th><th className="px-6 py-4 w-48">성함</th><th className="px-6 py-4">비고</th><th className="px-6 py-4 text-center w-32">작업</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedAndFilteredDonors.map(donor => (
                  <tr key={donor.id} className="hover:bg-blue-50/20">
                    <td className="px-6 py-4">
                      {donor.offeringNumber ? <span className="bg-blue-600 text-white font-black px-2.5 py-1 rounded-lg text-sm">{donor.offeringNumber}</span> : <span className="text-slate-300 font-bold text-xs">없음</span>}
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800">{donor.name}</td>
                    <td className="px-6 py-4 text-xs text-slate-500 italic">{donor.note || '-'}</td>
                    <td className="px-6 py-4 text-center space-x-2">
                       <button onClick={() => { setEditingMember(donor); setIsMemberModalOpen(true); }} className="text-slate-400 hover:text-blue-600"><i className="fa-solid fa-pen"></i></button>
                       <button onClick={() => handleDeleteMember(donor.id)} className="text-slate-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'codes' && (
        <section className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
             <h3 className="font-black text-slate-800 uppercase tracking-tight">헌금 종류 관리</h3>
             <button onClick={() => { setEditingCode({ code: '', label: '' }); setIsCodeModalOpen(true); }} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black shadow-lg">항목 등록</button>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                <tr><th className="px-6 py-4">코드</th><th className="px-6 py-4">항목명</th><th className="px-6 py-4 text-center">작업</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {codes.map(c => (
                  <tr key={c.code} className="hover:bg-blue-50/20">
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{c.code}</td>
                    <td className="px-6 py-4 font-black text-slate-800">{c.label}</td>
                    <td className="px-6 py-4 text-center">
                       <button onClick={() => { setEditingCode(c); setIsCodeModalOpen(true); }} className="text-slate-400 hover:text-blue-600"><i className="fa-solid fa-pen"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              {googleSheetUrl && !isUrlLoading && (
                <div className="flex items-center gap-2 px-6 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 animate-in fade-in zoom-in duration-300">
                  <i className="fa-solid fa-globe"></i>
                  <span className="text-sm font-bold">클라우드 동기화 활성</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
            <h4 className="font-black text-blue-800 text-sm mb-2 uppercase tracking-tight">자동 연동 안내</h4>
            <ul className="text-xs text-blue-600/80 space-y-2 list-disc ml-4 font-medium">
              <li>이 주소는 데이터베이스(Cloud)에 저장되어 **어떤 기기에서 접속하든** 자동으로 공유됩니다.</li>
              <li>주소를 변경하면 모든 사용자의 시스템에 즉시 반영됩니다.</li>
              <li>배포(Deploy) 시 액세스 권한을 '모든 사용자(Anyone)'로 설정해야 브라우저에서 접근 가능합니다.</li>
            </ul>
          </div>
        </section>
      )}

      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <form onSubmit={handleSaveMember} className="bg-white rounded-[32px] w-full max-w-lg p-10 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">정보 수정/등록</h3>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">성함</label>
                <input required className={inputClass} value={editingMember?.name} onChange={e => setEditingMember({...editingMember!, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">헌금번호</label>
                <input className={inputClass} value={editingMember?.offeringNumber} onChange={e => setEditingMember({...editingMember!, offeringNumber: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">비고 (Note)</label>
                <input className={inputClass} value={editingMember?.note} onChange={e => setEditingMember({...editingMember!, note: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button type="button" onClick={() => setIsMemberModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black">취소</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 active:scale-95 transition-all">저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
