import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { Search, Activity, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { fetchLatest, fetchHistoryHighRes, fetchHistoryCandles } from './api';
import { ProductState, HistoryPoint, HistoryCandle } from './types';
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';

// --- Components ---

const Navbar = ({ products }: { products: ProductState[] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

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
      
      <form className="search-container" onSubmit={handleSearch}>
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

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="main-content">
      <h2 style={{ marginBottom: '1rem' }}>Market Overview</h2>
      
      <div className="glass-panel data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Buy Price</th>
              <th>Sell Price</th>
              <th>Margin</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            {products.sort((a, b) => b.sellVolume - a.sellVolume).slice(0, 100).map(p => {
              const formatNum = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
              const marginPct = (p.margin / p.buyPrice) * 100 || 0;
              
              return (
                <tr key={p.productId} onClick={() => navigate(`/item/${p.productId}`)}>
                  <td>
                    <div className="product-name">
                      {p.productId.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td>{formatNum(p.buyPrice)} coins</td>
                  <td>{formatNum(p.sellPrice)} coins</td>
                  <td className={p.margin >= 0 ? 'positive' : 'negative'}>
                    {formatNum(p.margin)} ({marginPct.toFixed(2)}%)
                  </td>
                  <td>{formatNum(p.sellVolume + p.buyVolume)}</td>
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
  const [timeframe, setTimeframe] = useState<'highres' | 'hourly'>('hourly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [latestStats, setLatestStats] = useState<ProductState | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    // Fetch latest stats for the side panel
    fetchLatest().then(data => {
      const match = data.find(p => p.productId === productId);
      if (match) setLatestStats(match);
    }).catch(console.error);
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
          
          series.setData(candles.map(c => ({
            time: Math.floor(c.timestamp / 1000) as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })).sort((a: any, b: any) => a.time - b.time));
          seriesRef.current = series;
        } else {
          const points = await fetchHistoryHighRes(productId, 1000);
          const series = chartRef.current.addLineSeries({
            color: '#58a6ff',
            lineWidth: 2,
          });
          
          series.setData(points.map(p => ({
            time: Math.floor(p.timestamp / 1000) as any,
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
        <h2>{productId?.replace(/_/g, ' ')}</h2>
      </div>

      <div className="detail-grid">
        <div className="glass-panel chart-container">
          <div className="chart-header">
            <div className="chart-title">Price History</div>
            <div className="chart-controls">
              <button 
                className={`btn-toggle ${timeframe === 'highres' ? 'active' : ''}`}
                onClick={() => setTimeframe('highres')}
              >
                High Res (Latest)
              </button>
              <button 
                className={`btn-toggle ${timeframe === 'hourly' ? 'active' : ''}`}
                onClick={() => setTimeframe('hourly')}
              >
                Hourly Candles
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
            <div className="stat-value">{latestStats?.sellPrice?.toLocaleString() || '---'}</div>
            <div className="stat-label" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Sell Volume: {latestStats?.sellVolume?.toLocaleString()}</div>
          </div>
          
          <div className="glass-panel stat-card">
            <div className="stat-label">Current Buy Price</div>
            <div className="stat-value">{latestStats?.buyPrice?.toLocaleString() || '---'}</div>
            <div className="stat-label" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Buy Volume: {latestStats?.buyVolume?.toLocaleString()}</div>
          </div>

          <div className="glass-panel stat-card">
            <div className="stat-label">Current Margin</div>
            <div className={`stat-value ${latestStats && latestStats.margin >= 0 ? 'positive' : 'negative'}`}>
              {latestStats?.margin?.toLocaleString() || '---'}
            </div>
            {latestStats && latestStats.buyPrice && (
              <div className="stat-label" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                {((latestStats.margin / latestStats.buyPrice) * 100).toFixed(2)}% ROI
              </div>
            )}
          </div>
        </div>
      </div>
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
        <Route path="/item/:productId" element={<ProductDetails />} />
      </Routes>
    </div>
  );
}

export default App;
