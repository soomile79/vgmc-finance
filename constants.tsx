
import React from 'react';

export const COLORS = {
  primary: '#3b82f6',
  secondary: '#64748b',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
};

// Based on the provided data snippet
export const MOCK_DONORS = [
  { id: '122', offeringNumber: '122', name: '김용준' },
  { id: '320', offeringNumber: '320', name: '장말순' },
  { id: '133', offeringNumber: '133', name: '길민' },
  { id: '368', offeringNumber: '368', name: '김철제' },
  { id: '284', offeringNumber: '284', name: '류향주' },
  { id: '283', offeringNumber: '283', name: '전신제' },
  { id: '310', offeringNumber: '310', name: '김광호' },
  { id: '279', offeringNumber: '279', name: '차애주' },
  { id: '393', offeringNumber: '393', name: '노재구' },
  { id: '265', offeringNumber: '265', name: '안혜연' },
  { id: '455', offeringNumber: '455', name: '백경희' },
  { id: '462', offeringNumber: '462', name: '김명숙' },
  { id: '9997', offeringNumber: '', name: '기타' },
  { id: '101', offeringNumber: '101', name: '김진' },
  { id: '100', offeringNumber: '100', name: '민경민' },
  { id: '339', offeringNumber: '339', name: '오순현' },
  { id: '04', offeringNumber: '04', name: '김봉수' },
];

export const MOCK_RECORDS = [
  { id: 'm1', date: '2025-01-05', donorId: '122', code: '11', amount: 250.00, note: '십일조' },
  { id: 'm2', date: '2025-01-05', donorId: '320', code: '29', amount: 50.00, note: '신년감사' },
  { id: 'm3', date: '2025-01-05', donorId: '133', code: '29', amount: 50.00, note: '신년감사' },
  { id: 'm4', date: '2025-01-05', donorId: '368', code: '29', amount: 50.00, note: '신년감사' },
  { id: 'm5', date: '2025-01-05', donorId: '9997', code: '29', amount: 100.00, note: '김정진(신년감사)' },
  { id: 'm6', date: '2025-01-05', donorId: '101', code: '11', amount: 300.00, note: '십일조' },
  { id: 'm7', date: '2025-01-05', donorId: '101', code: '22', amount: 100.00, note: '일반감사' },
  { id: 'm8', date: '2025-01-05', donorId: '339', code: '22', amount: 100.00, note: '생일감사' },
  { id: 'm9', date: '2025-01-05', donorId: '04', code: '98', amount: 6500.00, note: '렌트(데이케어)' },
];
