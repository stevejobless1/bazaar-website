import solverRules from './solver_rules.json';

// Helper to shuffle array in place
function shuffle(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const getNeighbors = (grid: any, x: number, y: number) => {
  const neighbors = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
        neighbors.push({ x: nx, y: ny, cell: grid[ny][nx] });
      } else {
        neighbors.push({ x: nx, y: ny, cell: { type: 'outofbounds' }});
      }
    }
  }
  return neighbors;
};

// Check if placing an ingredient at (ix, iy) will break any existing targets
const safeToPlaceIngredient = (grid: any, ix: number, iy: number, ingredientName: string, targetReqs: any) => {
  const targetNeighbors = getNeighbors(grid, ix, iy).filter(n => n.cell.type === 'target');
  
  for (const tn of targetNeighbors) {
    // This target needs 'targetReqs'
    const currentReqAmount = targetReqs[ingredientName] || 0;
    
    // Count how many of this ingredient it currently has
    const tNeighbors = getNeighbors(grid, tn.x, tn.y);
    let count = 0;
    for (const cn of tNeighbors) {
      if ((cn.cell.type === 'ingredient' || cn.cell.type === 'target') && cn.cell.name === ingredientName) {
        count++;
      }
    }
    
    // If adding one more exceeds the requirement, we cannot place it here
    if (count + 1 > currentReqAmount) {
      return false;
    }
  }
  return true;
};

const solveIteration = (initialGrid: any, targetName: string, targetReqs: any) => {
  // Deep copy grid
  const grid = initialGrid.map((row: any) => row.map((cell: any) => ({ ...cell })));
  
  // Create a list of all coordinates
  const coords = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (grid[y][x].type === 'empty') {
        coords.push({ x, y });
      }
    }
  }
  
  // Randomize placement order
  shuffle(coords);

  let targetCount = 0;

  for (const { x, y } of coords) {
    if (grid[y][x].type !== 'empty') continue;

    const neighbors = getNeighbors(grid, x, y);
    
    // Count existing crops
    const existingCounts: Record<string, number> = {};
    const emptyNeighbors = [];
    
    let canPlace = true;
    for (const n of neighbors) {
      if (n.cell.type === 'ingredient' || n.cell.type === 'target') {
        const name = n.cell.name;
        existingCounts[name] = (existingCounts[name] || 0) + 1;
      } else if (n.cell.type === 'empty') {
        emptyNeighbors.push(n);
      }
    }

    // Check if any requirement is exceeded for the NEW target
    const missing: Record<string, number> = {};
    let totalMissing = 0;
    
    for (const [reqCrop, reqAmount] of Object.entries(targetReqs)) {
      const existing = existingCounts[reqCrop] || 0;
      if (existing > (reqAmount as number)) {
        canPlace = false;
        break;
      }
      const diff = (reqAmount as number) - existing;
      if (diff > 0) {
        missing[reqCrop] = diff;
        totalMissing += diff;
      }
    }

    // If 0 adjacencies required
    if (Object.keys(targetReqs).length === 0) {
      const hasCrops = neighbors.some(n => n.cell.type === 'ingredient' || n.cell.type === 'target');
      if (hasCrops) canPlace = false;
    } else {
      // Must not have ANY crops that aren't in targetReqs
      const hasInvalidExisting = neighbors.some(n => {
        if (n.cell.type === 'ingredient' || n.cell.type === 'target') {
          if (!targetReqs[n.cell.name]) return true;
        }
        return false;
      });
      if (hasInvalidExisting) canPlace = false;
    }

    if (!canPlace || totalMissing > emptyNeighbors.length) {
      continue; 
    }

    // Now we need to find empty neighbors that are SAFE to place ingredients in
    // For each missing ingredient, we need to find a safe empty neighbor
    let safePlacementFound = true;
    const placements = []; // {x, y, name}
    
    // Copy empty neighbors so we can try to allocate them
    let availableNeighbors = [...emptyNeighbors];
    shuffle(availableNeighbors);

    for (const [reqCrop, count] of Object.entries(missing)) {
      for (let i = 0; i < (count as number); i++) {
        let placed = false;
        for (let j = 0; j < availableNeighbors.length; j++) {
          const n = availableNeighbors[j];
          if (safeToPlaceIngredient(grid, n.x, n.y, reqCrop, targetReqs)) {
            // Temporarily place it to check subsequent ingredients
            grid[n.y][n.x] = { type: 'ingredient', name: reqCrop };
            placements.push({ x: n.x, y: n.y, name: reqCrop });
            availableNeighbors.splice(j, 1);
            placed = true;
            break;
          }
        }
        if (!placed) {
          safePlacementFound = false;
          break;
        }
      }
      if (!safePlacementFound) break;
    }

    if (!safePlacementFound) {
      // Rollback temporary placements
      for (const p of placements) {
        grid[p.y][p.x] = { type: 'empty', name: null };
      }
      continue; // Skip this target
    }

    // Valid to place!
    grid[y][x] = { type: 'target', name: targetName };
    targetCount++;
  }

  return { grid, targetCount };
};

self.onmessage = (e) => {
  const { type, payload } = e.data;
  
  if (type === 'START_SOLVE') {
    const { grid, requests } = payload;
    
    if (!requests || requests.length === 0) return;
    
    const primaryRequest = requests[0];
    const targetName = primaryRequest.name;
    const rules = (solverRules as any)[targetName];
    
    if (!rules) {
      self.postMessage({ type: 'SOLVER_RESULT', payload: { bestGrid: grid, maxScore: 0 } });
      return;
    }

    const targetReqs = rules.reqs || {};
    
    let bestGrid = grid;
    let maxScore = -1;

    // Run 15000 iterations. The fast greedy search is very quick.
    const iterations = 15000;
    
    for (let i = 0; i < iterations; i++) {
      const result = solveIteration(grid, targetName, targetReqs);
      if (result.targetCount > maxScore) {
        maxScore = result.targetCount;
        bestGrid = result.grid;
      }
    }

    self.postMessage({ 
      type: 'SOLVER_RESULT', 
      payload: { 
        bestGrid, 
        maxScore 
      } 
    });
  }
};
