import { useState, useEffect, useRef } from 'react';
import GridManager from './GridManager';
import AutoPlanner from './AutoPlanner';

const GRID_SIZE = 10;

// Create an initial empty grid
const createEmptyGrid = () => {
  const grid = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push({ type: 'empty', name: null });
    }
    grid.push(row);
  }
  return grid;
};

export default function Greenhouse() {
  const [grid, setGrid] = useState(createEmptyGrid());
  const [requests, setRequests] = useState([]);
  const [blockMode, setBlockMode] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL('./solver.worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current!.onmessage = (e: MessageEvent) => {
      const { type, payload } = e.data;
      if (type === 'SOLVER_RESULT') {
        setIsSolving(false);
        setGrid(payload.bestGrid);
        console.log(`Solved! Found ${payload.maxScore} target crops.`);
      }
    };

    return () => {
      workerRef.current!.terminate();
    };
  }, []);

  const handleCellClick = (x: number, y: number) => {
    if (blockMode) {
      const newGrid = [...grid];
      newGrid[y] = [...newGrid[y]];
      const cell = newGrid[y][x];
      
      if (cell.type === 'blocked') {
        newGrid[y][x] = { type: 'empty', name: null };
      } else {
        newGrid[y][x] = { type: 'blocked', name: null };
      }
      setGrid(newGrid);
    }
  };

  const handleGenerate = () => {
    if (requests.length === 0) return;
    setIsSolving(true);
    
    // Clear out everything except blocks before solving
    const initialGrid = grid.map(row => 
      row.map(cell => cell.type === 'blocked' ? cell : { type: 'empty', name: null })
    );
    setGrid(initialGrid);

    // Send data to worker
    workerRef.current!.postMessage({
      type: 'START_SOLVE',
      payload: {
        grid: initialGrid,
        requests: requests
      }
    });
  };

  return (
    <div style={{ display: "flex", gap: "2rem" }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <header>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Sky Mutations</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Automated Greenhouse Layout Planner</p>
        </header>
        
        <GridManager 
          grid={grid} 
          onCellClick={handleCellClick} 
        />
      </div>

      <AutoPlanner 
        requests={requests} 
        setRequests={setRequests} 
        onGenerate={handleGenerate}
        isSolving={isSolving}
        blockMode={blockMode}
        setBlockMode={setBlockMode}
      />
    </div>
  );
}
