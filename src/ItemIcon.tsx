import React, { useState, useEffect } from 'react';

interface ItemIconProps {
  productId: string;
  isShard?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export const getItemIconUrl = (productId: string, isShard: boolean = false) => {
  if (isShard) {
    // Use local shard icons first
    const sanitizeId = (id: string) => id.replace(/:/g, '_').toUpperCase();
    return `/shardIcons/${sanitizeId(productId)}.png`;
  }
  
  // Standard Bazaar item URL from Coflnet
  return `https://sky.coflnet.com/static/icon/${productId}`;
};

const ItemIcon: React.FC<ItemIconProps> = ({ productId, isShard = false, className, style, title }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
    
    // Sanitize ID for local file system (e.g. SHARD:4 -> SHARD_4)
    const sanitizeId = (id: string) => id.replace(/:/g, '_').toUpperCase();
    
    const getUrl = (pid: string, shard: boolean) => {
      if (shard) return `/shardIcons/${sanitizeId(pid)}.png`;
      // Use coflnet for all bazaar items as requested
      return `https://sky.coflnet.com/static/icon/${pid}`;
    };

    const primaryUrl = getUrl(productId, isShard);
    
    const img = new Image();
    img.src = primaryUrl;
    img.onload = () => {
      setSrc(primaryUrl);
      setStatus('loaded');
    };
    img.onerror = () => {
      // Fallback for shards if local icon is missing
      if (isShard) {
        const backupUrl = `https://sky.coflnet.com/static/icon/${productId}`;
        const backupImg = new Image();
        backupImg.src = backupUrl;
        backupImg.onload = () => {
          setSrc(backupUrl);
          setStatus('loaded');
        };
        backupImg.onerror = () => {
          setSrc('https://sky.coflnet.com/static/icon/STONE');
          setStatus('error');
        };
      } else {
        setSrc('https://sky.coflnet.com/static/icon/STONE');
        setStatus('error');
      }
    };
  }, [productId, isShard]);


  return (
    <div 
      className={`item-icon-wrapper ${status} ${className || ''}`}
      style={{
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderRadius: '4px',
        overflow: 'hidden',
        background: status === 'loading' ? 'rgba(255,255,255,0.05)' : 'transparent',
        ...style
      }}
      title={title || productId}
    >
      {status === 'loading' && <div className="item-icon-placeholder" />}
      {src ? (
        <img 
          src={src} 
          alt={productId} 
          className="item-icon-img"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: status === 'loaded' ? 'block' : 'none'
          }}
        />
      ) : (
         status === 'error' && <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>?</div>
      )}
    </div>
  );
};

export default ItemIcon;
