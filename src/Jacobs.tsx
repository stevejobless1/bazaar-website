import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

import ItemIcon from './ItemIcon';
import { fetchJacobs } from './api';
import './Jacobs.css';

interface JacobsContest {
  timestamp: number;
  crops: number[];
  cropNames: string[];
}

const cropToId: Record<string, string> = {
  "Wheat": "WHEAT",
  "Carrot": "CARROT_ITEM",
  "Potato": "POTATO_ITEM",
  "Pumpkin": "PUMPKIN",
  "Melon": "MELON",
  "Mushroom": "RED_MUSHROOM",
  "Cocoa Beans": "INK_SACK:3",
  "Cactus": "CACTUS",
  "Sugar Cane": "SUGAR_CANE",
  "Nether Wart": "NETHER_STALK",
  "Wild Rose": "WILD_ROSE",
  "Moonflower": "MOONFLOWER",
  "Sunflower": "SUNFLOWER"
};

const CONTEST_DURATION = 20 * 60 * 1000; // 20 minutes

const Jacobs: React.FC = () => {
  const [contests, setContests] = useState<JacobsContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());

  // Update current time every second for smooth countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchContests = async () => {
    try {
      const data = await fetchJacobs();
      
      // Filter out past contests based on current time
      const upcoming = data.filter(c => c.timestamp + CONTEST_DURATION > Date.now());
      
      setContests(upcoming);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching contests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContests();
    const interval = setInterval(fetchContests, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const activeContest = useMemo(() => {
    return contests.find(c => now >= c.timestamp && now <= c.timestamp + CONTEST_DURATION) || null;
  }, [contests, now]);

  const upcomingContests = useMemo(() => {
    return contests.filter(c => c.timestamp > now);
  }, [contests, now]);

  // Group ALL contests by day ONCE when API fetch happens (contests state changes),
  // instead of every second when `now` ticks, since Intl date formatting is very slow.
  const groupedContests = useMemo(() => {
    const groups: Record<string, JacobsContest[]> = {};
    contests.forEach(contest => {
      const date = new Date(contest.timestamp).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(contest);
    });
    return groups;
  }, [contests]);

  if (loading && contests.length === 0) {
    return <div className="loader-container"><div className="loader"></div></div>;
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getTimeUntil = (timestamp: number) => {
    const diff = timestamp - now;
    if (diff <= 0) return 'Started';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const getProgress = (timestamp: number) => {
    const elapsed = now - timestamp;
    return Math.min(100, Math.max(0, (elapsed / CONTEST_DURATION) * 100));
  };

  return (
    <div className="main-content jacobs-container">
      <div className="jacobs-header glass-panel">
        <div className="header-top">
          <div className="header-title">
            <Calendar size={28} color="var(--accent-color)" />
            <h2>Jacob's Farming Contests</h2>
          </div>
          {upcomingContests.length > 0 && (
            <div className="next-contest-timer">
              <span className="label">NEXT CONTEST</span>
              <span className="value">{getTimeUntil(upcomingContests[0].timestamp)}</span>
            </div>
          )}
        </div>
        <p className="header-subtitle">Maximize your farming medals with real-time contest tracking.</p>
        <div className="header-footer">
          {lastUpdated && (
            <div className="last-updated">
              <Clock size={14} /> Last synced: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <div className="refresh-indicator">
            <div className="dot"></div>
            Polls every 5m
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message glass-panel">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {activeContest && (
        <div className="active-contest-card glass-panel">
          <div className="active-header">
            <div className="status-badge">
              <div className="pulse-dot"></div>
              LIVE NOW
            </div>
            <div className="time-remaining">
              Ends in {getTimeUntil(activeContest.timestamp + CONTEST_DURATION)}
            </div>
          </div>
          
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${getProgress(activeContest.timestamp)}%` }}></div>
          </div>

          <div className="active-crops-grid">
            {activeContest.cropNames.map((cropName, idx) => {
              const iconId = cropToId[cropName] || "WHEAT";
              return (
                <div key={idx} className="active-crop-item glass-panel">
                  <ItemIcon productId={iconId} className="active-crop-icon" />
                  <div className="crop-info">
                    <span className="crop-name">{cropName}</span>
                    <span className="crop-status">Active</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="upcoming-sections">
        {Object.entries(groupedContests).map(([date, dayContests]) => {
          // Dynamically filter contests that have started
          const validUpcoming = dayContests.filter(c => c.timestamp > now);
          if (validUpcoming.length === 0) return null;

          return (
            <div key={date} className="day-group">
              <h3 className="day-title">
                <Calendar size={18} />
                {date}
              </h3>
              <div className="contests-grid">
                {validUpcoming.map((contest, idx) => (
                <div key={contest.timestamp} className="contest-card glass-panel fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className="card-left">
                    <div className="contest-time">
                      <Clock size={16} />
                      {formatTime(contest.timestamp)}
                    </div>
                    <div className="countdown">
                      {getTimeUntil(contest.timestamp)}
                    </div>
                  </div>
                  
                  <div className="card-right">
                    <div className="crops-list">
                      {contest.cropNames.map((cropName, cropIdx) => {
                        const iconId = cropToId[cropName] || "WHEAT";
                        return (
                          <div key={cropIdx} className="crop-tag" title={cropName}>
                            <ItemIcon productId={iconId} className="crop-icon-small" />
                          </div>
                        );
                      })}
                    </div>
                    <div className="crop-names-preview">
                      {contest.cropNames.join(', ')}
                    </div>
                  </div>
                </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Jacobs;

