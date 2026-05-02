import React, { useState, useEffect, useMemo } from 'react';
import { ProductState, FusionData, FlipResult } from './types';
import { fetchFusions } from './api';

const getItemIconUrl = (shardId: string) => {
  return `https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/shardIcons/${shardId}.png`;
};

const formatCommas = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const formatCompact = (n: number) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

interface FlipsProps {
  products: ProductState[];
  loading: boolean;
  error: string | null;
}

type Strategy = 'insta' | 'order';

const Flips: React.FC<FlipsProps> = ({ products, loading, error }) => {
  const [fusionData, setFusionData] = useState<FusionData | null>(null);
  const [fusionsLoading, setFusionsLoading] = useState(true);
  
  // Toggles for buying ingredients and selling the crafted item
  const [buyStrategy, setBuyStrategy] = useState<Strategy>('insta');
  const [sellStrategy, setSellStrategy] = useState<Strategy>('insta');

  useEffect(() => {
    fetchFusions()
      .then((data) => {
        setFusionData(data);
        setFusionsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load fusions data', err);
        setFusionsLoading(false);
      });
  }, []);

  const flipResults = useMemo(() => {
    if (products.length === 0 || !fusionData || !fusionData.recipes || !fusionData.shards) return [];

    const results: (FlipResult & { targetName: string; ingredientNames: string[]; fillVolume: number; targetFillVolume: number })[] = [];
    const productMap = new Map(products.map(p => [p.productId, p]));

    for (const [targetItem, recipesByCost] of Object.entries(fusionData.recipes)) {
      const targetShard = fusionData.shards[targetItem];
      if (!targetShard) continue;
      
      const targetProd = productMap.get(targetShard.internal_id);
      if (!targetProd) continue;

      for (const [, recipes] of Object.entries(recipesByCost as { [key: string]: string[][] })) {
        for (const recipe of recipes) {
          let totalCost = 0;
          let validRecipe = true;
          let minVol = Infinity;
          let minFillVol = Infinity;
          const ingredientNames: string[] = [];

          for (const ingredient of recipe) {
            const ingShard = fusionData.shards[ingredient];
            if (!ingShard) {
              validRecipe = false;
              break;
            }
            ingredientNames.push(ingShard.name);
            const prod = productMap.get(ingShard.internal_id);
            if (!prod) {
              validRecipe = false;
              break;
            }
            
            // Insta-Buy = pay the lowest sell offer (sellPrice in our code logic... wait, Hypixel API: 
            // In our api.ts: sellPrice is data.sellPrice, buyPrice is data.buyPrice
            // Actually, Hypixel API:
            // buyPrice (Quick Status) is the highest buy order
            // sellPrice (Quick Status) is the lowest sell offer
            const price = buyStrategy === 'insta' ? prod.sellPrice : prod.buyPrice;
            totalCost += (price * ingShard.fuse_amount);
            
            // Liquidity: If Insta-Buying, we rely on Sell Offers (sellVolume). 
            // If Buy Order, we rely on people Insta-Selling to us (sellMovingWeek).
            const vol = buyStrategy === 'insta' ? prod.sellVolume : prod.buyVolume;
            const fillVol = buyStrategy === 'insta' ? prod.sellVolume : prod.sellMovingWeek;
            if (vol < minVol) minVol = vol;
            if (fillVol < minFillVol) minFillVol = fillVol;
          }

          if (!validRecipe) continue;

          // If Insta-Selling, we get the highest buy order (buyPrice)
          // If Sell Offer, we get the lowest sell offer (sellPrice)
          let revenue = sellStrategy === 'insta' ? targetProd.buyPrice : targetProd.sellPrice;
          revenue = revenue * 0.9875; // Deduct 1.25% Bazaar Tax

          const profit = revenue - totalCost;
          const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
          
          const targetVolume = sellStrategy === 'insta' ? targetProd.buyVolume : targetProd.sellVolume;
          // If Insta-Selling, we rely on Buy Orders (buyVolume)
          // If Sell Offer, we rely on people Insta-Buying from us (buyMovingWeek)
          const targetFillVolume = sellStrategy === 'insta' ? targetProd.buyVolume : targetProd.buyMovingWeek;

          // Filter out flips that are completely illiquid
          if (minFillVol < 10 || targetFillVolume < 10) continue;

          results.push({
            targetItem,
            targetName: targetShard.name,
            ingredients: recipe,
            ingredientNames,
            cost: totalCost,
            revenue,
            profit,
            roi,
            targetVolume,
            ingredientVolumeMin: minVol,
            fillVolume: minFillVol,
            targetFillVolume: targetFillVolume
          });
        }
      }
    }

    // Sort by most profitable
    return results.sort((a, b) => b.profit - a.profit).slice(0, 20);
  }, [products, fusionData, buyStrategy, sellStrategy]);

  if (loading || fusionsLoading) {
    return <div className="loader-container"><div className="loader"></div></div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="main-content">
      <div className="chart-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Bazaar Flips Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Live Top 20 fusion flips using real-time market data. Automatically filtered by liquidity (fillable volume).</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Buy Ingredients</h3>
          <div className="tabs-container" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <button 
              className={`tab ${buyStrategy === 'insta' ? 'active' : ''}`}
              onClick={() => setBuyStrategy('insta')}
            >
              Insta-Buy
            </button>
            <button 
              className={`tab ${buyStrategy === 'order' ? 'active' : ''}`}
              onClick={() => setBuyStrategy('order')}
            >
              Buy Order
            </button>
          </div>
        </div>
        
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Sell Crafted Item</h3>
          <div className="tabs-container" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <button 
              className={`tab ${sellStrategy === 'insta' ? 'active' : ''}`}
              onClick={() => setSellStrategy('insta')}
            >
              Insta-Sell
            </button>
            <button 
              className={`tab ${sellStrategy === 'order' ? 'active' : ''}`}
              onClick={() => setSellStrategy('order')}
            >
              Sell Offer
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel data-table-container" style={{ marginTop: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Recipe</th>
              <th>Target Shard</th>
              <th>Cost</th>
              <th>Revenue (After Tax)</th>
              <th>Profit</th>
              <th>ROI</th>
              <th>Liquidity (Fillable)</th>
            </tr>
          </thead>
          <tbody>
            {flipResults.map((flip, idx) => (
              <tr key={idx}>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {flip.ingredients.map((ing, i) => (
                      <img 
                        key={i}
                        src={getItemIconUrl(ing)} 
                        alt={flip.ingredientNames[i]}
                        className="product-icon"
                        title={flip.ingredientNames[i]}
                        style={{ width: '24px', height: '24px' }}
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://sky.shiiyu.moe/item/STONE'; }}
                      />
                    ))}
                  </div>
                </td>
                <td>
                  <div className="product-name">
                    <img 
                      src={getItemIconUrl(flip.targetItem)} 
                      alt={flip.targetName} 
                      className="product-icon"
                      title={flip.targetName}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://sky.shiiyu.moe/item/STONE'; }}
                    />
                    {flip.targetName}
                  </div>
                </td>
                <td title={formatCommas(flip.cost)}>{formatCompact(flip.cost)}</td>
                <td title={formatCommas(flip.revenue)}>{formatCompact(flip.revenue)}</td>
                <td className={flip.profit >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 'bold' }} title={formatCommas(flip.profit)}>
                  {formatCompact(flip.profit)}
                </td>
                <td className={flip.roi >= 0 ? 'positive' : 'negative'}>
                  {flip.roi.toFixed(2)}%
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span title={formatCommas(flip.fillVolume)}>Ing. Fills: {formatCompact(flip.fillVolume)}</span>
                    <span title={formatCommas(flip.targetFillVolume)}>Tar. Fills: {formatCompact(flip.targetFillVolume)}</span>
                  </div>
                </td>
              </tr>
            ))}
            {flipResults.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  No profitable or liquid flips found with the current strategies.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Flips;
