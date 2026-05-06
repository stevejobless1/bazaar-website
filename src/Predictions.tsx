import React, { useState, useEffect, useMemo } from 'react';
import { Brain, Target, Zap, Info, ShieldAlert } from 'lucide-react';
import { fetchMLPredictions } from './api';
import ItemIcon from './ItemIcon';

const formatCompact = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

interface PredictionItem {
  item_id: string;
  timestamp: string;
  buy_price: number;
  sell_price: number;
  entry_score: number;
  delta_minutes: number;
}

const Predictions: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadPredictions = async () => {
    try {
      const data = await fetchMLPredictions();
      if (data.items) {
        setPredictions(data.items);
        setLastUpdated(new Date());
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load predictions', err);
      // Don't show error if we already have data
      if (predictions.length === 0) {
        setError('Machine Learning models are currently training or the service is warming up. Please check back in a few minutes.');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadPredictions();
    const interval = setInterval(loadPredictions, 30000);
    return () => clearInterval(interval);
  }, []);

  const topSignals = useMemo(() => {
    return [...predictions]
      .sort((a, b) => b.entry_score - a.entry_score)
      .slice(0, 4);
  }, [predictions]);

  if (loading && predictions.length === 0) return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div className="main-content">
      <div className="status-hero" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="status-hero-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Brain size={32} color="var(--accent-color)" />
            ML Price Predictions
          </h1>
          <p className="status-hero-subtitle" style={{ margin: 0 }}>
            AI-driven market analysis identifying high-probability entry points using LightGBM models.
          </p>
        </div>
        <div>
          <a href="/api/ml/client" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <Zap size={16} /> Download Local ML Client
          </a>
        </div>
      </div>

      {error ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', marginBottom: '2rem', borderLeft: '4px solid #f85149' }}>
          <ShieldAlert size={48} color="#f85149" style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
          <h2 style={{ marginBottom: '1rem' }}>Service Warming Up</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            {error}
          </p>
          <div style={{ marginTop: '2rem' }}>
            <div className="loader" style={{ width: '30px', height: '30px', margin: '0 auto' }}></div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {topSignals.map((signal) => (
              <div key={signal.item_id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.5rem 1rem', background: 'rgba(0, 229, 255, 0.1)', color: 'var(--accent-color)', fontSize: '0.7rem', fontWeight: 800, borderBottomLeftRadius: '12px' }}>
                  TOP SIGNAL
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <ItemIcon productId={signal.item_id} style={{ width: '40px', height: '40px' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{signal.item_id.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Entry Score: {signal.entry_score.toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Price</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, fontFamily: 'monospace' }}>{formatCompact(signal.buy_price)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Time to Entry</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-color)' }}>~{signal.delta_minutes}m</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-panel data-table-container">
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Target size={18} color="var(--accent-color)" />
                <h3 style={{ margin: 0 }}>Predictive Entry Signals</h3>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Last updated: {lastUpdated?.toLocaleTimeString()}
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Current Price</th>
                  <th style={{ textAlign: 'right' }}>Entry Score</th>
                  <th style={{ textAlign: 'right' }}>Time to Entry</th>
                  <th style={{ textAlign: 'center' }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((p) => (
                  <tr key={p.item_id}>
                    <td>
                      <div className="product-name">
                        <ItemIcon productId={p.item_id} className="product-icon" />
                        <span style={{ fontWeight: 600 }}>{p.item_id.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCompact(p.buy_price)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="margin-badge" style={{ 
                        background: p.entry_score > 0.7 ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: p.entry_score > 0.7 ? 'var(--accent-color)' : 'var(--text-primary)',
                        fontWeight: 700
                      }}>
                        {p.entry_score.toFixed(3)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {p.delta_minutes === 0 ? (
                        <span style={{ color: '#3fb950', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                          <Zap size={14} /> NOW
                        </span>
                      ) : (
                        `in ${p.delta_minutes}m`
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', margin: '0 auto', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(100, p.entry_score * 100)}%`, 
                          height: '100%', 
                          background: p.entry_score > 0.5 ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)',
                          boxShadow: p.entry_score > 0.7 ? '0 0 10px var(--accent-color)' : 'none'
                        }}></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                <Info size={16} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase' }}>Methodology</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Our models analyze historical price action, trading volumes, and global Skyblock events (Mayors, Festivals) to predict short-term price movements. 
                The <b>Entry Score</b> represents the probability of a profitable flip (2%+) within the next hour. 
                Signals with a score above <b>0.75</b> are considered high-confidence opportunities.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--accent-color)' }}>
                <Zap size={16} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase' }}>Local Client Workflow</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <ol style={{ paddingLeft: '1.25rem', marginBottom: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>Download the <b>Local ML Client</b> zip and extract it.</li>
                  <li style={{ marginBottom: '0.5rem' }}>Run <code>pip install -r requirements.txt</code> to install dependencies (LightGBM, Pandas, etc.).</li>
                  <li style={{ marginBottom: '0.5rem' }}>Run <code>python train_initial.py</code> to train models on <b>all bazaar items</b>. This fetches live data and builds prediction models locally.</li>
                  <li style={{ marginBottom: '0.5rem' }}>Run <code>python predict_client.py</code> to start predicting and uploading results to this dashboard.</li>
                  <li>Predictions will automatically appear on this page in real-time.</li>
                </ol>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Predictions;
