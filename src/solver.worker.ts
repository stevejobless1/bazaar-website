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

    // Check if any requirement is exceeded
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

    // Also need to check if existing crops that are NOT in requirements exist?
    // In Skyblock, usually having extra crops that aren't the required ones is fine, 
    // EXCEPT if the requirement explicitly says "0 adjacent crops" which we map to empty reqs.
    // If targetReqs is empty, it means 0 adjacent crops.
    if (Object.keys(targetReqs).length === 0) {
      // Must have exactly 0 adjacent crops
      const hasCrops = neighbors.some(n => n.cell.type === 'ingredient' || n.cell.type === 'target');
      if (hasCrops) canPlace = false;
    } else {
      // If it requires specific crops, can it have others? Usually yes, but the strict solver 
      // sometimes assumes only those. We will allow other crops, but ensure we don't violate others.
    }

    if (!canPlace || totalMissing > emptyNeighbors.length) {
      continue; // Cannot place target here
    }

    // Valid to place!
    grid[y][x] = { type: 'target', name: targetName };
    targetCount++;

    // Assign missing ingredients randomly to empty neighbors
    shuffle(emptyNeighbors);
    
    for (const [reqCrop, count] of Object.entries(missing)) {
      for (let i = 0; i < (count as number); i++) {
        const n = emptyNeighbors.pop();
        if (n) { grid[n.y][n.x] = { type: 'ingredient', name: reqCrop }; }
      }
    }

    // To prevent future placements from adding crops that would violate THIS target's exact counts,
    // we should ideally lock the remaining empty neighbors from becoming any of the `targetReqs`.
    // For simplicity and speed in this randomized greedy approach, we lock them completely.
    for (const n of emptyNeighbors) {
      grid[n.y][n.x] = { type: 'locked' };
    }
  }

  // Cleanup 'locked' cells back to 'empty' for visualization
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (grid[y][x].type === 'locked') {
        grid[y][x] = { type: 'empty', name: null };
      }
    }
  }

  return { grid, targetCount };
};

self.onmessage = (e) => {
  const { type, payload } = e.data;
  
  if (type === 'START_SOLVE') {
    const { grid, requests } = payload;
    
    // We only handle the first target request for now as the "primary" to maximize
    const primaryRequest = requests[0];
    const targetName = primaryRequest.name;
    const rules = (solverRules as any)[targetName];
    
    if (!rules) {
      self.postMessage({ type: 'SOLVER_RESULT', payload: { bestGrid: grid, maxScore: 0 } });
      return;
    }

    const targetReqs = rules.reqs;
    
    let bestGrid = grid;
    let maxScore = -1;

    const iterations = 5000;
    
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
