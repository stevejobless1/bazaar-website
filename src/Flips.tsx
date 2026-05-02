import React, { useState, useEffect, useMemo } from 'react';
import { ProductState, FusionData, FlipResult } from './types';
import { fetchFusions } from './api';

const getItemIconUrl = (shardId: string) => {
  return `https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/shardIcons/${shardId}.png`;
};


const formatCompact = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

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
  // Default to Instabuy -> Sell Order as per user preference
  const [buyStrategy, setBuyStrategy] = useState<Strategy>('insta');
  const [sellStrategy, setSellStrategy] = useState<Strategy>('order');

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

    const productMap = new Map(products.map(p => [p.productId, p]));
    const shards = fusionData.shards;
    const recipesMap = fusionData.recipes;

    // 1. Calculate Effective Prices (Recursive)
    // Map of Shard ID -> { price: number, source: 'bazaar' | 'craft' }
    const effectivePrices = new Map<string, { price: number; source: 'bazaar' | 'craft' }>();

    // Initialize with Bazaar prices
    for (const [shardId, shard] of Object.entries(shards)) {
      const prod = productMap.get(shard.internal_id);
      if (prod) {
        // Price logic: Insta-Buy = sellPrice, Buy Order = buyPrice
        const price = buyStrategy === 'insta' ? prod.sellPrice : prod.buyPrice;
        effectivePrices.set(shardId, { price, source: 'bazaar' });
      } else {
        effectivePrices.set(shardId, { price: Infinity, source: 'bazaar' });
      }
    }

    // Iterate to propagate costs (Bellman-Ford style)
    // 10 passes is more than enough for the depth of fusion trees
    for (let i = 0; i < 10; i++) {
      let changed = false;
      for (const [targetId, recipesByQty] of Object.entries(recipesMap)) {
        for (const [qtyStr, recipes] of Object.entries(recipesByQty as Record<string, string[][]>)) {
          const outputQuantity = parseInt(qtyStr);
          for (const recipe of recipes) {
            let craftCost = 0;
            let validRecipe = true;
            for (const ingId of recipe) {
              const ingData = effectivePrices.get(ingId);
              const ingShard = shards[ingId];
              if (!ingData || ingData.price === Infinity || !ingShard) {
                validRecipe = false;
                break;
              }
              craftCost += ingData.price * ingShard.fuse_amount;
            }

            if (validRecipe) {
              const unitCraftCost = craftCost / outputQuantity;
              const current = effectivePrices.get(targetId);
              // If crafting is cheaper (with a small epsilon for floating point), update
              if (!current || unitCraftCost < current.price - 0.01) {
                effectivePrices.set(targetId, { price: unitCraftCost, source: 'craft' });
                changed = true;
              }
            }
          }
        }
      }
      if (!changed) break;
    }

    // 2. Generate Flip Results using Effective Prices
    const results: (FlipResult & { 
      targetName: string; 
      ingredientNames: string[]; 
      ingredientSources: ('bazaar' | 'craft')[];
      salesPerHour: number; 
      profitPerShard: number;
      outputQuantity: number;
    })[] = [];

    for (const [targetItem, recipesByQty] of Object.entries(recipesMap)) {
      const targetShard = shards[targetItem];
      if (!targetShard) continue;
      
      const targetProd = productMap.get(targetShard.internal_id);
      if (!targetProd) continue;

      for (const [qtyStr, recipes] of Object.entries(recipesByQty as Record<string, string[][]>)) {
        const outputQuantity = parseInt(qtyStr);
        
        for (const recipe of recipes) {
          let totalCost = 0;
          let validRecipe = true;
          let minFillVol = Infinity;
          const ingredientNames: string[] = [];
          const ingredientSources: ('bazaar' | 'craft')[] = [];

          for (const ingredient of recipe) {
            const ingShard = shards[ingredient];
            const ingData = effectivePrices.get(ingredient);
            if (!ingShard || !ingData || ingData.price === Infinity) {
              validRecipe = false;
              break;
            }
            
            ingredientNames.push(ingShard.name);
            ingredientSources.push(ingData.source);
            
            const prod = productMap.get(ingShard.internal_id);
            // Even if we craft it, we check liquidity of the "base" shard for safety
            // but primarily we care about the cost we calculated
            totalCost += (ingData.price * ingShard.fuse_amount);
            
            if (prod) {
              const fillVol = buyStrategy === 'insta' ? prod.sellVolume : prod.sellMovingWeek;
              if (fillVol < minFillVol) minFillVol = fillVol;
            }
          }

          if (!validRecipe) continue;

          // Revenue: selling the finished product
          let unitRevenue = sellStrategy === 'insta' ? targetProd.buyPrice : targetProd.sellPrice;
          unitRevenue = unitRevenue * 0.9875; // 1.25% Tax

          const totalRevenue = unitRevenue * outputQuantity;
          const totalProfit = totalRevenue - totalCost;
          const profitPerShard = totalProfit / outputQuantity;
          const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
          
          const targetFillVolume = sellStrategy === 'insta' ? targetProd.buyVolume : targetProd.buyMovingWeek;
          const salesPerHour = targetProd.buyMovingWeek / 168;

          // Filter illiquid targets and ingredients
          if (targetFillVolume < 1 || minFillVol < 1) continue;

          results.push({
            targetItem,
            targetName: targetShard.name,
            ingredients: recipe,
            ingredientNames,
            ingredientSources,
            cost: totalCost,
            revenue: totalRevenue,
            profit: totalProfit,
            profitPerShard,
            roi,
            targetVolume: targetProd.buyVolume,
            ingredientVolumeMin: minFillVol,
            salesPerHour,
            outputQuantity
          });
        }
      }
    }

    // Group by target shard to only show the best recipe for each
    const bestFlipsMap = new Map<string, typeof results[0]>();
    for (const res of results) {
      const key = res.targetItem;
      const existing = bestFlipsMap.get(key);
      if (!existing || res.profitPerShard > existing.profitPerShard) {
        bestFlipsMap.set(key, res);
      }
    }

    return Array.from(bestFlipsMap.values()).sort((a, b) => b.profitPerShard - a.profitPerShard).slice(0, 20);
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
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Fusion Flip Rankings</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Method: {buyStrategy === 'insta' ? 'Instabuy' : 'Buy Order'} → {sellStrategy === 'insta' ? 'Instasell' : 'Sell Order'}
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Buy Ingredients</h3>
          <div className="tabs-container" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <button className={`tab ${buyStrategy === 'insta' ? 'active' : ''}`} onClick={() => setBuyStrategy('insta')}>Instabuy</button>
            <button className={`tab ${buyStrategy === 'order' ? 'active' : ''}`} onClick={() => setBuyStrategy('order')}>Buy Order</button>
          </div>
        </div>
        
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Sell Crafted Item</h3>
          <div className="tabs-container" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <button className={`tab ${sellStrategy === 'insta' ? 'active' : ''}`} onClick={() => setSellStrategy('insta')}>Instasell</button>
            <button className={`tab ${sellStrategy === 'order' ? 'active' : ''}`} onClick={() => setSellStrategy('order')}>Sell Order</button>
          </div>
        </div>
      </div>

      <div className="glass-panel data-table-container" style={{ marginTop: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Shard</th>
              <th>Ingredients</th>
              <th>Profit / Shard</th>
              <th>Craft Cost</th>
              <th>Sales/hr</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            {flipResults.map((flip, idx) => (
              <tr key={idx}>
                <td style={{ width: '50px' }}>
                  <span className="rank-badge">{idx + 1}</span>
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
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{flip.targetName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Yields: {flip.outputQuantity}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {flip.ingredients.map((ing, i) => (
                      <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <img 
                          src={getItemIconUrl(ing)} 
                          alt={flip.ingredientNames[i]}
                          className="product-icon"
                          title={`${flip.ingredientNames[i]} (${flip.ingredientSources[i] === 'craft' ? 'Craft' : 'Buy'})`}
                          style={{ width: '24px', height: '24px' }}
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://sky.shiiyu.moe/item/STONE'; }}
                        />
                        <span style={{ 
                          fontSize: '0.7rem', 
                          position: 'absolute', 
                          bottom: '-4px', 
                          right: '-4px',
                          background: 'rgba(0,0,0,0.6)',
                          borderRadius: '50%',
                          width: '14px',
                          height: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                          {flip.ingredientSources[i] === 'craft' ? '🔨' : '🛒'}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className={flip.profitPerShard >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 'bold' }}>
                  {formatCompact(flip.profitPerShard)}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{formatCompact(flip.cost)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{flip.salesPerHour.toFixed(1)}</span>
                    <div style={{ 
                      width: '10px', height: '10px', borderRadius: '50%', 
                      backgroundColor: flip.salesPerHour > 20 ? '#4ade80' : flip.salesPerHour > 5 ? '#facc15' : '#f87171' 
                    }}></div>
                  </div>
                </td>
                <td className={flip.roi >= 0 ? 'positive' : 'negative'}>
                  {flip.roi.toFixed(1)}%
                </td>
              </tr>
            ))}
            {flipResults.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                  No liquid flips found. Check your API connection or try a different strategy.
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
