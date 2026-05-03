import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Database, HardDrive,
  Server, TrendingUp,
  Package, Layers, RefreshCw, Zap,
  MousePointerClick, Flame, Globe
} from 'lucide-react';

// --- Types ---
interface UptimePoint {
  date: string;
  uptimePct: number;
  status: 'operational' | 'degraded' | 'down';
}

interface StatusData {
  database: {
    sizeBytes: number;
    sizeMB: number;
    pageCount: number;
    pageSize: number;
    tables: {
      prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
      one_min_prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
      five_min_prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
      ten_min_prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
      thirty_min_prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
      hourly_prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
      daily_prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
      products: { rows: number };
      live_orders: { rows: number };
    };
  };
  market: {
    totalProducts: number;
    totalBuyVolume: number;
    totalSellVolume: number;
    totalBuyOrders: number;
    totalSellOrders: number;
    positiveMarginItems: number;
    negativeMarginItems: number;
    averageMargin: number;
    estimatedMarketCap: number;
    topMarginProduct: { productId: string; margin: number };
    topVolumeProduct: { productId: string; volume: number };
    marketVolatility: number;
    totalMarketDepth: number;
    topFlip: { productId: string; percentage: number };
  };
  uptime: {
    serverStartedAt: number;
    uptimeMs: number;
    history: {
      tracker: UptimePoint[];
      api: UptimePoint[];
      downsampler: UptimePoint[];
    };
  };
  timestamp: number;
}

interface ServiceCheck {
  name: string;
  id: keyof StatusData['uptime']['history'];
  url: string;
  status: 'online' | 'degraded' | 'offline' | 'checking';
  responseTime: number | null;
  lastChecked: number | null;
}

// --- Utilities ---
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const formatCompact = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n.toString();
};

