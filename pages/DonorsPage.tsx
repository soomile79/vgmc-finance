
import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { Donor } from '../types';

const DonorsPage: React.FC = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDonor, setNewDonor] = useState({ name: '', offeringNumber: '', phone: '' });

  // Use async useEffect to await data fetching
  useEffect(() => {
    const loadDonors = async () => {
      setDonors(await storageService.getDonors());
    };
    loadDonors();
  }, []);

  const handleAddDonor = async () => {
    if (!newDonor.name) return;
    const donor: Donor = {
      id: Math.random().toString(36).substring(2, 11),
      name: newDonor.name,
      offeringNumber: newDonor.offeringNumber,
      phone: newDonor.phone
    };
    await storageService.saveDonor(donor);
    setDonors([...donors, donor]);
    setNewDonor({ name: '', offeringNumber: '', phone: '' });
    setIsModalOpen(false);
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">교인 명단 관리</h2>
          <p className="text-slate-500">헌금번호 및 연락처를 관리합니다.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-user-plus"></i>
          <span>교인 등록</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">헌금 번호</th>
              <th className="px-6 py-4">이름</th>
              <th className="px-6 py-4">연락처</th>
              <th className="px-6 py-4 text-center">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {donors.map((donor) => (
              <tr key={donor.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  {donor.offeringNumber ? (
                    <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm">{donor.offeringNumber}</span>
                  ) : (
                    <span className="text-slate-300">없음</span>
                  )}
                </td>
                <td className="px-6 py-4 font-bold text-slate-800">{donor.name}</td>
                <td className="px-6 py-4 text-slate-600">{donor.phone || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <button className="text-slate-400 hover:text-blue-600 p-2">
                    <i className="fa-solid fa-pen-to-square"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">새 교인 등록</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">이름 *</label>
                <input 
                  type="text" 
                  className={inputClass}
                  value={newDonor.name}
                  onChange={e => setNewDonor({...newDonor, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">헌금번호</label>
                <input 
                  type="text" 
                  className={inputClass}
                  value={newDonor.offeringNumber}
                  onChange={e => setNewDonor({...newDonor, offeringNumber: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">연락처</label>
                <input 
                  type="text" 
                  className={inputClass}
                  value={newDonor.phone}
                  onChange={e => setNewDonor({...newDonor, phone: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleAddDonor}
                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
              >
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonorsPage;