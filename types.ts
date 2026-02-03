
export type OfferingCode = string;

export interface OfferingType {
  code: OfferingCode;
  label: string;
  category?: string;
  description?: string;
}

export interface Donor {
  id: string;
  korean_name: string;
  english_name?: string;
  offering_number?: string | number;
  birthday?: string;
  phone?: string;
  email?: string;
  address?: string;
  for_slip?: string;
  note?: string;
  remote_uuid?: string;
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
