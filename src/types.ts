export interface ProductState {
  productId: string;
  sellPrice: number;
  sellVolume: number;
  buyPrice: number;
  buyVolume: number;
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
