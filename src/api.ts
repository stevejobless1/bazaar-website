import { ProductState, HistoryPoint, HistoryCandle } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const fetchLatest = async (): Promise<ProductState[]> => {
  const res = await fetch(`${API_BASE}/bazaar`);
  if (!res.ok) throw new Error('Failed to fetch latest bazaar data');
  return res.json();
};

export const fetchHistoryHighRes = async (productId: string, limit: number = 1000): Promise<HistoryPoint[]> => {
  const res = await fetch(`${API_BASE}/bazaar/history/${productId}?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch high-res history');
  return res.json();
};

export const fetchHistoryCandles = async (productId: string): Promise<HistoryCandle[]> => {
  const res = await fetch(`${API_BASE}/bazaar/history/${productId}?hourly=true`);
  if (!res.ok) throw new Error('Failed to fetch hourly candles');
  return res.json();
};
