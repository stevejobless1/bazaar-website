import React, { useState, useEffect, useMemo } from 'react';
import { ProductState, FusionRecipes, FlipResult } from './types';
import { fetchFusions } from './api';

const getItemIconUrl = (productId: string) => {
  return `https://skyshards.com/shardIcons/${productId}.png`;
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
  const [fusions, setFusions] = useState<FusionRecipes>({});
  const [fusionsLoading, setFusionsLoading] = useState(true);
  
  // Toggles for buying ingredients and selling the crafted item
  const [buyStrategy, setBuyStrategy] = useState<Strategy>('insta');
  const [sellStrategy, setSellStrategy] = useState<Strategy>('insta');

  useEffect(() => {
    fetchFusions()
      .then((data) => {
        setFusions(data);
        setFusionsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load fusions data', err);
        setFusionsLoading(false);
      });
  }, []);

  const flipResults = useMemo(() => {
    if (products.length === 0 || Object.keys(fusions).length === 0) return [];

    const results: FlipResult[] = [];
    const productMap = new Map(products.map(p => [p.productId, p]));

    for (const [targetItem, recipesByCost] of Object.entries(fusions)) {
      // recipesByCost is like { "2": [["C4", "U1"], ...] }
      for (const [, recipes] of Object.entries(recipesByCost as { [key: string]: string[][] })) {


        for (const recipe of recipes) {
          let totalCost = 0;
          let validRecipe = true;
          let minVol = Infinity;

          for (const ingredient of recipe) {
            const prod = productMap.get(ingredient);
            if (!prod) {
              validRecipe = false;
              break;
            }
            // If we Insta-Buy ingredients, we pay the sellPrice (the lowest bin / sell offer)
            // If we use Buy Orders, we pay the buyPrice (the highest buy order)
            const price = buyStrategy === 'insta' ? prod.sellPrice : prod.buyPrice;
            totalCost += price;
            
            // Track minimum volume to ensure liquidity
            const vol = buyStrategy === 'insta' ? prod.sellVolume : prod.buyVolume;
            if (vol < minVol) minVol = vol;
          }

          if (!validRecipe) continue;

          const targetProd = productMap.get(targetItem);
          if (!targetProd) continue;

          // If we Insta-Sell the crafted item, we get the buyPrice (sell to highest buy order)
          // If we use Sell Offers, we get the sellPrice (list at lowest sell offer)
          let revenue = sellStrategy === 'insta' ? targetProd.buyPrice : targetProd.sellPrice;
          
          // Deduct 1.25% Bazaar Tax when selling
          revenue = revenue * 0.9875;

          const profit = revenue - totalCost;
          const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
          const targetVolume = sellStrategy === 'insta' ? targetProd.buyVolume : targetProd.sellVolume;

          results.push({
            targetItem,
            ingredients: recipe,
            cost: totalCost,
            revenue,
            profit,
            roi,
            targetVolume,
            ingredientVolumeMin: minVol
          });
        }
      }
    }

    // Sort by most profitable
    return results.sort((a, b) => b.profit - a.profit).slice(0, 20);
  }, [products, fusions, buyStrategy, sellStrategy]);

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
          <p style={{ color: 'var(--text-secondary)' }}>Live Top 20 fusion flips using real-time market data.</p>
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
              <th>Liquidity</th>
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
                        alt={ing}
                        className="product-icon"
                        title={ing}
                        style={{ width: '24px', height: '24px' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://sky.shiiyu.moe/item/STONE'; }}
                      />
                    ))}
                  </div>
                </td>
                <td>
                  <div className="product-name">
                    <img 
                      src={getItemIconUrl(flip.targetItem)} 
                      alt={flip.targetItem} 
                      className="product-icon"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://sky.shiiyu.moe/item/STONE'; }}
                    />
                    {flip.targetItem}
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
                    <span title={formatCommas(flip.ingredientVolumeMin)}>Ing. Vol: {formatCompact(flip.ingredientVolumeMin)}</span>
                    <span title={formatCommas(flip.targetVolume)}>Tar. Vol: {formatCompact(flip.targetVolume)}</span>
                  </div>
                </td>
              </tr>
            ))}
            {flipResults.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  No profitable flips found with the current strategies or missing data.
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
