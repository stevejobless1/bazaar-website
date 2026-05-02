export interface ProductState {
  productId: string;
  sellPrice: number;
  sellVolume: number;
  buyPrice: number;
  buyVolume: number;
  buyOrders: number;
  sellOrders: number;
  buyMovingWeek: number;
  sellMovingWeek: number;
  margin: number;
  lastUpdated: number;
}

export interface HistoryCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryPoint {
  timestamp: number;
  sellPrice: number;
  buyPrice: number;
  sellVolume: number;
  buyVolume: number;
}

export interface FusionData {
  recipes: {
    [targetItem: string]: {
      [cost: string]: string[][];
    };
  };
  shards: {
    [shardId: string]: {
      id: string;
      name: string;
      fuse_amount: number;
      internal_id: string;
    };
  };
}

export interface FusionRecipes {
  [targetItem: string]: {
    [cost: string]: string[][];
  };
}

export interface FlipResult {
  targetItem: string;
  ingredients: string[];
  cost: number;
  revenue: number;
  profit: number;
  roi: number;
  targetVolume: number;
  ingredientVolumeMin: number;
}

export interface LiveOrder {
  amount: number;
  pricePerUnit: number;
  orders: number;
}

export interface LiveOrderBook {
  buy_summary: LiveOrder[];
  sell_summary: LiveOrder[];
}
