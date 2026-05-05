import React, { useState } from 'react';

interface ItemIconProps {
  productId: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

const ItemIcon: React.FC<ItemIconProps> = ({ productId, className, style, title }) => {
  const [error, setError] = useState(false);

  // Normalize ID for CoFLnet (must be uppercase)
  const normalizedId = productId.toUpperCase();
  
  // CoFLnet Static Icon URL
  const iconUrl = `https://sky.coflnet.com/static/icon/${normalizedId}`;

  if (error) {
    return (
      <div 
        className={`${className || ''} glass-panel`} 
        style={{ 
          width: '32px',
          height: '32px',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '4px',
          ...style 
        }}
        title={title || productId}
      >
        <span style={{ fontSize: '10px', opacity: 0.5 }}>?</span>
      </div>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={productId}
      className={className}
      style={{
        width: '32px',
        height: '32px',
        objectFit: 'contain',
        ...style
      }}
      title={title || productId}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
};

export default ItemIcon;
