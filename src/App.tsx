import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Search, Activity, TrendingUp, Radio } from 'lucide-react';
import { fetchLatest, fetchHistoryHighRes, fetchHistoryCandles, fetchLiveOrders } from './api';
import { ProductState, LiveOrderBook } from './types';
import { createChart, ColorType } from 'lightweight-charts';
import Flips from './Flips';
import Status from './Status';

// --- Utilities ---
const formatCommas = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const formatCompact = (n: number) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// Helper to get item icons from a public repository (SkyCrypt uses Skyblock Item Textures)
const getItemIconUrl = (productId: string) => {
  // Common edge cases mapping can go here if needed
  const cleanId = productId.replace(/(:[0-9]+)/g, ''); // Remove tier numbers if any
  return `https://sky.shiiyu.moe/item/${cleanId}`;
};

// --- Components ---

const Navbar = ({ products }: { products: ProductState[] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      const match = products.find(p => p.productId.toLowerCase().includes(searchTerm.toLowerCase()));
      if (match) {
        navigate(`/item/${match.productId}`);
        setSearchTerm('');
      } else {
        navigate(`/item/${searchTerm.toUpperCase()}`);
      }
    }
  };

  return (
    <nav className="navbar glass-panel">
      <Link to="/" className="navbar-brand">
        <Activity size={24} color="var(--accent-color)" />
        Bazaar<span>Tracker</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '2rem' }}>
        <Link 
          to="/flips" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            textDecoration: 'none', 
            color: location.pathname === '/flips' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: location.pathname === '/flips' ? 600 : 500,
            transition: 'color 0.2s'
          }}
        >
          <TrendingUp size={18} />
          Flips
        </Link>
        <Link 
          to="/status" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            textDecoration: 'none', 
            color: location.pathname === '/status' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: location.pathname === '/status' ? 600 : 500,
            transition: 'color 0.2s'
          }}
        >
          <Radio size={18} />
          Status
        </Link>
      </div>
      
      <form className="search-container" onSubmit={handleSearch} style={{ marginLeft: 'auto' }}>
        <Search className="search-icon" size={18} />
        <input 
          type="text" 
          className="search-input" 
          placeholder="Search items (e.g. ENCHANTED_BONE)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </form>
    </nav>
  );
};

// --- Pages ---

