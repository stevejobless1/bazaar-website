import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { HistoryPoint } from './types';

const formatCommas = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

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

const GAP_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

interface PriceChartProps {
  data: HistoryPoint[];
  mayors?: { timestamp: number; name: string }[];
}

export default function PriceChart({ data, mayors = [] }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<{ x: number, y: number, point: HistoryPoint } | null>(null);

  // Zoom / Pan state
  const [domain, setDomain] = useState<[number, number] | null>(null);
  const isDragging = useRef(false);
  const lastMouseX = useRef<number | null>(null);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const padding = { top: 30, right: 20, bottom: 40, left: 60 };
  const innerWidth = Math.max(0, width - padding.left - padding.right);
  const innerHeight = Math.max(0, height - padding.top - padding.bottom);

  // Ensure chronological order once
  const sorted = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  // Initial domain setup
  useEffect(() => {
    if (sorted.length > 0 && !domain) {
      setDomain([sorted[0].timestamp, sorted[sorted.length - 1].timestamp]);
    }
  }, [sorted, domain]);

  const parsedData = useMemo(() => {
    if (sorted.length === 0 || innerWidth === 0 || innerHeight === 0 || !domain) return null;
    
    const [domainMin, domainMax] = domain;
    
    // Find visible min/max price for the current domain
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    const visiblePoints = [];
    for (const p of sorted) {
      // Add a tiny buffer so lines connecting in/out of frame are drawn
      if (p.timestamp >= domainMin - (domainMax - domainMin) && p.timestamp <= domainMax + (domainMax - domainMin)) {
        visiblePoints.push(p);
        // Only scale y-axis for points actually visible
        if (p.timestamp >= domainMin && p.timestamp <= domainMax) {
          if (p.sellPrice < minPrice) minPrice = p.sellPrice;
          if (p.buyPrice < minPrice) minPrice = p.buyPrice;
          if (p.sellPrice > maxPrice) maxPrice = p.sellPrice;
          if (p.buyPrice > maxPrice) maxPrice = p.buyPrice;
        }
      }
    }

    if (visiblePoints.length === 0) return null;

    if (minPrice === Infinity) {
      minPrice = 0;
      maxPrice = 1;
    }

    // Add 5% buffer to price range
    const priceDiff = Math.max(maxPrice - minPrice, 1);
    minPrice = Math.max(0, minPrice - priceDiff * 0.05);
    maxPrice = maxPrice + priceDiff * 0.05;

    const getX = (t: number) => padding.left + ((t - domainMin) / (domainMax - domainMin || 1)) * innerWidth;
    const getY = (p: number) => padding.top + innerHeight - ((p - minPrice) / (maxPrice - minPrice || 1)) * innerHeight;

    // Split into segments based on GAP_THRESHOLD_MS
    const segments: HistoryPoint[][] = [];
    let currentSegment: HistoryPoint[] = [visiblePoints[0]];

    for (let i = 1; i < visiblePoints.length; i++) {
      const prev = visiblePoints[i - 1];
      const curr = visiblePoints[i];
      if (curr.timestamp - prev.timestamp > GAP_THRESHOLD_MS) {
        segments.push(currentSegment);
        currentSegment = [curr];
      } else {
        currentSegment.push(curr);
      }
    }
    segments.push(currentSegment);

    let pathDSell = '';
    let pathDBuy = '';
    let areaD = '';

    for (const seg of segments) {
      if (seg.length === 0) continue;
      
      // Buy Line
      pathDBuy += `M ${getX(seg[0].timestamp).toFixed(1)} ${getY(seg[0].buyPrice).toFixed(1)}`;
      for (let i = 1; i < seg.length; i++) {
        pathDBuy += ` L ${getX(seg[i].timestamp).toFixed(1)} ${getY(seg[i].buyPrice).toFixed(1)}`;
      }

      // Sell Line
      pathDSell += `M ${getX(seg[0].timestamp).toFixed(1)} ${getY(seg[0].sellPrice).toFixed(1)}`;
      for (let i = 1; i < seg.length; i++) {
        pathDSell += ` L ${getX(seg[i].timestamp).toFixed(1)} ${getY(seg[i].sellPrice).toFixed(1)}`;
      }

      // Area
      let segArea = `M ${getX(seg[0].timestamp).toFixed(1)} ${getY(seg[0].buyPrice).toFixed(1)}`;
      for (let i = 1; i < seg.length; i++) {
        segArea += ` L ${getX(seg[i].timestamp).toFixed(1)} ${getY(seg[i].buyPrice).toFixed(1)}`;
      }
      for (let i = seg.length - 1; i >= 0; i--) {
        segArea += ` L ${getX(seg[i].timestamp).toFixed(1)} ${getY(seg[i].sellPrice).toFixed(1)}`;
      }
      segArea += ' Z ';
      areaD += segArea;
    }

    return { domainMin, domainMax, minPrice, maxPrice, getX, getY, pathDSell, pathDBuy, areaD };
  }, [sorted, innerWidth, innerHeight, padding, domain]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!domain || sorted.length === 0 || innerWidth === 0) return;

    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const [minT, maxT] = domain;
    
    // Zoom around mouse X
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = Math.max(padding.left, Math.min(e.clientX - rect.left, padding.left + innerWidth));
    const ratio = (mouseX - padding.left) / innerWidth;
    
    const timeSpan = maxT - minT;
    const mouseTime = minT + timeSpan * ratio;
    
    let newTimeSpan = timeSpan * zoomFactor;
    
    // Limits
    const minPossibleSpan = 60 * 1000; // 1 minute min zoom
    const maxPossibleSpan = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
    newTimeSpan = Math.max(minPossibleSpan, Math.min(newTimeSpan, maxPossibleSpan * 1.5)); // Allow slightly zooming out past edges
    
    let newMinT = mouseTime - newTimeSpan * ratio;
    let newMaxT = mouseTime + newTimeSpan * (1 - ratio);
    
    // Clamp to hard boundaries
    const hardMin = sorted[0].timestamp - maxPossibleSpan * 0.1;
    const hardMax = sorted[sorted.length - 1].timestamp + maxPossibleSpan * 0.1;
    
    if (newMinT < hardMin) {
      newMinT = hardMin;
      newMaxT = hardMin + newTimeSpan;
    }
    if (newMaxT > hardMax) {
      newMaxT = hardMax;
      newMinT = hardMax - newTimeSpan;
    }

    setDomain([newMinT, newMaxT]);
  }, [domain, sorted, innerWidth, padding.left]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    lastMouseX.current = e.clientX;
    setHover(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging.current && lastMouseX.current !== null && domain) {
      const dx = e.clientX - lastMouseX.current;
      lastMouseX.current = e.clientX;
      
      const timeSpan = domain[1] - domain[0];
      const timeShift = -(dx / innerWidth) * timeSpan;
      
      setDomain([domain[0] + timeShift, domain[1] + timeShift]);
    } else if (!isDragging.current && domain && innerWidth > 0 && parsedData) {
      // Hover logic
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const targetX = e.clientX - rect.left;
      if (targetX < padding.left || targetX > padding.left + innerWidth) {
        setHover(null);
        return;
      }
      
      const targetTime = domain[0] + ((targetX - padding.left) / innerWidth) * (domain[1] - domain[0]);
      
      let left = 0;
      let right = sorted.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (sorted[mid].timestamp < targetTime) left = mid + 1;
        else right = mid - 1;
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
        x: parsedData.getX(bestPt.timestamp),
        y: parsedData.getY(bestPt.sellPrice),
        point: bestPt
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDragging.current = false;
    lastMouseX.current = null;
  };

  if (!parsedData || width === 0 || height === 0) {
    return <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading chart data...</div>;
  }

  const { domainMin, domainMax, minPrice, maxPrice, getX, getY, pathDSell, pathDBuy, areaD } = parsedData;

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', cursor: isDragging.current ? 'grabbing' : 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <svg width={width} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="margin-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 0, 160, 0.15)" />
            <stop offset="100%" stopColor="rgba(0, 229, 255, 0.15)" />
          </linearGradient>
          <clipPath id="chart-area-clip">
            <rect x={padding.left} y={0} width={innerWidth} height={height} />
          </clipPath>
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
          const t = domainMin + (domainMax - domainMin) * ratio;
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

        {/* Chart Area and Lines (Clipped to prevent drawing outside bounds during pan/zoom) */}
        <g clipPath="url(#chart-area-clip)">
          <path d={areaD} fill="url(#margin-gradient)" />
          <path d={pathDBuy} fill="none" stroke="#ff00a0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathDSell} fill="none" stroke="#00e5ff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Mayor Markers */}
          {mayors.map(m => {
            if (m.timestamp < domainMin || m.timestamp > domainMax) return null;
            const x = getX(m.timestamp);
            return (
              <g key={m.timestamp}>
                <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="rgba(227, 179, 65, 0.3)" strokeDasharray="4 4" strokeWidth="1" />
                <polygon points={`${x-6},${padding.top} ${x+6},${padding.top} ${x},${padding.top + 8}`} fill="#e3b341" />
                <text x={x} y={padding.top - 8} fill="#e3b341" fontSize="12" fontWeight="bold" textAnchor="middle">{m.name}</text>
              </g>
            );
          })}

          {/* Hover Crosshair */}
          {!isDragging.current && hover && hover.x >= padding.left && hover.x <= padding.left + innerWidth && (
            <g>
              <line x1={hover.x} y1={padding.top} x2={hover.x} y2={height - padding.bottom} stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
              <circle cx={hover.x} cy={getY(hover.point.buyPrice)} r="5" fill="#0b0e14" stroke="#ff00a0" strokeWidth="2" />
              <circle cx={hover.x} cy={getY(hover.point.sellPrice)} r="5" fill="#0b0e14" stroke="#00e5ff" strokeWidth="2" />
            </g>
          )}
        </g>
      </svg>

      {/* HTML Tooltip */}
      {!isDragging.current && hover && hover.x >= padding.left && hover.x <= padding.left + innerWidth && (
        <div 
          className="glass-panel"
          style={{
            position: 'absolute',
            left: `${hover.x}px`,
            top: '20px',
            pointerEvents: 'none',
            padding: '12px 16px',
            minWidth: '200px',
            zIndex: 10,
            transform: hover.x > padding.left + innerWidth / 2 ? 'translate(calc(-100% - 20px), 0)' : 'translate(20px, 0)',
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
