import React, { useState, useEffect, useMemo } from 'react';
import { storageService } from '../services/storageService';
import { OfferingType, BudgetRecord, OfferingRecord } from '../types';

const BudgetPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'summary' | 'master'>('summary');
  const [offeringTypes, setOfferingTypes] = useState<OfferingType[]>([]);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [records, setRecords] = useState<OfferingRecord[]>([]);
  // 사용자 전제조건인 2026년을 기본 연도로 설정
  const [selectedYear, setSelectedYear] = useState("2026");
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ category: '', code: '', label: '', amount: '' });

  // 현재 포커스 중인 입력 필드 트래킹 (콤마 없이 입력하기 위함)
  const [focusedCode, setFocusedCode] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    records.forEach(r => {
      const y = r.date.split('-')[0];
      if (y) years.add(y);
    });
    years.add("2026");
    years.add("2025");
    return Array.from(years).sort().reverse();
  }, [records]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [types, buds, recs] = await Promise.all([
        storageService.getOfferingTypes(),
        storageService.getBudgets(selectedYear),
        storageService.getRecords()
      ]);
      setOfferingTypes(types);
      setBudgets(buds);
      setRecords(recs);
    } finally { setLoading(false); }
  };

  useEffect(() => { refreshData(); }, [selectedYear]);

  const handleUpdateBudget = async (code: string, field: 'amount' | 'note', value: string) => {
    const currentBudget = budgets.find(b => b.code === code) || { year: selectedYear, code, amount: 0, note: '' };
    const updatedBudget = { ...currentBudget, [field]: field === 'amount' ? (parseFloat(value.replace(/,/g, '')) || 0) : value };
    await storageService.saveBudget(updatedBudget);
    setBudgets(budgets.map(b => b.code === code ? updatedBudget : b).concat(budgets.some(b => b.code === code) ? [] : [updatedBudget]));
  };

  const handleAddNewItem = async () => {
    if (!newItem.code || !newItem.label) return alert('항목 코드와 이름은 필수 입력 사항입니다.');
    await storageService.saveOfferingType({ code: newItem.code, label: newItem.label, category: newItem.category || '기타' });
    if (newItem.amount) await storageService.saveBudget({ year: selectedYear, code: newItem.code, amount: parseFloat(newItem.amount.replace(/,/g, '')) || 0 });
    setNewItem({ category: '', code: '', label: '', amount: '' });
    refreshData();
  };

  const budgetTableData = useMemo(() => {
    const yearRecords = records.filter(r => r.date.startsWith(selectedYear));
    // codes 테이블의 category 필드 기준 그룹화
    const categories = Array.from(new Set(offeringTypes.map(t => t.category || '기타')));
    
    return categories.map(cat => {
      // 일반 헌금에서 무명은 제외하는 필터링 로직 추가
      const items = offeringTypes
        .filter(t => t.category === cat)
        .filter(t => !(t.category === '일반 헌금' && t.label === '무명'))
        .map(type => {
          const budgetObj = budgets.find(b => b.code === type.code);
          const actual = yearRecords.filter(r => r.code === type.code).reduce((a, b) => a + b.amount, 0);
          return { type, budget: budgetObj?.amount || 0, actual, note: budgetObj?.note || '' };
        });
      
      return { category: cat, items, catBudget: items.reduce((a,b) => a+b.budget, 0), catActual: items.reduce((a,b) => a+b.actual, 0) };
    }).filter(cat => cat.items.length > 0);
  }, [offeringTypes, budgets, records, selectedYear]);

  const totalBudget = useMemo(() => budgetTableData.reduce((a, b) => a + b.catBudget, 0), [budgetTableData]);
  const totalActual = useMemo(() => budgetTableData.reduce((a, b) => a + b.catActual, 0), [budgetTableData]);

  const thClass = "px-2 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest text-center border-r border-slate-700 last:border-0";
  const cellClass = "px-3 py-3 text-[13px] border-r border-slate-100 last:border-0 align-middle font-bold";
  const addItemInputClass = "w-full bg-white border-2 border-slate-300 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 outline-none text-slate-900 shadow-sm";

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 font-bold animate-pulse">예산 데이터를 불러오는 중...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16 px-1 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{selectedYear} Budget & Allocation</h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Codes table 기반 자동 분류 시스템</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-slate-100 p-1 rounded-xl flex">
              <button onClick={() => setViewMode('summary')} className={`px-6 py-2 rounded-lg font-black text-xs transition-all ${viewMode === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>집계 현황</button>
              <button onClick={() => setViewMode('master')} className={`px-6 py-2 rounded-lg font-black text-xs transition-all ${viewMode === 'master' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>코드 등록</button>
           </div>
           <select className="px-4 py-2 border-2 border-slate-200 rounded-xl font-black bg-white text-slate-900 text-sm focus:border-blue-500 outline-none shadow-sm" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
             {availableYears.map(y => <option key={y} value={y}>{y}년도</option>)}
           </select>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
            <thead>
              <tr>
                <th className={`${thClass} w-[120px]`}>구분 (Category)</th>
                <th className={`${thClass} w-[180px]`}>헌금 항목 (Name)</th>
                <th className={`${thClass} w-[130px]`}>예산 ($)</th>
                <th className={`${thClass} w-[130px]`}>실제 수입 ($)</th>
                <th className={`${thClass} w-[80px]`}>달성률</th>
                <th className="px-2 py-4 bg-slate-900 text-white text-[10px] font-black uppercase text-center">비고</th>
              </tr>
            </thead>
            <tbody>
              {budgetTableData.map((cat, idx) => (
                <React.Fragment key={idx}>
                  {cat.items.map((item, iIdx) => (
                    <tr key={item.type.code} className="border-b border-slate-50 hover:bg-blue-50/20 transition-colors">
                      {iIdx === 0 && (
                        <td rowSpan={cat.items.length + 1} className="px-4 py-5 text-center font-black text-slate-800 bg-slate-50/50 border-r border-slate-200 align-middle text-[11px] uppercase tracking-wider">
                          {cat.category}
                        </td>
                      )}
                      <td className={`${cellClass} text-slate-700`}>{item.type.label}</td>
                      <td className={`${cellClass} text-right bg-white`}>
                        {/* 콤마 포맷팅이 적용된 입력 필드 */}
                        <div className="relative group">
                          <input 
                            type="text" 
                            className="w-full bg-white text-right font-black text-slate-900 outline-none border-b-2 border-transparent focus:border-blue-500 py-1 transition-all"
                            value={focusedCode === item.type.code ? (item.budget || '') : (item.budget ? item.budget.toLocaleString() : '')}
                            placeholder="0"
                            onFocus={() => setFocusedCode(item.type.code)}
                            onBlur={() => setFocusedCode(null)}
                            onChange={e => handleUpdateBudget(item.type.code, 'amount', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className={`${cellClass} text-right font-black text-blue-600`}>${item.actual.toLocaleString()}</td>
                      <td className={`${cellClass} text-center font-black ${item.budget > 0 && (item.actual/item.budget) >= 1 ? 'text-emerald-500' : 'text-slate-300'}`}>
                        {item.budget > 0 ? `${Math.round((item.actual / item.budget) * 100)}%` : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <input 
                          className="w-full px-2 py-1.5 border border-transparent focus:border-blue-100 focus:bg-blue-50 outline-none text-[12px] font-medium text-slate-400 bg-white placeholder:text-slate-200 rounded-lg"
                          placeholder="메모..."
                          value={item.note}
                          onChange={e => handleUpdateBudget(item.type.code, 'note', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/30 font-black text-slate-400 border-t border-b border-slate-100">
                    <td className="px-4 py-2 text-center text-[9px] uppercase tracking-widest">Category Subtotal</td>
                    <td className="px-4 py-2 text-right font-black text-slate-600 text-xs border-r border-slate-50">${cat.catBudget.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-black text-blue-600 text-xs border-r border-slate-50">${cat.catActual.toLocaleString()}</td>
                    <td className="px-4 py-2 text-center font-black text-slate-300 text-[10px] border-r border-slate-50">
                      {cat.catBudget > 0 ? `${Math.round((cat.catActual / cat.catBudget) * 100)}%` : '-'}
                    </td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </React.Fragment>
              ))}
              <tr className="bg-slate-900 text-white shadow-2xl">
                 <td colSpan={2} className="px-6 py-8 text-sm font-black text-center uppercase tracking-[0.3em] text-slate-500">Yearly Grand Total</td>
                 <td className="px-6 py-8 text-2xl font-black text-right border-r border-white/5">${totalBudget.toLocaleString()}</td>
                 <td className="px-6 py-8 text-2xl font-black text-blue-400 text-right border-r border-white/5">${totalActual.toLocaleString()}</td>
                 <td colSpan={2} className="px-6 py-8 text-right font-black text-slate-500 text-xs uppercase tracking-widest pr-12">
                   Avg Progress: {totalBudget > 0 ? Math.round((totalActual/totalBudget)*100) : 0}%
                 </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm p-12 space-y-12">
           <div>
              <h3 className="font-black text-slate-800 text-3xl tracking-tighter">Manage Offering Codes</h3>
              <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-xs">codes 테이블에 신규 항목을 추가하여 자동 분류 시스템을 확장하세요.</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end bg-slate-50 p-10 rounded-[40px] border border-slate-100">
              <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase ml-2 block mb-3 tracking-widest">Category (구분)</label>
                 <input className={addItemInputClass} placeholder="예: 헌금, 선교, 기타" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} />
              </div>
              <div className="w-40">
                 <label className="text-[10px] font-black text-slate-500 uppercase ml-2 block mb-3 tracking-widest">Code (번호)</label>
                 <input className={addItemInputClass} placeholder="11" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} />
              </div>
              <div className="flex-1">
                 <label className="text-[10px] font-black text-slate-500 uppercase ml-2 block mb-3 tracking-widest">Item Name (항목명)</label>
                 <input className={addItemInputClass} placeholder="예: 십일조" value={newItem.label} onChange={e => setNewItem({...newItem, label: e.target.value})} />
              </div>
              <button onClick={handleAddNewItem} className="bg-blue-600 text-white h-[72px] px-12 rounded-[24px] font-black text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">항목 추가</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default BudgetPage;