const Home = ({ products, loading, error }: { products: ProductState[], loading: boolean, error: string | null }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'flips' | 'all'>('flips');

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;
  if (error) return <div className="error-message">{error}</div>;

  // Calculate profit metrics
  const enrichedProducts = products.map(p => {
    const margin = p.margin;
    // Profit Velocity: Margin * daily volume (using min to represent actual trading throughput)
    const velocity = margin > 0 ? margin * Math.min(p.buyVolume, p.sellVolume) : 0;
    const marginPct = (margin / p.buyPrice) * 100 || 0;
    return { ...p, velocity, marginPct };
  });

  const displayProducts = activeTab === 'flips' 
    ? [...enrichedProducts].sort((a, b) => b.velocity - a.velocity).slice(0, 100) // Top 100 flips
    : [...enrichedProducts].sort((a, b) => b.sellVolume - a.sellVolume);

  return (
    <div className="main-content">
      <div className="tabs-container">
        <button 
          className={`tab ${activeTab === 'flips' ? 'active' : ''}`}
          onClick={() => setActiveTab('flips')}
        >
          Top Flips
        </button>
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Items
        </button>
      </div>
      
      <div className="glass-panel data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Buy Price</th>
              <th>Sell Price</th>
              <th>Margin</th>
              {activeTab === 'flips' ? <th>Profit Velocity</th> : <th>Volume</th>}
            </tr>
          </thead>
          <tbody>
            {displayProducts.map(p => {
              const totalVolume = p.sellVolume + p.buyVolume;
              
              return (
                <tr key={p.productId} onClick={() => navigate(`/item/${p.productId}`)} title={`Click to view details for ${p.productId}`}>
                  <td>
                    <div className="product-name">
                      <img src={getItemIconUrl(p.productId)} alt="" className="product-icon" onError={(e) => {
                        // Fallback to a generic block if image fails to load
                        (e.target as HTMLImageElement).src = 'https://sky.shiiyu.moe/item/STONE';
                      }} />
                      {p.productId.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td title={formatCommas(p.buyPrice)}>{formatCompact(p.buyPrice)} coins</td>
                  <td title={formatCommas(p.sellPrice)}>{formatCompact(p.sellPrice)} coins</td>
                  <td className={p.margin >= 0 ? 'positive' : 'negative'} title={formatCommas(p.margin)}>
                    {formatCompact(p.margin)} ({p.marginPct.toFixed(2)}%)
                  </td>
                  {activeTab === 'flips' ? (
                    <td title={formatCommas(p.velocity)} style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                      {formatCompact(p.velocity)}
                    </td>
                  ) : (
                    <td title={formatCommas(totalVolume)}>{formatCompact(totalVolume)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProductDetails = () => {
  const { productId } = useParams<{ productId: string }>();
  // Default to High Res for that premium Area Chart look
  const [timeframe, setTimeframe] = useState<'highres' | 'hourly'>('highres');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [latestStats, setLatestStats] = useState<ProductState | null>(null);
  const [liveOrders, setLiveOrders] = useState<LiveOrderBook | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    // Fetch latest stats for the side panel
    fetchLatest().then(data => {
      const match = data.find(p => p.productId === productId);
      if (match) setLatestStats(match);
    }).catch(console.error);

    // Fetch live order book
    if (productId) {
      fetchLiveOrders(productId).then(data => {
        if (data.success) {
          setLiveOrders({ buy_summary: data.buy_summary, sell_summary: data.sell_summary });
        }
      }).catch(console.error);
    }
  }, [productId]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: 'rgba(48, 54, 61, 0.5)' },
        horzLines: { color: 'rgba(48, 54, 61, 0.5)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    });
    
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!productId || !chartRef.current) return;
    
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (seriesRef.current) {
          chartRef.current.removeSeries(seriesRef.current);
        }

        if (timeframe === 'hourly') {
          const candles = await fetchHistoryCandles(productId);
          const series = chartRef.current.addCandlestickSeries({
            upColor: '#3fb950',
            downColor: '#f85149',
            borderVisible: false,
            wickUpColor: '#3fb950',
            wickDownColor: '#f85149',
          });
          
          const tzOffset = new Date().getTimezoneOffset() * 60000;
          
          series.setData(candles.map(c => ({
            time: Math.floor((c.timestamp - tzOffset) / 1000) as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })).sort((a: any, b: any) => a.time - b.time));
          seriesRef.current = series;
        } else {
          const points = await fetchHistoryHighRes(productId, 2000); // Fetch more for nice area chart
          const series = chartRef.current.addAreaSeries({
            lineColor: '#00e5ff',
            topColor: 'rgba(0, 229, 255, 0.4)',
            bottomColor: 'rgba(0, 229, 255, 0.0)',
            lineWidth: 2,
          });
          
          const tzOffset = new Date().getTimezoneOffset() * 60000;

          series.setData(points.map(p => ({
            time: Math.floor((p.timestamp - tzOffset) / 1000) as any,
            value: p.sellPrice,
          })).sort((a: any, b: any) => a.time - b.time));
          seriesRef.current = series;
        }
        
        chartRef.current.timeScale().fitContent();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [productId, timeframe]);

  return (
    <div className="main-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>← Back to Market</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {productId && (
            <img 
              src={getItemIconUrl(productId)} 
              alt="" 
              style={{ width: '40px', height: '40px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} 
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://sky.shiiyu.moe/item/STONE'; }} 
            />
          )}
          <h2 style={{ fontSize: '1.8rem' }}>{productId?.replace(/_/g, ' ')}</h2>
        </div>
      </div>

      <div className="detail-grid">
        <div className="glass-panel chart-container">
          <div className="chart-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <div className="chart-title">Price History</div>
            <div className="tabs-container" style={{ marginBottom: 0, borderBottom: 'none' }}>
              <button 
                className={`tab ${timeframe === 'highres' ? 'active' : ''}`}
                onClick={() => setTimeframe('highres')}
                style={{ padding: '0.25rem 1rem', fontSize: '0.85rem' }}
              >
                Recent (High-Res Area)
              </button>
              <button 
                className={`tab ${timeframe === 'hourly' ? 'active' : ''}`}
                onClick={() => setTimeframe('hourly')}
                style={{ padding: '0.25rem 1rem', fontSize: '0.85rem' }}
              >
                Historical (Candles)
              </button>
            </div>
          </div>
          {loading && <div className="loader-container" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11, 14, 20, 0.5)', zIndex: 10 }}><div className="loader"></div></div>}
          {error && <div className="error-message">{error}</div>}
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        <div className="stats-sidebar">
          <div className="glass-panel stat-card">
            <div className="stat-label">Current Sell Price</div>
            <div className="stat-value" title={latestStats ? formatCommas(latestStats.sellPrice) : ''}>
              {latestStats?.sellPrice ? formatCompact(latestStats.sellPrice) : '---'}
            </div>
            <div className="stat-label" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Sell Volume: <span title={latestStats ? formatCommas(latestStats.sellVolume) : ''}>{latestStats?.sellVolume ? formatCompact(latestStats.sellVolume) : '---'}</span>
            </div>
          </div>
          
          <div className="glass-panel stat-card">
            <div className="stat-label">Current Buy Price</div>
            <div className="stat-value" title={latestStats ? formatCommas(latestStats.buyPrice) : ''}>
              {latestStats?.buyPrice ? formatCompact(latestStats.buyPrice) : '---'}
            </div>
            <div className="stat-label" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Buy Volume: <span title={latestStats ? formatCommas(latestStats.buyVolume) : ''}>{latestStats?.buyVolume ? formatCompact(latestStats.buyVolume) : '---'}</span>
            </div>
          </div>

          <div className="glass-panel stat-card">
            <div className="stat-label">Current Margin</div>
            <div 
              className={`stat-value ${latestStats && latestStats.margin >= 0 ? 'positive' : 'negative'}`}
              title={latestStats ? formatCommas(latestStats.margin) : ''}
            >
              {latestStats?.margin != null ? formatCompact(latestStats.margin) : '---'}
            </div>
            {latestStats && latestStats.buyPrice > 0 && (
              <div className="stat-label" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                {((latestStats.margin / latestStats.buyPrice) * 100).toFixed(2)}% ROI
              </div>
            )}
          </div>

          {/* Flipper Insights */}
          {latestStats && latestStats.buyPrice > 0 && (
            <div className="glass-panel stat-card" style={{ borderLeft: '3px solid #e3b341' }}>
              <div className="stat-label" style={{ color: '#e3b341', fontWeight: 600 }}>Flipper Insights</div>
              
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Buy Order (Cost):</span>
                  <span>{formatCommas(latestStats.sellPrice)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Sell Offer (Revenue):</span>
                  <span>{formatCommas(latestStats.buyPrice)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Bazaar Tax (1.25%):</span>
                  <span className="negative">-{formatCommas(latestStats.buyPrice * 0.0125)}</span>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Net Profit / Item:</span>
                  <span className={(latestStats.buyPrice * 0.9875 - latestStats.sellPrice) >= 0 ? 'positive' : 'negative'}>
                    {formatCommas(latestStats.buyPrice * 0.9875 - latestStats.sellPrice)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order Book Section */}
      {liveOrders && (
        <div className="glass-panel" style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} color="var(--accent-color)" />
            Live Order Book
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {/* Buy Orders (Bids) */}
            <div>
              <h4 style={{ color: '#3fb950', marginBottom: '0.75rem', fontWeight: 600 }}>Top Buy Orders (Bids)</h4>
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ color: 'var(--text-secondary)' }}>Price per unit</th>
                    <th style={{ color: 'var(--text-secondary)' }}>Amount</th>
                    <th style={{ color: 'var(--text-secondary)' }}>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {liveOrders.buy_summary.slice(0, 15).map((order, i) => (
                    <tr key={i}>
                      <td style={{ color: '#3fb950', fontWeight: 500 }}>{formatCommas(order.pricePerUnit)}</td>
                      <td>{formatCommas(order.amount)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatCommas(order.orders)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sell Orders (Asks) */}
            <div>
              <h4 style={{ color: '#f85149', marginBottom: '0.75rem', fontWeight: 600 }}>Top Sell Offers (Asks)</h4>
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ color: 'var(--text-secondary)' }}>Price per unit</th>
                    <th style={{ color: 'var(--text-secondary)' }}>Amount</th>
                    <th style={{ color: 'var(--text-secondary)' }}>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {liveOrders.sell_summary.slice(0, 15).map((order, i) => (
                    <tr key={i}>
                      <td style={{ color: '#f85149', fontWeight: 500 }}>{formatCommas(order.pricePerUnit)}</td>
                      <td>{formatCommas(order.amount)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatCommas(order.orders)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- App ---

function App() {
  const [products, setProducts] = useState<ProductState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLatest()
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="app-container">
      <Navbar products={products} />
      <Routes>
        <Route path="/" element={<Home products={products} loading={loading} error={error} />} />
        <Route path="/flips" element={<Flips products={products} loading={loading} error={error} />} />
        <Route path="/status" element={<Status />} />
        <Route path="/item/:productId" element={<ProductDetails />} />
      </Routes>
    </div>
  );
}

export default App;
