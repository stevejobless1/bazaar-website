import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Database, BarChart3, Clock, HardDrive,
  Server, CheckCircle, AlertTriangle, XCircle, Wifi, TrendingUp,
  Package, ShoppingCart, Layers, ArrowUpRight, RefreshCw, Zap
} from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';

// --- Types ---
interface StatusData {
  database: {
    sizeBytes: number;
    sizeMB: number;
    pageCount: number;
    pageSize: number;
    tables: {
      prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
      five_min_prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
      hourly_prices: { rows: number; oldestTimestamp: number | null; newestTimestamp: number | null };
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
  };
  uptime: {
    serverStartedAt: number;
    uptimeMs: number;
  };
  timestamp: number;
}

interface ServiceCheck {
  name: string;
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
const formatCompact = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

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

const StatusBadge = ({ status }: { status: ServiceCheck['status'] }) => {
  const config = {
    online: { icon: CheckCircle, color: '#3fb950', label: 'Operational', bg: 'rgba(63, 185, 80, 0.1)' },
    degraded: { icon: AlertTriangle, color: '#e3b341', label: 'Degraded', bg: 'rgba(227, 179, 65, 0.1)' },
    offline: { icon: XCircle, color: '#f85149', label: 'Offline', bg: 'rgba(248, 81, 73, 0.1)' },
    checking: { icon: RefreshCw, color: '#8b949e', label: 'Checking...', bg: 'rgba(139, 148, 158, 0.1)' },
  };
  const { icon: Icon, color, label, bg } = config[status];
  return (
    <span className="status-badge" style={{ color, background: bg, border: `1px solid ${color}22` }}>
      <Icon size={14} className={status === 'checking' ? 'spin-icon' : ''} />
      {label}
    </span>
  );
};

const PulsingDot = ({ status }: { status: 'online' | 'degraded' | 'offline' | 'checking' }) => {
  const colors = { online: '#3fb950', degraded: '#e3b341', offline: '#f85149', checking: '#8b949e' };
  return (
    <span className="pulsing-dot-container">
      <span className="pulsing-dot" style={{ backgroundColor: colors[status] }} />
      {status === 'online' && <span className="pulsing-ring" style={{ borderColor: colors[status] }} />}
    </span>
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

const MetricCard = ({ icon: Icon, label, value, subValue, color, onClick }: {
  icon: any; label: string; value: string; subValue?: string; color?: string; onClick?: () => void;
}) => (
  <div className="glass-panel metric-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
    <div className="metric-icon" style={{ color: color || 'var(--accent-color)' }}>
      <Icon size={22} />
    </div>
    <div className="metric-info">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
      {subValue && <div className="metric-sub">{subValue}</div>}
    </div>
  </div>
);

const TableStatsRow = ({ name, rows, oldest, newest }: {
  name: string; rows: number; oldest?: number | null; newest?: number | null;
}) => (
  <tr>
    <td>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Layers size={14} color="var(--accent-color)" />
        <span style={{ fontWeight: 600 }}>{name}</span>
      </div>
    </td>
    <td style={{ fontFamily: 'monospace', color: 'var(--accent-color)' }}>{formatNumber(rows)}</td>
    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
      {oldest ? new Date(oldest).toLocaleDateString() : '—'}
    </td>
    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
      {newest ? formatTimeAgo(newest) : '—'}
    </td>
  </tr>
);

// --- Main Status Page ---

const Status = () => {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceCheck[]>([
    { name: 'Bazaar Tracker API', url: '/api/status', status: 'checking', responseTime: null, lastChecked: null },
    { name: 'Bazaar Data Feed', url: '/health', status: 'checking', responseTime: null, lastChecked: null },
    { name: 'Hypixel API', url: 'https://api.hypixel.net/v2/skyblock/bazaar', status: 'checking', responseTime: null, lastChecked: null },
  ]);
  const [uptimeDisplay, setUptimeDisplay] = useState('');
  const [responseHistory, setResponseHistory] = useState<{ time: number; value: number }[]>([]);
  const uptimeRef = useRef<number>(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(svc.url, {
        signal: controller.signal,
        mode: svc.url.startsWith('http') ? 'cors' : 'same-origin'
      });
      clearTimeout(timeout);
      const elapsed = Math.round(performance.now() - start);

      setServices(prev => {
        const updated = [...prev];
        updated[index] = {
          ...svc,
          status: res.ok ? (elapsed > 2000 ? 'degraded' : 'online') : 'degraded',
          responseTime: elapsed,
          lastChecked: Date.now()
        };
        return updated;
      });
    } catch {
      const elapsed = Math.round(performance.now() - start);
      setServices(prev => {
        const updated = [...prev];
        // Hypixel API will fail CORS but that's expected - mark as online if it's a CORS error
        const isCorsExpected = svc.url.startsWith('https://api.hypixel');
        updated[index] = {
          ...svc,
          status: isCorsExpected ? 'online' : 'offline',
          responseTime: isCorsExpected ? elapsed : null,
          lastChecked: Date.now()
        };
        return updated;
      });
    }
  };

  useEffect(() => {
    fetchStatus();
    services.forEach((_, i) => checkService(i));

    // Refresh status every 60s (slower as requested)
    const interval = setInterval(() => {
      fetchStatus();
      services.forEach((_, i) => checkService(i));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update response history when services change
  useEffect(() => {
    const mainApi = services.find(s => s.name === 'Bazaar Tracker API');
    if (mainApi && mainApi.responseTime !== null) {
      setResponseHistory(prev => {
        const newData = [...prev, { time: Math.floor(Date.now() / 1000), value: mainApi.responseTime! }];
        return newData.slice(-50); // Keep last 50 points
      });
    }
  }, [services]);

  // Chart initialization
  useEffect(() => {
    if (!chartContainerRef.current) return;

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
        secondsVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: 200,
    });

    const series = chart.addAreaSeries({
      lineColor: '#00e5ff',
      topColor: 'rgba(0, 229, 255, 0.3)',
      bottomColor: 'rgba(0, 229, 255, 0.0)',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

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

  // Update chart data
  useEffect(() => {
    if (seriesRef.current && responseHistory.length > 0) {
      // lightweight-charts requires unique timestamps and sorted data
      const uniqueData = responseHistory.filter((v, i, a) => a.findIndex(t => t.time === v.time) === i);
      seriesRef.current.setData(uniqueData);
      chartRef.current.timeScale().fitContent();
    }
  }, [responseHistory]);

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

      {/* Service Health Cards */}
      <div className="status-section">
        <h2 className="section-title"><Server size={20} /> Service Health</h2>
        <div className="service-grid">
          {services.map((svc, i) => (
            <div key={i} className={`glass-panel service-card ${svc.status}`}>
              <div className="service-card-header">
                <div className="service-name">
                  <PulsingDot status={svc.status} />
                  {svc.name}
                </div>
                <StatusBadge status={svc.status} />
              </div>
              <div className="service-card-stats">
                <div className="service-stat">
                  <Wifi size={14} />
                  <span>Response</span>
                  <span className="service-stat-value">
                    {svc.responseTime !== null ? `${svc.responseTime}ms` : '—'}
                  </span>
                </div>
                <div className="service-stat">
                  <Clock size={14} />
                  <span>Checked</span>
                  <span className="service-stat-value">
                    {svc.lastChecked ? formatTimeAgo(svc.lastChecked) : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Response Time History */}
      <div className="status-section">
        <h2 className="section-title"><Zap size={20} color="#00e5ff" /> Response Time History (ms)</h2>
        <div className="glass-panel" style={{ padding: '1rem', height: '250px' }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '1rem 0' }}>
          ⚠️ Could not reach the status API: {error}. Some analytics may be unavailable.
        </div>
      )}

      {statusData && (
        <>
          {/* Market Analytics */}
          <div className="status-section">
            <h2 className="section-title"><BarChart3 size={20} /> Market Analytics</h2>
            <div className="metrics-grid">
              <MetricCard
                icon={Package}
                label="Tracked Products"
                value={formatNumber(statusData.market.totalProducts)}
                subValue={`${statusData.market.positiveMarginItems} profitable • ${statusData.market.negativeMarginItems} negative`}
                color="#00e5ff"
              />
              <MetricCard
                icon={ShoppingCart}
                label="Total Buy Volume"
                value={formatCompact(statusData.market.totalBuyVolume)}
                subValue={`${formatCompact(statusData.market.totalBuyOrders)} active orders`}
                color="#3fb950"
              />
              <MetricCard
                icon={ShoppingCart}
                label="Total Sell Volume"
                value={formatCompact(statusData.market.totalSellVolume)}
                subValue={`${formatCompact(statusData.market.totalSellOrders)} active orders`}
                color="#f85149"
              />
              <MetricCard
                icon={TrendingUp}
                label="Avg Margin"
                value={`${statusData.market.averageMargin.toFixed(2)} coins`}
                subValue={`Est. market cap: ${formatCompact(statusData.market.estimatedMarketCap)}`}
                color="#e3b341"
              />
              <MetricCard
                icon={ArrowUpRight}
                label="Top Margin Item"
                value={statusData.market.topMarginProduct.productId.replace(/_/g, ' ')}
                subValue={`${formatCompact(statusData.market.topMarginProduct.margin)} coin margin`}
                color="#3fb950"
                onClick={() => window.location.href = `/item/${statusData.market.topMarginProduct.productId}`}
              />
              <MetricCard
                icon={Activity}
                label="Most Active Item"
                value={statusData.market.topVolumeProduct.productId.replace(/_/g, ' ')}
                subValue={`${formatCompact(statusData.market.topVolumeProduct.volume)} combined volume`}
                color="#a371f7"
                onClick={() => window.location.href = `/item/${statusData.market.topVolumeProduct.productId}`}
              />
            </div>
          </div>

          {/* Database & Storage */}
          <div className="status-section">
            <h2 className="section-title"><Database size={20} /> Database & Storage</h2>
            <div className="db-grid">
              <div className="glass-panel db-storage-panel">
                <StorageGauge usedMB={statusData.database.sizeMB} estimatedMaxMB={500} />

                <div className="db-meta-row">
                  <div className="db-meta">
                    <span className="db-meta-label">Page Size</span>
                    <span className="db-meta-value">{formatBytes(statusData.database.pageSize)}</span>
                  </div>
                  <div className="db-meta">
                    <span className="db-meta-label">Total Pages</span>
                    <span className="db-meta-value">{formatNumber(statusData.database.pageCount)}</span>
                  </div>
                  <div className="db-meta">
                    <span className="db-meta-label">Engine</span>
                    <span className="db-meta-value">SQLite (WAL)</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel db-tables-panel">
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={16} color="var(--accent-color)" /> Table Breakdown
                </h3>
                <table className="status-table">
                  <thead>
                    <tr>
                      <th>Table</th>
                      <th>Rows</th>
                      <th>Since</th>
                      <th>Latest</th>
                    </tr>
                  </thead>
                  <tbody>
                    <TableStatsRow
                      name="prices (20s)"
                      rows={statusData.database.tables.prices.rows}
                      oldest={statusData.database.tables.prices.oldestTimestamp}
                      newest={statusData.database.tables.prices.newestTimestamp}
                    />
                    <TableStatsRow
                      name="five_min_prices"
                      rows={statusData.database.tables.five_min_prices.rows}
                      oldest={statusData.database.tables.five_min_prices.oldestTimestamp}
                      newest={statusData.database.tables.five_min_prices.newestTimestamp}
                    />
                    <TableStatsRow
                      name="hourly_prices"
                      rows={statusData.database.tables.hourly_prices.rows}
                      oldest={statusData.database.tables.hourly_prices.oldestTimestamp}
                      newest={statusData.database.tables.hourly_prices.newestTimestamp}
                    />
                    <TableStatsRow
                      name="products"
                      rows={statusData.database.tables.products.rows}
                    />
                    <TableStatsRow
                      name="live_orders"
                      rows={statusData.database.tables.live_orders.rows}
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Uptime */}
          <div className="status-section">
            <h2 className="section-title"><Clock size={20} /> Uptime</h2>
            <div className="glass-panel uptime-panel">
              <div className="uptime-counter">
                <div className="uptime-value">{uptimeDisplay || formatUptime(statusData.uptime.uptimeMs)}</div>
                <div className="uptime-label">API Server Uptime</div>
              </div>
              <div className="uptime-meta">
                <div>
                  <span className="db-meta-label">Started</span>
                  <span className="db-meta-value">{new Date(statusData.uptime.serverStartedAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="db-meta-label">Status Fetched</span>
                  <span className="db-meta-value">{new Date(statusData.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="status-footer">
        <p>
          Powered by <Link to="/" style={{ color: 'var(--accent-color)' }}>BazaarTracker</Link> • Data from <a href="https://api.hypixel.net" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>Hypixel API</a>
        </p>
      </div>
    </div>
  );
};

export default Status;
