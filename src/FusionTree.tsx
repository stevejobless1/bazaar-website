import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ShoppingCart, Hammer } from 'lucide-react';
import ItemIcon from './ItemIcon';

interface FusionTreeProps {
  targetId: string;
  quantity: number;
  fusionData: any;
  effectivePrices: Map<string, { price: number; source: 'bazaar' | 'craft' }>;
  isRoot?: boolean;
}

const formatCompact = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const FusionTree: React.FC<FusionTreeProps> = ({ targetId, quantity, fusionData, effectivePrices, isRoot = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const shard = fusionData?.shards[targetId];
  const priceData = effectivePrices.get(targetId);
  const recipes = fusionData?.recipes[targetId];
  
  if (!shard) return null;

  const source = priceData?.source || 'bazaar';
  const unitPrice = priceData?.price || 0;
  const totalPrice = unitPrice * quantity;

  // Find the best recipe (the one that matches the effective price)
  let bestRecipe: string[] | null = null;
  let outputQty = 1;

  if (source === 'craft' && recipes) {
    for (const [qtyStr, recipesList] of Object.entries(recipes)) {
      const q = parseInt(qtyStr);
      for (const recipe of recipesList as string[][]) {
        let cost = 0;
        for (const ingId of recipe) {
          const ingShard = fusionData.shards[ingId];
          const ingPrice = effectivePrices.get(ingId)?.price || 0;
          cost += ingPrice * (ingShard?.fuse_amount || 0);
        }
        if (Math.abs(cost / q - unitPrice) < 0.1) {
          bestRecipe = recipe;
          outputQty = q;
          break;
        }
      }
      if (bestRecipe) break;
    }
  }

  const hasChildren = source === 'craft' && bestRecipe;

  return (
    <div className={`fusion-tree-node ${isRoot ? 'root' : ''}`} style={{ 
      marginLeft: isRoot ? 0 : '1.5rem',
      marginTop: '0.5rem',
      position: 'relative'
    }}>
      {!isRoot && (
        <div style={{
          position: 'absolute',
          left: '-1rem',
          top: '0',
          bottom: hasChildren && isExpanded ? '0' : '1.2rem',
          width: '1px',
          background: 'var(--border-color)',
          opacity: 0.5
        }} />
      )}
      {!isRoot && (
        <div style={{
          position: 'absolute',
          left: '-1rem',
          top: '1.2rem',
          width: '0.8rem',
          height: '1px',
          background: 'var(--border-color)',
          opacity: 0.5
        }} />
      )}

      <div className={`glass-panel fusion-node-content ${source}`} style={{ 
        padding: '0.75rem 1rem', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem',
        borderLeft: `3px solid ${source === 'bazaar' ? '#3fb950' : '#e3b341'}`,
        background: isRoot ? 'rgba(255, 255, 255, 0.05)' : 'rgba(13, 17, 23, 0.6)'
      }}>
        {hasChildren ? (
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              padding: 0, 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <div style={{ width: '16px' }} />
        )}

        <ItemIcon productId={targetId} isShard={true} style={{ width: '32px', height: '32px' }} />
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{quantity}x</span>
            <span className="truncate">{shard.name}</span>
            {source === 'bazaar' ? (
              <span className="source-badge bazaar" title="Buy from Bazaar">
                <ShoppingCart size={10} /> Buy
              </span>
            ) : (
              <span className="source-badge craft" title="Better to Craft">
                <Hammer size={10} /> Craft
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
            <span>Cost: {formatCompact(totalPrice)} coins</span>
            {source === 'craft' && <span>({formatCompact(unitPrice)} ea)</span>}
          </div>
        </div>

        {isRoot && (
           <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
             <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Target Yield</div>
             <div style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{quantity} units</div>
           </div>
        )}
      </div>

      {hasChildren && isExpanded && bestRecipe && (
        <div className="fusion-children">
          {bestRecipe.map((ingId, idx) => {
            const ingShard = fusionData.shards[ingId];
            const neededForOne = ingShard?.fuse_amount || 1;
            const totalNeeded = (neededForOne * quantity) / outputQty;
            
            return (
              <FusionTree 
                key={`${ingId}-${idx}`}
                targetId={ingId} 
                quantity={totalNeeded} 
                fusionData={fusionData} 
                effectivePrices={effectivePrices} 
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FusionTree;
