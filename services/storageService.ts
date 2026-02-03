import { supabase } from './supabaseClient';
import { Donor, OfferingRecord, OfferingType, BudgetRecord } from '../types';

export const storageService = {
  // 1. DB에서 구글 시트 URL 가져오기
  fetchGoogleSheetUrl: async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'google_sheet_webhook_url')
        .maybeSingle();
      
      if (error) throw error;
      return data?.value || localStorage.getItem('google_sheet_webhook_url') || '';
    } catch (err) {
      console.error("DB URL Fetch Error:", err);
      return localStorage.getItem('google_sheet_webhook_url') || '';
    }
  },

  // 2. DB에 구글 시트 URL 저장하기
  saveGoogleSheetUrl: async (url: string) => {
    const cleanUrl = url.trim();
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'google_sheet_webhook_url', value: cleanUrl });
      
      if (error) throw error;
      localStorage.setItem('google_sheet_webhook_url', cleanUrl);
      return true;
    } catch (err) {
      console.error("DB URL Save Error:", err);
      localStorage.setItem('google_sheet_webhook_url', cleanUrl);
      throw err;
    }
  },

  // 3. 동기화 대기 관리
  getPendingSyncIds: (): string[] => JSON.parse(localStorage.getItem('pending_sync_ids') || '[]'),
  addPendingSyncIds: (ids: string[]) => {
    const current = storageService.getPendingSyncIds();
    const next = Array.from(new Set([...current, ...ids]));
    localStorage.setItem('pending_sync_ids', JSON.stringify(next));
  },
  clearPendingSyncIds: () => localStorage.removeItem('pending_sync_ids'),

  // 4. 구글 시트 동기화
  syncToGoogleSheets: async (records: OfferingRecord[]) => {
    const url = await storageService.fetchGoogleSheetUrl();
    if (!url || records.length === 0) {
      throw new Error("연동된 구글 시트 주소가 없습니다. 시스템 설정에서 먼저 등록해주세요.");
    }

    const payload = records.map(r => ({
      Date: r.date,
      Code: r.code,
      Description: r.offeringName || '',
      NameID: r.offeringNumber || '',
      Name: r.donorName || '익명',
      Amount: r.amount,
      Remarks: r.note || ''
    }));

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      storageService.clearPendingSyncIds();
      return true;
    } catch (err) {
      console.error("Google Sheets Sync Error:", err);
      throw err;
    }
  },

  // 5. DB 기반 실제 존재하는 연도 목록 추출 (최신순)
  getYearRange: async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('donate_at')
        .order('donate_at', { ascending: false });
      
      if (error) throw error;
      
      const years = Array.from(new Set(data.map(d => d.donate_at?.substring(0, 4))))
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a));
        
      return years.length > 0 ? years : [new Date().getFullYear().toString()];
    } catch (err) {
      console.error("Year Range Fetch Error:", err);
      return [new Date().getFullYear().toString()];
    }
  },

  // 6. DB 뷰(donation_monthly)에서 월별 통계 가져오기 (대시보드 성능 최적화)
  getMonthlyStatsFromView: async (year: string): Promise<{month: string, total: number}[]> => {
    const { data, error } = await supabase
      .from('donation_monthly')
      .select('month, total')
      .eq('year', parseInt(year))
      .order('month', { ascending: true });
    
    if (error) {
      console.error(`Monthly Stats Fetch Error (${year}):`, error);
      return [];
    }
    return data.map(d => ({ 
      month: d.month.toString().padStart(2, '0'), // "1" -> "01" 형식 통일
      total: typeof d.total === 'string' ? parseFloat(d.total) : (d.total || 0) 
    }));
  },

  // 7. 헌금 상세 내역 가져오기 (⭐ 1,000건 제한 해결 및 중복 ID 제거)
  getRecords: async (year?: string, month?: string, ids?: string[]): Promise<OfferingRecord[]> => {
    let allRawData: any[] = [];
    const pageSize = 1000;
    let page = 0;

    if (ids && ids.length > 0) {
      const numericIds = ids.map(id => isNaN(Number(id)) ? id : Number(id));
      const { data, error } = await supabase
        .from('donations')
        .select('*, members(name, member_no), codes(name)')
        .in('id', numericIds);
      if (error) throw error;
      allRawData = data || [];
    } else {
      let hasMore = true;
      while (hasMore) {
        let query = supabase
          .from('donations')
          .select('*, members(name, member_no), codes(name)')
          .order('donate_at', { ascending: false })
          .order('id', { ascending: false }) // 정렬 기준 고정 (중복 방지 핵심)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (year) {
          if (month && month !== "") {
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            query = query.gte('donate_at', `${year}-${month}-01`).lte('donate_at', `${year}-${month}-${lastDay}`);
          } else {
            query = query.gte('donate_at', `${year}-01-01`).lte('donate_at', `${year}-12-31`);
          }
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allRawData = [...allRawData, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
        if (page > 30) hasMore = false; // 최대 3만 건 안전장치
      }
    }

    // ⭐ 클라이언트 측에서 한 번 더 ID 중복 제거 (React Key 에러 방지)
    const uniqueMap = new Map();
    allRawData.forEach(d => {
      if (d.id) uniqueMap.set(d.id.toString(), d);
    });
    
    return Array.from(uniqueMap.values()).map((d: any) => ({
      id: d.id.toString(),
      date: d.donate_at || '',
      donorId: d.member_id?.toString() || '',
      offeringNumber: d.members?.member_no?.toString() || d.member_no?.toString() || '',
      donorName: d.members?.name || d.member_name || '익명',
      code: d.donation_code,
      amount: typeof d.amount === 'string' ? parseFloat(d.amount.replace(/[^0-9.-]+/g, "")) : (d.amount || 0),
      note: d.note,
      offeringName: d.codes?.name || `코드 ${d.donation_code}`
    }));
  },

  // 8. 내역 추가
  addRecords: async (records: any[]) => {
    const payloads = [];
    for (const r of records) {
      let mId: number | null = parseInt(r.donorId);
      if (isNaN(mId) && r.donorName && r.donorName !== '익명') {
        const { data: existing } = await supabase.from('members').select('id').eq('name', r.donorName).eq('is_active', true).maybeSingle();
        if (existing) mId = existing.id;
        else {
          const { data: newMember } = await supabase.from('members').insert({ name: r.donorName, is_active: true }).select('id').single();
          if (newMember) mId = newMember.id;
        }
      }
      let amt = typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount).replace(/[^0-9.-]+/g, ""));
      payloads.push({
        member_id: isNaN(mId as number) ? null : mId,
        member_no: r.offeringNumber || null,
        member_name: r.donorName || '',
        donation_code: r.code ? r.code.toString() : null,
        amount: isNaN(amt) ? 0 : amt,
        donate_at: r.date,
        note: r.note || ''
      });
    }
    
    const { data, error } = await supabase.from('donations').insert(payloads).select('id');
    if (error) throw error;
    if (data) storageService.addPendingSyncIds(data.map(d => d.id.toString()));
  },

  // 9. 내역 수정/삭제
  updateRecord: async (record: OfferingRecord) => {
    const targetId = isNaN(Number(record.id)) ? record.id : Number(record.id);
    const { error } = await supabase
      .from('donations')
      .update({
        donate_at: record.date,
        donation_code: record.code,
        amount: record.amount,
        note: record.note,
        member_name: record.donorName,
        member_no: record.offeringNumber || null
      })
      .eq('id', targetId);
    if (error) throw error;
  },

  deleteRecord: async (id: string) => {
    const targetId = isNaN(Number(id)) ? id : Number(id);
    const { error } = await supabase.from('donations').delete().eq('id', targetId); 
    if (error) throw error;
  },

  // 10. 마스터 데이터 관리 (성도/코드)
  getOfferingTypes: async (): Promise<OfferingType[]> => {
    const { data, error } = await supabase.from('codes').select('*').eq('is_active', true).order('code', { ascending: true });
    if (error) throw error;
    return data.map(d => ({ code: d.code, label: d.name, category: d.category, description: d.description }));
  },

  getDonors: async (): Promise<Donor[]> => {
    const { data, error } = await supabase.from('members').select('*').eq('is_active', true);
    if (error) throw error;
    return data.map(d => ({
      id: d.id.toString(),
      offeringNumber: d.member_no?.toString() || '',
      name: d.name,
      note: d.note,
      phone: d.phone
    })).sort((a, b) => (Number(a.offeringNumber) || 99999) - (Number(b.offeringNumber) || 99999));
  },

  saveDonor: async (donor: Donor): Promise<Donor> => {
    const payload: any = { name: donor.name, member_no: donor.offeringNumber || null, note: donor.note, phone: donor.phone, is_active: true };
    if (!isNaN(parseInt(donor.id))) payload.id = parseInt(donor.id);
    const { data, error } = await supabase.from('members').upsert(payload).select().single();
    if (error) throw error;
    return { id: data.id.toString(), offeringNumber: data.member_no?.toString() || '', name: data.name, note: data.note, phone: data.phone };
  },

  deleteDonor: async (id: string) => {
    const targetId = parseInt(id);
    if (isNaN(targetId)) return;
    const { error } = await supabase.from('members').update({ is_active: false }).eq('id', targetId);
    if (error) throw error;
  },

  // 11. 예산 관리
  getBudgets: async (year: string): Promise<BudgetRecord[]> => {
    const { data } = await supabase.from('budgets').select('*').eq('year', parseInt(year));
    return (data || []).map(d => ({ year: d.year.toString(), code: d.code, amount: parseFloat(d.amount), note: d.note }));
  },

  saveBudget: async (budget: BudgetRecord) => {
    await supabase.from('budgets').upsert({ year: parseInt(budget.year), code: budget.code, amount: budget.amount, note: budget.note });
  },

  // 개인별 24개월 통계 (기존 유지)
  async getDonorMonthlyStats(offeringNumber: string) {
    const { data, error } = await supabase
      .from('donation_monthly_by_member') 
      .select('year, month, day, member_no, donation_code, total')
      .eq('member_no', offeringNumber)
      .order('year', { ascending: true })
      .order('month', { ascending: true });
    if (error) throw error;
    return data;
  }
};
