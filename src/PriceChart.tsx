import React, { useState, useRef, useMemo } from 'react';
import { HistoryPoint } from './types';

const formatCommas = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

// Helper to format time nicely depending on how old it is
const formatTime = (ts: number) => {
  const date = new Date(ts);
  const now = new Date();
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
  
  if (diffDays < 1) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    return date.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
};

interface PriceChartProps {
  data: HistoryPoint[];
  mayors?: { timestamp: number; name: string }[];
}

export default function PriceChart({ data, mayors = [] }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number, y: number, point: HistoryPoint } | null>(null);

  // Use a fixed viewBox coordinate system that will perfectly scale to the container.
  const width = 1000;
  const height = 450;
  const padding = { top: 30, right: 20, bottom: 40, left: 60 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const parsedData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    // Ensure chronological order
    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
    
    const minTime = sorted[0].timestamp;
    const maxTime = sorted[sorted.length - 1].timestamp;
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    for (const p of sorted) {
      if (p.sellPrice < minPrice) minPrice = p.sellPrice;
      if (p.buyPrice < minPrice) minPrice = p.buyPrice;
      if (p.sellPrice > maxPrice) maxPrice = p.sellPrice;
      if (p.buyPrice > maxPrice) maxPrice = p.buyPrice;
    }

    // Add 5% buffer to price range
    const priceDiff = Math.max(maxPrice - minPrice, 1);
    minPrice = Math.max(0, minPrice - priceDiff * 0.05);
    maxPrice = maxPrice + priceDiff * 0.05;

    const getX = (t: number) => padding.left + ((t - minTime) / (maxTime - minTime || 1)) * innerWidth;
    const getY = (p: number) => padding.top + innerHeight - ((p - minPrice) / (maxPrice - minPrice || 1)) * innerHeight;

    let pathDSell = `M ${getX(sorted[0].timestamp)} ${getY(sorted[0].sellPrice)}`;
    let pathDBuy = `M ${getX(sorted[0].timestamp)} ${getY(sorted[0].buyPrice)}`;
    
    for (let i = 1; i < sorted.length; i++) {
      pathDSell += ` L ${getX(sorted[i].timestamp)} ${getY(sorted[i].sellPrice)}`;
      pathDBuy += ` L ${getX(sorted[i].timestamp)} ${getY(sorted[i].buyPrice)}`;
    }

    // Area between buyPrice and sellPrice to represent the margin spread visually
    // We go left-to-right along buyPrice, then right-to-left along sellPrice, then close.
    let areaD = pathDBuy;
    for (let i = sorted.length - 1; i >= 0; i--) {
      areaD += ` L ${getX(sorted[i].timestamp)} ${getY(sorted[i].sellPrice)}`;
    }
    areaD += ' Z';

    return { sorted, minTime, maxTime, minPrice, maxPrice, getX, getY, pathDSell, pathDBuy, areaD };
  }, [data, innerWidth, innerHeight, padding]);

  if (!parsedData) {
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading chart data...</div>;
  }

  const { sorted, minTime, maxTime, minPrice, maxPrice, getX, getY, pathDSell, pathDBuy, areaD } = parsedData;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    
    const svgP = pt.matrixTransform(ctm.inverse());
    const targetX = svgP.x;
    
    // Find closest point by time
    const targetTime = minTime + ((targetX - padding.left) / innerWidth) * (maxTime - minTime);
    
    let left = 0;
    let right = sorted.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (sorted[mid].timestamp < targetTime) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    const idx = Math.max(0, Math.min(left, sorted.length - 1));
    const neighbors = [sorted[Math.max(0, idx - 1)], sorted[idx], sorted[Math.min(sorted.length - 1, idx + 1)]];
    
    let bestDist = Infinity;
    let bestPt = neighbors[0];
    for (const p of neighbors) {
      if (p) {
        const dist = Math.abs(p.timestamp - targetTime);
        if (dist < bestDist) {
          bestDist = dist;
          bestPt = p;
        }
      }
    }

    setHover({
      x: getX(bestPt.timestamp),
      y: getY(bestPt.sellPrice), // We use sellPrice for the vertical anchor roughly
      point: bestPt
    });
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${width} ${height}`} 
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        style={{ overflow: 'visible', cursor: 'crosshair', display: 'block' }}
      >
        <defs>
          <linearGradient id="margin-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 0, 160, 0.15)" />
            <stop offset="100%" stopColor="rgba(0, 229, 255, 0.15)" />
          </linearGradient>
        </defs>

        {/* Grid lines (Y axis) */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = padding.top + innerHeight * ratio;
          return (
            <g key={`grid-y-${ratio}`}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(48, 54, 61, 0.3)" strokeWidth="1" />
              <text x={padding.left - 10} y={y} fill="var(--text-secondary)" fontSize="12" textAnchor="end" dominantBaseline="middle">
                {formatCommas(minPrice + (maxPrice - minPrice) * (1 - ratio))}
              </text>
            </g>
          );
        })}

        {/* Time labels (X axis) */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const x = padding.left + innerWidth * ratio;
          const t = minTime + (maxTime - minTime) * ratio;
          return (
            <text key={`grid-x-${ratio}`} x={x} y={height - 15} fill="var(--text-secondary)" fontSize="12" textAnchor="middle">
              {formatTime(t)}
            </text>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${padding.left + 20}, ${padding.top + 20})`}>
          <rect x="0" y="0" width="12" height="12" fill="#ff00a0" rx="2" />
          <text x="20" y="10" fill="var(--text-secondary)" fontSize="12" dominantBaseline="middle">Buy Price (Insta-Buy)</text>
          
          <rect x="150" y="0" width="12" height="12" fill="#00e5ff" rx="2" />
          <text x="170" y="10" fill="var(--text-secondary)" fontSize="12" dominantBaseline="middle">Sell Price (Insta-Sell)</text>
        </g>

        {/* Chart Area and Lines */}
        <path d={areaD} fill="url(#margin-gradient)" vectorEffect="non-scaling-stroke" />
        <path d={pathDBuy} fill="none" stroke="#ff00a0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={pathDSell} fill="none" stroke="#00e5ff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {/* Mayor Markers */}
        {mayors.map(m => {
          if (m.timestamp < minTime || m.timestamp > maxTime) return null;
          const x = getX(m.timestamp);
          return (
            <g key={m.timestamp}>
              <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="rgba(227, 179, 65, 0.3)" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <polygon points={`${x-6},${padding.top} ${x+6},${padding.top} ${x},${padding.top + 8}`} fill="#e3b341" />
              <text x={x} y={padding.top - 8} fill="#e3b341" fontSize="12" fontWeight="bold" textAnchor="middle">{m.name}</text>
            </g>
          );
        })}

        {/* Hover Crosshair */}
        {hover && (
          <g>
            <line x1={hover.x} y1={padding.top} x2={hover.x} y2={height - padding.bottom} stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={hover.x} cy={getY(hover.point.buyPrice)} r="5" fill="#0b0e14" stroke="#ff00a0" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <circle cx={hover.x} cy={getY(hover.point.sellPrice)} r="5" fill="#0b0e14" stroke="#00e5ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>

      {/* HTML Tooltip (Absolutely positioned over the SVG) */}
      {hover && (
        <div 
          className="glass-panel"
          style={{
            position: 'absolute',
            // convert SVG coordinates back to container percentages for exact CSS positioning
            left: `${((hover.x) / width) * 100}%`,
            top: '20px',
            pointerEvents: 'none',
            padding: '12px 16px',
            minWidth: '200px',
            zIndex: 10,
            transform: hover.x > width / 2 ? 'translate(calc(-100% - 20px), 0)' : 'translate(20px, 0)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            {new Date(hover.point.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Buy Price</span>
            <span style={{ fontWeight: 'bold', color: '#ff00a0' }}>{formatCommas(hover.point.buyPrice)}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sell Price</span>
            <span style={{ fontWeight: 'bold', color: '#00e5ff' }}>{formatCommas(hover.point.sellPrice)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Margin</span>
            <span style={{ fontWeight: 'bold', color: hover.point.buyPrice - hover.point.sellPrice > 0 ? '#3fb950' : '#f85149', fontSize: '0.9rem' }}>
              {formatCommas(hover.point.buyPrice - hover.point.sellPrice)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
