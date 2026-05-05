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
    return `/shardIcons/${productId}.png`;
  }
  
  // Standard Bazaar item URL from SkyCrypt
  const cleanId = productId.replace(/(:[0-9]+)/g, ''); // Remove tier numbers if any
  return `https://sky.shiiyu.moe/item/${cleanId}`;
};

const ItemIcon: React.FC<ItemIconProps> = ({ productId, isShard = false, className, style, title }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
    setSrc(null); // Reset src to avoid showing old image for new productId

    const primaryUrl = getItemIconUrl(productId, isShard);
    
    const img = new Image();
    img.src = primaryUrl;
    img.onload = () => {
      setSrc(primaryUrl);
      setStatus('loaded');
    };
    img.onerror = () => {
      // If shard icon fails, try the standard item icon as backup
      if (isShard) {
        const backupUrl = getItemIconUrl(productId, false);
        const backupImg = new Image();
        backupImg.src = backupUrl;
        backupImg.onload = () => {
          setSrc(backupUrl);
          setStatus('loaded');
        };
        backupImg.onerror = () => {
          setSrc('https://sky.shiiyu.moe/item/STONE');
          setStatus('error');
        };
      } else {
        setSrc('https://sky.shiiyu.moe/item/STONE');
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
