import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Search, Activity, TrendingUp, Radio, LogOut } from 'lucide-react';
import { fetchLatest, fetchUnifiedHistory, fetchLiveOrders, fetchMayors, fetchVolumeHistory } from './api';
import { ProductState, LiveOrderBook, HistoryPoint } from './types';
import PriceChart from './PriceChart';
import Flips from './Flips';
import Status from './Status';
import Login from './Login';

import ItemIcon from './ItemIcon';

// --- Utilities ---
const formatCommas = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const formatCompact = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

// --- Components ---

const Navbar = ({ products, onLogout }: { products: ProductState[], onLogout: () => void }) => {
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
        const cleanSearch = searchTerm.trim().toUpperCase().replace(/\s+/g, '_');
        navigate(`/item/${cleanSearch}`);
      }
    }
  };

  return (
    <nav className="navbar glass-panel">
      <Link to="/" className="navbar-brand">
        <Activity size={24} color="var(--accent-color)" />
        Bazaar<span>Tracker</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginLeft: '2rem' }}>
        <Link 
          to="/flips" 
          className={`nav-link ${location.pathname === '/flips' ? 'active' : ''}`}
        >
          <TrendingUp size={18} />
          Flips
        </Link>
        <Link 
          to="/status" 
          className={`nav-link ${location.pathname === '/status' ? 'active' : ''}`}
        >
          <Radio size={18} />
          Status
        </Link>
      </div>
      
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <form className="search-container" onSubmit={handleSearch}>
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search items..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </form>
        <button 
          onClick={onLogout}
          className="btn-icon" 
          title="Logout"
          style={{ 
            background: 'rgba(255, 255, 255, 0.05)', 
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            padding: '0.6rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
};

// --- Pages ---

const Home = ({ products, loading, error }: { products: ProductState[], loading: boolean, error: string | null }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'flips' | 'all'>('flips');

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;
  if (error) return <div className="error-message">{error}</div>;

  const enrichedProducts = products.map(p => {
    const margin = p.margin;
    const velocity = margin > 0 ? margin * Math.min(p.buyVolume, p.sellVolume) : 0;
    const marginPct = (margin / p.buyPrice) * 100 || 0;
    return { ...p, velocity, marginPct };
  });

  const displayProducts = activeTab === 'flips' 
    ? [...enrichedProducts].sort((a, b) => b.velocity - a.velocity).slice(0, 100)
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
              <th>Buy Order</th>
              <th>Sell Offer</th>
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
                      <ItemIcon productId={p.productId} className="product-icon" />
                      {p.productId.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td title={formatCommas(p.sellPrice)}>{formatCompact(p.sellPrice)} coins</td>
                  <td title={formatCommas(p.buyPrice)}>{formatCompact(p.buyPrice)} coins</td>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [latestStats, setLatestStats] = useState<ProductState | null>(null);
  const [liveOrders, setLiveOrders] = useState<LiveOrderBook | null>(null);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [volumeHistory, setVolumeHistory] = useState<{timestamp: number, buyVolume: number, sellVolume: number}[]>([]);
  const [mayors, setMayors] = useState<{ timestamp: number, name: string }[]>([]);

  useEffect(() => {
    fetchLatest().then(data => {
      const match = data.find(p => p.productId === productId);
      if (match) setLatestStats(match);
    }).catch(console.error);

    if (productId) {
      fetchLiveOrders(productId).then(data => {
        if (data.success) {
          setLiveOrders({ buy_summary: data.buy_summary, sell_summary: data.sell_summary });
        }
      }).catch(console.error);
    }
  }, [productId]);


  useEffect(() => {
    if (!productId) return;
    
    const loadData = async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const points = await fetchUnifiedHistory(productId);
        setHistoryPoints(points);
        
        if (points.length > 0) {
          const startTime = points[0].timestamp;
          const [mayorsData, volData] = await Promise.all([
            fetchMayors(startTime, Date.now()),
            fetchVolumeHistory(productId, startTime, Date.now())
          ]);
          setMayors(mayorsData);
          setVolumeHistory(volData);
        }

        fetchLatest().then(data => {
          const match = data.find(p => p.productId === productId);
          if (match) setLatestStats(match);
        });
        fetchLiveOrders(productId).then(data => {
          if (data.success) {
            setLiveOrders({ buy_summary: data.buy_summary, sell_summary: data.sell_summary });
          }
        });

      } catch (err: any) {
        if (!isRefresh) setError(err.message);
      } finally {
        if (!isRefresh) setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(() => loadData(true), 20000);
    return () => clearInterval(interval);
  }, [productId]);

  return (
    <div className="main-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>← Back to Market</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {productId && (
            <ItemIcon 
              productId={productId} 
              style={{ width: '40px', height: '40px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} 
            />
          )}
          <h2 style={{ fontSize: '1.8rem' }}>{productId?.replace(/_/g, ' ')}</h2>
        </div>
      </div>

      <div className="detail-grid">
        <div className="glass-panel chart-container" style={{ height: '900px' }}>
          <div className="chart-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <div className="chart-title">Price History</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Unified continuous linear timeline</div>
          </div>
          {loading && <div className="loader-container" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11, 14, 20, 0.5)', zIndex: 10 }}><div className="loader"></div></div>}
          {error && <div className="error-message">{error}</div>}
          <div style={{ width: '100%', height: 'calc(100% - 60px)' }}>
            {!loading && !error && historyPoints.length > 0 && (
              <PriceChart 
                key={productId} 
                data={historyPoints} 
                mayors={mayors} 
                volumeData={volumeHistory}
              />
            )}
          </div>
        </div>

        <div className="stats-sidebar">
          <div className="glass-panel stat-card">
            <div className="stat-label">Current Sell Offer</div>
            <div className="stat-value" title={latestStats ? formatCommas(latestStats.buyPrice) : ''}>
              {latestStats?.buyPrice ? formatCompact(latestStats.buyPrice) : '---'}
            </div>
            <div className="stat-label" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Filled Sell Offers: <span title={latestStats ? formatCommas(latestStats.buyVolume) : ''}>{latestStats?.buyVolume ? formatCompact(latestStats.buyVolume) : '---'}</span>
            </div>
          </div>
          
          <div className="glass-panel stat-card">
            <div className="stat-label">Current Buy Order</div>
            <div className="stat-value" title={latestStats ? formatCommas(latestStats.sellPrice) : ''}>
              {latestStats?.sellPrice ? formatCompact(latestStats.sellPrice) : '---'}
            </div>
            <div className="stat-label" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Filled Buy Orders: <span title={latestStats ? formatCommas(latestStats.sellVolume) : ''}>{latestStats?.sellVolume ? formatCompact(latestStats.sellVolume) : '---'}</span>
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

      {liveOrders && (
        <div className="glass-panel" style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} color="var(--accent-color)" />
            Live Order Book
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
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
                  {liveOrders.buy_summary.slice(0, 15).map((order) => (
                    <tr key={`${order.pricePerUnit}-${order.amount}`} className="flash-update">
                      <td style={{ color: '#3fb950', fontWeight: 500 }}>{formatCommas(order.pricePerUnit)}</td>
                      <td>{formatCommas(order.amount)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatCommas(order.orders)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                  {liveOrders.sell_summary.slice(0, 15).map((order) => (
                    <tr key={`${order.pricePerUnit}-${order.amount}`} className="flash-update">
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
  
  const [isAuthed, setIsAuthed] = useState<boolean>(() => {
    return localStorage.getItem('bt_auth') === 'true' || document.cookie.includes('bt_auth=true');
  });
  const [loginError, setLoginError] = useState<string | undefined>();

  useEffect(() => {
    if (!isAuthed) return;
    fetchLatest()
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [isAuthed]);

  const handleLogin = async (password: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (res.ok) {
        localStorage.setItem('bt_auth', 'true');
        // Set a cookie that lasts for 30 days
        const d = new Date();
        d.setTime(d.getTime() + (30*24*60*60*1000));
        document.cookie = `bt_auth=true; expires=${d.toUTCString()}; path=/; SameSite=Strict`;
        
        setIsAuthed(true);
        setLoginError(undefined);
      } else {
        setLoginError('Invalid access key. Please try again.');
      }
    } catch (err) {
      setLoginError('Server connection error. Please try again later.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bt_auth');
    document.cookie = "bt_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setIsAuthed(false);
  };

  if (!isAuthed) {
    return <Login onLogin={handleLogin} error={loginError} />;
  }

  return (
    <div className="app-container">
      <Navbar products={products} onLogout={handleLogout} />
      <div className="page-wrapper" style={{ paddingTop: '20px' }}>
        <Routes>
          <Route path="/" element={<Home products={products} loading={loading} error={error} />} />
          <Route path="/flips" element={<Flips products={products} loading={loading} error={error} />} />
          <Route path="/status" element={<Status />} />
          <Route path="/item/:productId" element={<ProductDetails />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
