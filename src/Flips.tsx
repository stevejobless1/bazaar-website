import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Info } from 'lucide-react';
import { ProductState, FusionData } from './types';
import { fetchFusions } from './api';
import ItemIcon from './ItemIcon';
import FusionTree from './FusionTree';

const formatCompact = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

interface FlipsProps {
  products: ProductState[];
  loading: boolean;
  error: string | null;
}

type Strategy = 'insta' | 'order';

interface DetailedFlip {
  targetId: string;
  name: string;
  craftCost: number;
  sellPrice: number;
  profit: number;
  margin: number;
  salesPerHour: number;
  maxProfitHr: number;
  ingredients: string[];
  ingredientSources: ('bazaar' | 'craft')[];
}

const calculatePrices = (fusionData: FusionData, productMap: Map<string, ProductState>, buyStrategy: Strategy) => {
  const prices = new Map<string, { price: number; source: 'bazaar' | 'craft' }>();
  const shards = fusionData.shards;
  const recipesMap = fusionData.recipes;

  // Initialize with Bazaar prices
  for (const [shardId, shard] of Object.entries(shards)) {
    const prod = productMap.get(shard.internal_id);
    if (prod) {
      const price = buyStrategy === 'insta' ? prod.sellPrice : prod.buyPrice;
      prices.set(shardId, { price, source: 'bazaar' });
    } else {
      prices.set(shardId, { price: Infinity, source: 'bazaar' });
    }
  }

  // Iterate to find best crafting paths
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
  return prices;
};

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
    if (products.length === 0 || !fusionData) 
      return { flipResults: [], effectivePrices: new Map() };

    const productMap = new Map(products.map(p => [p.productId, p]));
    const prices = calculatePrices(fusionData, productMap, buyStrategy);
    const results: DetailedFlip[] = [];

    for (const [targetId] of Object.entries(fusionData.recipes)) {
      const targetShard = fusionData.shards[targetId];
      if (!targetShard) continue;
      const targetProd = productMap.get(targetShard.internal_id);
      if (!targetProd) continue;

      const bestPriceData = prices.get(targetId);
      if (!bestPriceData || bestPriceData.source === 'bazaar') continue;

      const craftCost = bestPriceData.price;
      const sellPrice = (sellStrategy === 'insta' ? targetProd.buyPrice : targetProd.sellPrice) * 0.9875;
      const profit = sellPrice - craftCost;
      const margin = (profit / sellPrice) * 100;
      const salesPerHour = targetProd.buyMovingWeek / 168;
      const maxProfitHr = profit * salesPerHour;

      if (profit > 100) {
        results.push({
          targetId,
          name: targetShard.name,
          craftCost,
          sellPrice,
          profit,
          margin,
          salesPerHour,
          maxProfitHr,
          ingredients: [], // Used by the tree
          ingredientSources: [] // Used by the tree
        });
      }
    }

    return { 
      flipResults: results.sort((a, b) => b.maxProfitHr - a.maxProfitHr).slice(0, 50),
      effectivePrices: prices
    };
  }, [products, fusionData, buyStrategy, sellStrategy]);

  if (loading || fusionsLoading) return <div className="loader-container"><div className="loader"></div></div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="main-content">
      <div className="status-hero" style={{ marginBottom: '2rem' }}>
        <h1 className="status-hero-title">Fusion Flip Rankings</h1>
        <p className="status-hero-subtitle">
          <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          Discover the most profitable shards to fuse based on real-time recursive path analysis.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Buy Strategy</h3>
          <div className="tabs-container" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <button className={`tab ${buyStrategy === 'insta' ? 'active' : ''}`} onClick={() => setBuyStrategy('insta')}>Instabuy</button>
            <button className={`tab ${buyStrategy === 'order' ? 'active' : ''}`} onClick={() => setBuyStrategy('order')}>Buy Order</button>
          </div>
        </div>
        
        <div>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Sell Strategy</h3>
          <div className="tabs-container" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <button className={`tab ${sellStrategy === 'insta' ? 'active' : ''}`} onClick={() => setSellStrategy('insta')}>Instasell</button>
            <button className={`tab ${sellStrategy === 'order' ? 'active' : ''}`} onClick={() => setSellStrategy('order')}>Sell Order</button>
          </div>
        </div>
      </div>

      <div className="glass-panel data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>Rank</th>
              <th>Shard</th>
              <th style={{ textAlign: 'right' }}>Craft Cost</th>
              <th style={{ textAlign: 'right' }}>Sell Price</th>
              <th style={{ textAlign: 'right' }}>Profit / Unit</th>
              <th style={{ textAlign: 'right' }}>Profit / Hr</th>
              <th style={{ textAlign: 'right' }}>ROI</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {flipResults.map((flip, idx) => (
              <tr key={flip.targetId} onClick={() => setSelectedFlip(flip)} style={{ cursor: 'pointer' }}>
                <td><span className="rank-badge">{idx + 1}</span></td>
                <td>
                  <div className="product-name">
                    <ItemIcon productId={flip.targetId} isShard={true} className="product-icon" />
                    <span style={{ fontWeight: 600 }}>{flip.name}</span>
                  </div>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCompact(flip.craftCost)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCompact(flip.sellPrice)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#3fb950', fontFamily: 'monospace' }}>
                  +{formatCompact(flip.profit)}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--accent-color)', fontWeight: 600, fontFamily: 'monospace' }}>
                  {formatCompact(flip.maxProfitHr)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="margin-badge" style={{ 
                    background: flip.margin > 20 ? 'rgba(63, 185, 80, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: flip.margin > 20 ? '#3fb950' : 'var(--text-primary)'
                  }}>
                    {flip.margin.toFixed(1)}%
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>View Path</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedFlip && (
        <div className="modal-overlay" onClick={() => setSelectedFlip(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '850px', 
            width: '95%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ 
              padding: '1.5rem 2rem', 
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <ItemIcon productId={selectedFlip.targetId} isShard={true} style={{ width: '40px', height: '40px' }} />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{selectedFlip.name}</h2>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#3fb950', fontWeight: 600 }}>Profit: {formatCompact(selectedFlip.profit)}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>ROI: {selectedFlip.margin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedFlip(null)} className="modal-close-btn">✕</button>
            </div>
            
            <div style={{ padding: '2rem', overflowY: 'auto', background: 'rgba(13, 17, 23, 0.4)', flex: 1 }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <Info size={16} />
                <span style={{ fontSize: '0.9rem' }}>Optimal recursive path. <b>Buy</b> nodes are Bazaar purchases, <b>Craft</b> nodes are fusions.</span>
              </div>
              
              <FusionTree 
                targetId={selectedFlip.targetId} 
                quantity={1} 
                fusionData={fusionData} 
                effectivePrices={effectivePrices}
                isRoot={true}
              />

              <div style={{ marginTop: '2.5rem', padding: '1.5rem', borderRadius: '12px', background: 'rgba(63, 185, 80, 0.05)', border: '1px solid rgba(63, 185, 80, 0.1)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Economic Outlook (Per Hr)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sales Velocity</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedFlip.salesPerHour.toFixed(1)} units / hr</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Potential Revenue</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'monospace' }}>{formatCompact(selectedFlip.sellPrice * selectedFlip.salesPerHour)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Potential Profit</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3fb950', fontFamily: 'monospace' }}>+{formatCompact(selectedFlip.maxProfitHr)}</div>
                  </div>
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
