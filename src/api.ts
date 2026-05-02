import { ProductState, HistoryPoint, HistoryCandle } from './types';

// Use a relative path so that Nginx can proxy it to the internal API
const API_BASE = '/api';
console.log('[Bazaar Tracker] Connecting to API via internal proxy at:', API_BASE);


export const fetchLatest = async (): Promise<ProductState[]> => {
  const res = await fetch(`${API_BASE}/bazaar`);
  if (!res.ok) throw new Error('Failed to fetch latest bazaar data');
  const json = await res.json();
  // Transform the object { ID: { stats } } into an array [ { ...stats, productId: ID } ]
  return Object.entries(json.products || {}).map(([id, data]: [string, any]) => ({
    productId: id,
    sellPrice: data.sellPrice,
    sellVolume: data.sellVolume,
    buyPrice: data.buyPrice,
    buyVolume: data.buyVolume,
    margin: data.buyPrice - data.sellPrice,
    lastUpdated: data.timestamp
  }));
};

export const fetchHistoryHighRes = async (productId: string, limit: number = 1000): Promise<HistoryPoint[]> => {
  const res = await fetch(`${API_BASE}/bazaar/history/${productId}?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch high-res history');
  const json = await res.json();
  return (json.data || []).map((p: any) => ({
    timestamp: p.timestamp,
    sellPrice: p.sell_price,
    buyPrice: p.buy_price,
    sellVolume: p.sell_volume,
    buyVolume: p.buy_volume
  }));
};

export const fetchHistoryCandles = async (productId: string): Promise<HistoryCandle[]> => {
  const res = await fetch(`${API_BASE}/bazaar/history/${productId}?hourly=true`);
  if (!res.ok) throw new Error('Failed to fetch hourly candles');
  const json = await res.json();
  return json.data || [];
};

export const fetchFusions = async (): Promise<any> => {
  const res = await fetch('https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/fusion-data.json');
  if (!res.ok) throw new Error('Failed to fetch fusions data');
  const json = await res.json();
  return json.recipes || {};
};
