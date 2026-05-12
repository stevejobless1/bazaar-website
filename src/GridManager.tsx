
import ItemIcon from './ItemIcon';
import './GridManager.css';
import { Grid, GridCell } from './types';

const cropToId: Record<string, string> = {
  "Nether Wart": "ENCHANTED_NETHER_STALK",
  "Fire": "FLINT_AND_STEEL",
  "Water": "WATER_BUCKET",
  "Wheat": "WHEAT",
  "Carrot": "CARROT_ITEM",
  "Potato": "POTATO_ITEM",
  "Sugar Cane": "SUGAR_CANE",
  "Cactus": "CACTUS",
  "Pumpkin": "PUMPKIN",
  "Melon": "MELON",
  "Cocoa Beans": "INK_SACK:3",
  "Brown Mushroom": "BROWN_MUSHROOM",
  "Red Mushroom": "RED_MUSHROOM",
  "Dead Plant": "DEAD_BUSH",
  "Sunflower": "DOUBLE_PLANT",
  "Wild Rose": "RED_ROSE",
  "Soul Sand": "SOUL_SAND",
  "Fermento": "FERMENTO",
  "Ashwreath": "WEEPING_VINES", // Fallbacks for rift
  "Choconut": "COCOA_BEANS",
  "Dustgrain": "WHEAT_SEEDS",
  "Gloomgourd": "PUMPKIN",
  "Lonelily": "LILY_PAD",
  "Scourroot": "POTATO_ITEM",
  "Shadevine": "VINE",
  "Veilshroom": "BROWN_MUSHROOM",
  "Witherbloom": "WITHER_ROSE"
};

const getProductId = (name: string) => {
  return cropToId[name] || name.toUpperCase().replace(/\s+/g, '_');
};

interface GridManagerProps {
  grid: Grid;
  onCellClick: (x: number, y: number) => void;
}

export default function GridManager({ grid, onCellClick }: GridManagerProps) {
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
          {grid.map((row: GridCell[], y: number) =>
            row.map((cell: GridCell, x: number) => {
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
                  {cell.type === 'blocked' && <ItemIcon productId="BARRIER" />}
                  {cell.name && <ItemIcon productId={getProductId(cell.name)} title={cell.name} style={{ width: '24px', height: '24px', filter: cell.type === 'ingredient' ? 'grayscale(0.3)' : 'none' }} />}
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
