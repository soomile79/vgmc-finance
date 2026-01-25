
export type OfferingCode = string;

export interface OfferingType {
  code: OfferingCode;
  label: string;
  category?: string;
  description?: string;
}

export interface Donor {
  id: string; 
  offeringNumber?: string;
  name: string;
  note?: string; 
  phone?: string;
}

export interface OfferingRecord {
  id: string;
  date: string;
  donorId: string;
  offeringNumber: string;
  donorName?: string; // 연결되지 않은 성도를 위한 이름 필드
  code: OfferingCode;
  amount: number;
  note?: string;
  offeringName?: string; 
}

export interface BudgetRecord {
  year: string;
  code: OfferingCode;
  amount: number;
  note?: string;
}
