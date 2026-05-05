
import './GridManager.css';

export default function GridManager({ grid, onCellClick }: any) {
  return (
    <div className="grid-manager">
      <div className="grid-header">
        <h2>GREENHOUSE</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* Top right actions can go here */}
        </div>
      </div>
      
      <div className="grid-container animate-fade-in">
        <div className="grid">
          {grid.map((row: any, y: number) => 
            row.map((cell: any, x: number) => {
              let className = "grid-cell";
              if (cell.type === 'blocked') className += " blocked";
              if (cell.type === 'target') className += " target";
              if (cell.type === 'ingredient') className += " ingredient";

              return (
                <div 
                  key={`${x}-${y}`} 
                  className={className}
                  onClick={() => onCellClick(x, y)}
                  title={cell.name || (cell.type === 'blocked' ? 'Blocked' : 'Empty')}
                >
                  {cell.name && <span style={{fontSize: '0.65rem', textAlign: 'center', opacity: 0.8}}>{cell.name.substring(0,3)}</span>}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid-legend">
        <div className="legend-item">
          <div className="legend-color target"></div>
          <span>Target Crop</span>
        </div>
        <div className="legend-item">
          <div className="legend-color ingredient"></div>
          <span>Ingredients</span>
        </div>
        <div className="legend-item">
          <div className="legend-color blocked"></div>
          <span>Blocked</span>
        </div>
      </div>
    </div>
  );
}
