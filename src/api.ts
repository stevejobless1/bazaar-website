import { ProductState, HistoryPoint } from './types';

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
    buyOrders: data.buyOrders || 0,
    sellOrders: data.sellOrders || 0,
    buyMovingWeek: data.buyMovingWeek || 0,
    sellMovingWeek: data.sellMovingWeek || 0,
    margin: data.buyPrice - data.sellPrice,
    lastUpdated: data.timestamp
  }));
};

export const fetchHistory = async (productId: string, resolution: 'raw' | '5m' | '1h' = 'raw', limit: number = 1000): Promise<HistoryPoint[]> => {
  const res = await fetch(`${API_BASE}/bazaar/history/${productId}?resolution=${resolution}&limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch ${resolution} history`);
  const json = await res.json();
  return (json.data || []).map((p: any) => ({
    timestamp: p.timestamp,
    sellPrice: p.sell_price !== undefined ? p.sell_price : p.sell_close,
    buyPrice: p.buy_price !== undefined ? p.buy_price : p.buy_close,
    sellVolume: p.sell_volume !== undefined ? p.sell_volume : p.avg_sell_volume,
    buyVolume: p.buy_volume !== undefined ? p.buy_volume : p.avg_buy_volume
  }));
};

// Deprecated aliases (mapping to the new fetchHistory)
export const fetchHistoryHighRes = (productId: string, limit: number = 1000) => fetchHistory(productId, 'raw', limit);
export const fetchHistoryCandles = async (productId: string): Promise<any> => {
  const res = await fetch(`${API_BASE}/bazaar/history/${productId}?resolution=1h&limit=20000`);
  if (!res.ok) throw new Error(`Failed to fetch hourly candles`);
  const json = await res.json();
  return (json.data || []).map((c: any) => ({
    timestamp: c.timestamp,
    open: c.buy_open, // Using buy price for candles
    high: c.buy_high,
    low: c.buy_low,
    close: c.buy_close,
  }));
};

export const fetchFusions = async (): Promise<any> => {
  const res = await fetch('https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/fusion-data.json');
  if (!res.ok) throw new Error('Failed to fetch fusions data');
  const json = await res.json();
  return json || { recipes: {}, shards: {} };
};

export const fetchLiveOrders = async (productId: string): Promise<any> => {
  const res = await fetch(`${API_BASE}/bazaar/orders/${productId}`);
  if (!res.ok) throw new Error('Failed to fetch live orders');
  return await res.json();
};

export const fetchMayors = async (start: number, end: number): Promise<{ timestamp: number, name: string }[]> => {
  const res = await fetch(`${API_BASE}/mayors?start=${start}&end=${end}`);
  if (!res.ok) throw new Error('Failed to fetch mayors');
  const json = await res.json();
  return json.data || [];
};
