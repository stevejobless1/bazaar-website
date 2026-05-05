import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRight, TrendingUp, ShoppingCart, Hammer } from 'lucide-react';
import { ProductState, FusionData, FlipResult } from './types';
import { fetchFusions } from './api';
import ItemIcon from './ItemIcon';

const formatCommas = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const formatCompact = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

interface FlipsProps {
  products: ProductState[];
  loading: boolean;
  error: string | null;
}

type Strategy = 'insta' | 'order';

interface DetailedFlip extends FlipResult {
  targetName: string;
  ingredientNames: string[];
  ingredientSources: ('bazaar' | 'craft')[];
  salesPerHour: number;
  profitPerShard: number;
  outputQuantity: number;
}

const Flips: React.FC<FlipsProps> = ({ products, loading, error }) => {
  const [fusionData, setFusionData] = useState<FusionData | null>(null);
  const [fusionsLoading, setFusionsLoading] = useState(true);
  const [buyStrategy, setBuyStrategy] = useState<Strategy>('insta');
  const [sellStrategy, setSellStrategy] = useState<Strategy>('order');
  const [selectedFlip, setSelectedFlip] = useState<DetailedFlip | null>(null);

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

  const { flipResults, effectivePrices } = useMemo(() => {
    if (products.length === 0 || !fusionData || !fusionData.recipes || !fusionData.shards) 
      return { flipResults: [], effectivePrices: new Map() };

    const productMap = new Map(products.map(p => [p.productId, p]));
    const shards = fusionData.shards;
    const recipesMap = fusionData.recipes;

    const prices = new Map<string, { price: number; source: 'bazaar' | 'craft' }>();

    for (const [shardId, shard] of Object.entries(shards)) {
      const prod = productMap.get(shard.internal_id);
      if (prod) {
        const price = buyStrategy === 'insta' ? prod.sellPrice : prod.buyPrice;
        prices.set(shardId, { price, source: 'bazaar' });
      } else {
        prices.set(shardId, { price: Infinity, source: 'bazaar' });
      }
    }

    for (let i = 0; i < 10; i++) {
      let changed = false;
      for (const [targetId, recipesByQty] of Object.entries(recipesMap)) {
        for (const [qtyStr, recipes] of Object.entries(recipesByQty as Record<string, string[][]>)) {
          const outputQuantity = parseInt(qtyStr);
          for (const recipe of recipes) {
            let craftCost = 0;
            let validRecipe = true;
            for (const ingId of recipe) {
              const ingData = prices.get(ingId);
              const ingShard = shards[ingId];
              if (!ingData || ingData.price === Infinity || !ingShard) {
                validRecipe = false;
                break;
              }
              craftCost += ingData.price * ingShard.fuse_amount;
            }

            if (validRecipe) {
              const unitCraftCost = craftCost / outputQuantity;
              const current = prices.get(targetId);
              if (!current || unitCraftCost < current.price - 0.01) {
                prices.set(targetId, { price: unitCraftCost, source: 'craft' });
                changed = true;
              }
            }
          }
        }
      }
      if (!changed) break;
    }

    const results: DetailedFlip[] = [];

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
            const ingData = prices.get(ingredient);
            if (!ingShard || !ingData || ingData.price === Infinity) {
              validRecipe = false;
              break;
            }
            ingredientNames.push(ingShard.name);
            ingredientSources.push(ingData.source);
            totalCost += (ingData.price * ingShard.fuse_amount);
            const prod = productMap.get(ingShard.internal_id);
            if (prod) {
              const fillVol = buyStrategy === 'insta' ? prod.sellVolume : prod.sellMovingWeek;
              if (fillVol < minFillVol) minFillVol = fillVol;
            }
          }

          if (!validRecipe) continue;

          let unitRevenue = sellStrategy === 'insta' ? targetProd.buyPrice : targetProd.sellPrice;
          unitRevenue = unitRevenue * 0.9875; 

          const totalRevenue = unitRevenue * outputQuantity;
          const totalProfit = totalRevenue - totalCost;
          const profitPerShard = totalProfit / outputQuantity;
          const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
          const targetFillVolume = sellStrategy === 'insta' ? targetProd.buyVolume : targetProd.buyMovingWeek;
          const salesPerHour = targetProd.buyMovingWeek / 168;

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

    const bestFlipsMap = new Map<string, DetailedFlip>();
    for (const res of results) {
      const key = res.targetItem;
      const existing = bestFlipsMap.get(key);
      if (!existing || res.profitPerShard > existing.profitPerShard) {
        bestFlipsMap.set(key, res);
      }
    }

    return { 
      flipResults: Array.from(bestFlipsMap.values()).sort((a, b) => b.profitPerShard - a.profitPerShard).slice(0, 20),
      effectivePrices: prices
    };
  }, [products, fusionData, buyStrategy, sellStrategy]);

  if (loading || fusionsLoading) return <div className="loader-container"><div className="loader"></div></div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="main-content">
      <div className="chart-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 800 }}>Fusion Flip Rankings</h1>
          <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={16} /> Optimized pathways for crafting shards at maximum efficiency
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Buy Strategy</h3>
          <div className="tabs-container" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <button className={`tab ${buyStrategy === 'insta' ? 'active' : ''}`} onClick={() => setBuyStrategy('insta')}>Instabuy</button>
            <button className={`tab ${buyStrategy === 'order' ? 'active' : ''}`} onClick={() => setBuyStrategy('order')}>Buy Order</button>
          </div>
        </div>
        
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Sell Strategy</h3>
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
              <th>Max Profit / Hr</th>
              <th>Sales/hr</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            {flipResults.map((flip, idx) => {
              const maxProfitHr = flip.profitPerShard * flip.salesPerHour;
              return (
                <tr key={idx} onClick={() => setSelectedFlip(flip)}>
                  <td style={{ width: '60px' }}>
                    <span className="rank-badge">{idx + 1}</span>
                  </td>
                  <td>
                    <div className="product-name">
                      <ItemIcon productId={flip.targetItem} isShard={true} className="product-icon" />
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{flip.targetName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Yields {flip.outputQuantity}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {flip.ingredients.map((ing, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <ItemIcon 
                            productId={ing} 
                            isShard={true} 
                            style={{ width: '28px', height: '28px' }} 
                            title={`${flip.ingredientNames[i]} (${flip.ingredientSources[i] === 'craft' ? 'Craft' : 'Buy'})`}
                          />
                          <span style={{ 
                            fontSize: '0.6rem', 
                            position: 'absolute', 
                            bottom: '-2px', 
                            right: '-2px',
                            background: 'rgba(0,0,0,0.8)',
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
                  <td className={flip.profitPerShard >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 700 }}>
                    {formatCompact(flip.profitPerShard)}
                  </td>
                  <td style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                    {formatCompact(maxProfitHr)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{flip.salesPerHour.toFixed(1)}</span>
                      <div style={{ 
                        width: '8px', height: '8px', borderRadius: '50%', 
                        backgroundColor: flip.salesPerHour > 20 ? '#4ade80' : flip.salesPerHour > 5 ? '#facc15' : '#f87171' 
                      }}></div>
                    </div>
                  </td>
                  <td className={flip.roi >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 600 }}>
                    {flip.roi.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fusion Detail Modal */}
      {selectedFlip && (
        <div className="modal-overlay" onClick={() => setSelectedFlip(null)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedFlip(null)}>
              <X size={24} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
              <ItemIcon productId={selectedFlip.targetItem} isShard={true} style={{ width: '64px', height: '64px' }} />
              <div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{selectedFlip.targetName}</h2>
                <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ROI: <span className="positive" style={{ fontWeight: 'bold' }}>{selectedFlip.roi.toFixed(1)}%</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  Yields {selectedFlip.outputQuantity} units
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2.5rem' }}>
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Est. Max Profit / Hr</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-color)' }}>{formatCommas(selectedFlip.profitPerShard * selectedFlip.salesPerHour)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Based on {selectedFlip.salesPerHour.toFixed(1)} sales/hr</div>
              </div>
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Profit Per Shard</div>
                <div 
                  className={selectedFlip.profitPerShard >= 0 ? 'positive' : 'negative'}
                  style={{ fontSize: '1.4rem', fontWeight: 800 }}
                >
                  {formatCommas(selectedFlip.profitPerShard)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>After 1.25% Bazaar Tax</div>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Fusion Steps</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedFlip.ingredients.map((ingId, idx) => {
                const ingShard = fusionData?.shards[ingId];
                const source = selectedFlip.ingredientSources[idx];
                const priceData = effectivePrices.get(ingId);
                
                return (
                  <div key={idx} className={`recipe-step ${source}`}>
                    <ItemIcon productId={ingId} isShard={true} style={{ width: '40px', height: '40px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {ingShard?.name} x{ingShard?.fuse_amount}
                        {source === 'bazaar' ? <ShoppingCart size={14} color="#3fb950" /> : <Hammer size={14} color="#e3b341" />}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {source === 'bazaar' ? 'Buy directly from Bazaar' : 'Better to CRAFT using sub-ingredients'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{formatCompact((priceData?.price || 0) * (ingShard?.fuse_amount || 0))}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>coins total</div>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                <ArrowRight size={24} style={{ transform: 'rotate(90deg)', opacity: 0.5 }} />
              </div>
              <div className="recipe-step" style={{ background: 'var(--accent-glow)', borderLeftColor: 'var(--accent-color)' }}>
                <ItemIcon productId={selectedFlip.targetItem} isShard={true} style={{ width: '40px', height: '40px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>Collect {selectedFlip.targetName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Yields {selectedFlip.outputQuantity} units</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-color)' }}>+{formatCompact(selectedFlip.revenue)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>gross revenue</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Flips;