const formatUptime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const formatTimeAgo = (timestamp: number | null) => {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// --- Components ---



const PulsingDot = ({ status }: { status: 'online' | 'degraded' | 'offline' | 'checking' }) => {
  const colors = { online: '#3fb950', degraded: '#e3b341', offline: '#f85149', checking: '#8b949e' };
  return (
    <span className="pulsing-dot-container">
      <span className="pulsing-dot" style={{ backgroundColor: colors[status] }} />
      {status === 'online' && <span className="pulsing-ring" style={{ borderColor: colors[status] }} />}
    </span>
  );
};

const UptimeBar = ({ history }: { history: UptimePoint[] }) => {
  // Use full history or at least the available history
  const displayHistory = history.length > 0 ? history : [{ date: '', uptimePct: 100, status: 'operational' as const }];
  const firstDate = displayHistory[0]?.date ? new Date(displayHistory[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Start';

  return (
    <div className="uptime-history-container">
      <div className="uptime-bar" style={{ gridTemplateColumns: `repeat(${displayHistory.length}, 1fr)` }}>
        {displayHistory.map((point, i) => (
          <div
            key={i}
            className={`uptime-slot ${point.status}`}
            title={`${point.date || 'No data'}: ${point.uptimePct}% uptime`}
          />
        ))}
      </div>
      <div className="uptime-footer">
        <span>{firstDate}</span>
        <span className="uptime-line"></span>
        <span>{history[history.length - 1]?.uptimePct || 100}% uptime</span>
        <span className="uptime-line"></span>
        <span>Today</span>
      </div>
    </div>
  );
};

const StorageGauge = ({ usedMB, estimatedMaxMB }: { usedMB: number; estimatedMaxMB: number }) => {
  const pct = Math.min((usedMB / estimatedMaxMB) * 100, 100);
  const getColor = () => {
    if (pct < 50) return '#3fb950';
    if (pct < 75) return '#e3b341';
    return '#f85149';
  };

  return (
    <div className="storage-gauge">
      <div className="gauge-header">
        <span><HardDrive size={16} /> Database Storage</span>
        <span className="gauge-value">{usedMB.toFixed(2)} MB</span>
      </div>
      <div className="gauge-bar-track">
        <div
          className="gauge-bar-fill"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${getColor()}88, ${getColor()})` }}
        />
      </div>
      <div className="gauge-footer">
        <span>{pct.toFixed(1)}% of ~{estimatedMaxMB} MB estimated capacity</span>
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, subValue, color, onClick, trend }: {
  icon: any; label: string; value: string; subValue?: string; color?: string; onClick?: () => void; trend?: string;
}) => (
  <div className="glass-panel metric-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
    <div className="metric-header">
      <div className="metric-icon" style={{ color: color || 'var(--accent-color)', background: `${color}11` || 'rgba(0, 229, 255, 0.05)' }}>
        <Icon size={20} />
      </div>
      {trend && <span className="metric-trend">{trend}</span>}
    </div>
    <div className="metric-info">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
      {subValue && <div className="metric-sub">{subValue}</div>}
    </div>
  </div>
);



// --- Main Status Page ---

const Status = () => {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceCheck[]>([
    { name: 'Tracker Service', id: 'tracker', url: '/api/status', status: 'checking', responseTime: null, lastChecked: null },
    { name: 'Bazaar API Backbone', id: 'api', url: '/api/status', status: 'checking', responseTime: null, lastChecked: null },
    { name: 'Maintenance Service', id: 'downsampler', url: '/api/status', status: 'checking', responseTime: null, lastChecked: null },
  ]);
  const [uptimeDisplay, setUptimeDisplay] = useState('');
  const uptimeRef = useRef<number>(0);

  // Fetch status data
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('Status endpoint unavailable');
      const json = await res.json();
      if (json.success) {
        setStatusData(json);
        uptimeRef.current = json.uptime.uptimeMs;
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Check service health
  const checkService = async (index: number) => {
    const svc = services[index];
    const start = performance.now();
    try {
      const res = await fetch(svc.url);
      const elapsed = Math.round(performance.now() - start);

      setServices(prev => {
        const updated = [...prev];
        updated[index] = {
          ...svc,
          status: res.ok ? 'online' : 'degraded',
          responseTime: elapsed,
          lastChecked: Date.now()
        };
        return updated;
      });
    } catch {
      setServices(prev => {
        const updated = [...prev];
        updated[index] = { ...svc, status: 'offline', responseTime: null, lastChecked: Date.now() };
        return updated;
      });
    }
  };

  useEffect(() => {
    fetchStatus();
    services.forEach((_, i) => checkService(i));

    const interval = setInterval(() => {
      fetchStatus();
      services.forEach((_, i) => checkService(i));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Live uptime ticker
  useEffect(() => {
    const tick = setInterval(() => {
      uptimeRef.current += 1000;
      setUptimeDisplay(formatUptime(uptimeRef.current));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const allOnline = services.every(s => s.status === 'online');
  const anyOffline = services.some(s => s.status === 'offline');
  const anyChecking = services.some(s => s.status === 'checking');

  return (
    <div className="main-content status-page">
      {/* Hero Header */}
      <div className="status-hero">
        <div className="status-hero-content">
          <div className="status-hero-icon">
            <PulsingDot status={anyOffline ? 'offline' : allOnline ? 'online' : 'degraded'} />
          </div>
          <div>
            <h1 className="status-hero-title">
              {anyChecking ? 'Checking Systems...' : anyOffline ? 'Partial Outage' : allOnline ? 'All Systems Operational' : 'Some Systems Degraded'}
            </h1>
            <p className="status-hero-sub">
              Last checked {formatTimeAgo(services[0]?.lastChecked)} • Auto-refreshes every 60s
            </p>
          </div>
        </div>
      </div>

      {/* Service Health Section with Uptime Bars */}
      <div className="status-section">
        <h2 className="section-title"><Server size={20} /> Service Infrastructure</h2>
        <div className="service-detailed-grid">
          {services.map((svc, i) => (
            <div key={i} className="glass-panel service-uptime-card">
              <div className="service-uptime-header">
                <div className="service-info">
                  <div className="service-name-row">
                    <span className={`status-indicator ${svc.status}`}></span>
                    <h3>{svc.name}</h3>
                  </div>
                  <div className="service-meta">
                    {svc.status === 'online' ? (
                      <span className="operational-text">Operational</span>
                    ) : (
                      <span className={`${svc.status}-text`}>{svc.status.toUpperCase()}</span>
                    )}
                    <span className="meta-divider">•</span>
                    <span>{svc.responseTime ? `${svc.responseTime}ms` : 'No response'}</span>
                  </div>
                </div>
                <div className="service-actions">
                  <RefreshCw size={14} className="action-icon" onClick={() => checkService(i)} />
                </div>
              </div>
              
              {statusData && (
                <UptimeBar history={statusData.uptime.history[svc.id]} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '1rem 0' }}>
          ⚠️ Could not reach the status API: {error}. Some analytics may be unavailable.
        </div>
      )}

      {statusData && (
        <>
          {/* Market Intelligence */}
          <div className="status-section">
            <h2 className="section-title"><TrendingUp size={20} /> Market Intelligence</h2>
            <div className="metrics-grid">
              <MetricCard
                icon={Package}
                label="Tracked Products"
                value={formatNumber(statusData.market.totalProducts)}
                subValue={`${statusData.market.positiveMarginItems} healthy spreads`}
                color="#00e5ff"
              />
              <MetricCard
                icon={Flame}
                label="Market Volatility"
                value={`${statusData.market.marketVolatility}%`}
                subValue="Avg price swing (24h)"
                color="#ff5f00"
                trend="+1.2%"
              />
              <MetricCard
                icon={Zap}
                label="Top Flip Yield"
                value={`${statusData.market.topFlip.percentage}%`}
                subValue={statusData.market.topFlip.productId.replace(/_/g, ' ')}
                color="#a371f7"
              />
              <MetricCard
                icon={MousePointerClick}
                label="Total Market Depth"
                value={formatCompact(statusData.market.totalMarketDepth)}
                subValue="Active bazaar orders"
                color="#3fb950"
              />
              <MetricCard
                icon={Globe}
                label="Estimated Market Cap"
                value={formatCompact(statusData.market.estimatedMarketCap)}
                subValue="Combined item value"
                color="#e3b341"
              />
              <MetricCard
                icon={Activity}
                label="Average Margin"
                value={`${statusData.market.averageMargin} coins`}
                subValue="Per item spread"
                color="#3fb950"
              />
            </div>
          </div>

          <div className="status-dual-grid">
            {/* Database & Storage */}
            <div className="status-section">
              <h2 className="section-title"><Database size={20} /> Data Integrity</h2>
              <div className="glass-panel db-storage-panel">
                <StorageGauge usedMB={statusData.database.sizeMB} estimatedMaxMB={1000} />

                <div className="db-meta-row">
                  <div className="db-meta">
                    <span className="db-meta-label">Storage Engine</span>
                    <span className="db-meta-value">SQLite WAL</span>
                  </div>
                  <div className="db-meta">
                    <span className="db-meta-label">Data Retention</span>
                    <span className="db-meta-value">Multi-Tier</span>
                  </div>
                  <div className="db-meta">
                    <span className="db-meta-label">Page Size</span>
                    <span className="db-meta-value">{formatBytes(statusData.database.pageSize)}</span>
                  </div>
                </div>

                <div className="table-breakdown-mini">
                   <table className="status-table">
                    <thead>
                      <tr>
                        <th>Tier</th>
                        <th>Resolution</th>
                        <th>Retention</th>
                        <th>Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><Layers size={12} /> Real-time</td>
                        <td>20s (Raw)</td>
                        <td>1 Day</td>
                        <td>{formatNumber(statusData.database.tables.prices.rows)}</td>
                      </tr>
                      <tr>
                        <td><Layers size={12} /> High-Res</td>
                        <td>1m (Agg)</td>
                        <td>3 Days</td>
                        <td>{formatNumber(statusData.database.tables.one_min_prices.rows)}</td>
                      </tr>
                      <tr>
                        <td><Layers size={12} /> High-Res</td>
                        <td>5m (Agg)</td>
                        <td>1 Week</td>
                        <td>{formatNumber(statusData.database.tables.five_min_prices.rows)}</td>
                      </tr>
                      <tr>
                        <td><Layers size={12} /> Mid-Res</td>
                        <td>10m (Agg)</td>
                        <td>2 Weeks</td>
                        <td>{formatNumber(statusData.database.tables.ten_min_prices.rows)}</td>
                      </tr>
                      <tr>
                        <td><Layers size={12} /> Mid-Res</td>
                        <td>30m (Agg)</td>
                        <td>4 Weeks</td>
                        <td>{formatNumber(statusData.database.tables.thirty_min_prices.rows)}</td>
                      </tr>
                      <tr>
                        <td><Layers size={12} /> Low-Res</td>
                        <td>1h (Archive)</td>
                        <td>8 Weeks</td>
                        <td>{formatNumber(statusData.database.tables.hourly_prices.rows)}</td>
                      </tr>
                      <tr>
                        <td><Layers size={12} /> Daily</td>
                        <td>1d (Archive)</td>
                        <td>Forever</td>
                        <td>{formatNumber(statusData.database.tables.daily_prices?.rows || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* System Performance */}
            <div className="status-section">
              <h2 className="section-title"><Zap size={20} /> System Performance</h2>
              <div className="glass-panel performance-panel">
                <div className="uptime-hero">
                  <div className="uptime-big-value">{uptimeDisplay || formatUptime(statusData.uptime.uptimeMs)}</div>
                  <div className="uptime-label">Continuous System Uptime</div>
                </div>
                
                <div className="performance-stats">
                  <div className="perf-item">
                    <span className="perf-label">Last Data Fetch</span>
                    <span className="perf-value">{formatTimeAgo(statusData.timestamp)}</span>
                  </div>
                  <div className="perf-item">
                    <span className="perf-label">API Version</span>
                    <span className="perf-value">v2.4.0-stable</span>
                  </div>
                  <div className="perf-item">
                    <span className="perf-label">Server Region</span>
                    <span className="perf-value">US-West (Local)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="status-footer">
        <p>
          Powered by <Link to="/" style={{ color: 'var(--accent-color)' }}>BazaarTracker Engine</Link> • Real-time data provided by <a href="https://api.hypixel.net" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>Hypixel API</a>
        </p>
      </div>
    </div>
  );
};

export default Status;
