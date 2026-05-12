import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import ItemIcon from './ItemIcon';
import './Jacobs.css'; // I will create this file to add some custom aesthetic styles

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
  "Cocoa Beans": "ENCHANTED_COCOA",
  "Cactus": "CACTUS",
  "Sugar Cane": "SUGAR_CANE",
  "Nether Wart": "NETHER_STALK",
  "Wild Rose": "WILD_ROSE",
  "Moonflower": "MOONFLOWER",
  "Sunflower": "ENCHANTED_SUNFLOWER"
};

const Jacobs: React.FC = () => {
  const [contests, setContests] = useState<JacobsContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchContests = async () => {
      try {
        // We do not set loading to true here to avoid UI flicker on background refresh
        const res = await fetch('https://jacobs.strassburger.dev/api/jacobcontests');
        if (!res.ok) throw new Error('Failed to fetch Jacob contests');
        const data: JacobsContest[] = await res.json();
        
        // Filter out past contests based on current time (with some buffer just in case)
        const now = Date.now();
        const upcoming = data.filter(c => c.timestamp + (20 * 60 * 1000) > now); // Contest is 20m long
        
        if (isMounted) {
          setContests(upcoming);
          setLastUpdated(new Date());
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'An error occurred fetching contests');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchContests();
    const interval = setInterval(fetchContests, 5 * 60 * 1000); // 5 minutes
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading && contests.length === 0) {
    return <div className="loader-container"><div className="loader"></div></div>;
  }

  // Find currently active contest if any
  const now = Date.now();
  const activeContestIndex = contests.findIndex(c => now >= c.timestamp && now <= c.timestamp + (20 * 60 * 1000));
  const activeContest = activeContestIndex !== -1 ? contests[activeContestIndex] : null;
  const upcomingContests = activeContestIndex !== -1 ? contests.slice(activeContestIndex + 1) : contests;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

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
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  };

  return (
    <div className="main-content jacobs-container">
      <div className="jacobs-header glass-panel">
        <div className="header-title">
          <Calendar size={28} color="var(--accent-color)" />
          <h2>Jacob's Farming Contests</h2>
        </div>
        <p className="header-subtitle">Plan your farming runs ahead of time. Refreshes every 5 minutes.</p>
        {lastUpdated && (
          <div className="last-updated">
            <Clock size={14} /> Last synced: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {activeContest && (
        <div className="active-contest-banner glass-panel">
          <div className="active-badge">
            <span className="pulse-dot"></span> LIVE NOW
          </div>
          <div className="active-content">
            <div className="active-time">
              Ends {formatTime(activeContest.timestamp + (20 * 60 * 1000))}
            </div>
            <div className="active-crops">
              {activeContest.cropNames.map((cropName, idx) => {
                const iconId = cropToId[cropName] || "WHEAT";
                return (
                  <div key={idx} className="active-crop-item">
                    <ItemIcon productId={iconId} className="active-crop-icon" />
                    <span>{cropName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="contests-grid">
        {upcomingContests.map((contest, idx) => (
          <div key={contest.timestamp} className="contest-card glass-panel fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
            <div className="contest-card-header">
              <div className="contest-date">
                <Calendar size={16} />
                {formatDate(contest.timestamp)}
              </div>
              <div className="contest-countdown">
                {getTimeUntil(contest.timestamp)}
              </div>
            </div>
            <div className="contest-time">
              <Clock size={18} />
              {formatTime(contest.timestamp)}
            </div>
            
            <div className="contest-crops">
              {contest.cropNames.map((cropName, cropIdx) => {
                const iconId = cropToId[cropName] || "WHEAT";
                return (
                  <div key={cropIdx} className="crop-pill">
                    <ItemIcon productId={iconId} className="crop-icon" />
                    <span className="crop-name">{cropName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Jacobs;
