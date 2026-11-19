import {generateSimulationPuzzle} from './sandwich';
import {countGivens, type SimulationTrial} from './simulation-data';

self.onmessage = ({data: {trials, clueType, maxGivens}}) => {
  try {
    for (let trial = 1; trial <= trials; trial++) {
      const start = performance.now();
      const {grid, clues, fullyDug} = generateSimulationPuzzle(clueType);
      const givens = countGivens(grid.values, clues);
      const result: SimulationTrial = {
        trial, givens, generatedAt: new Date().toISOString(),
        elapsed: Math.round(performance.now() - start), fullyDug,
        puzzle: givens <= maxGivens ? {
          values: Array.from(grid.values).join(''),
          clues: clues.map(clue => clue === null ? '' : String(clue)).join(','),
        } : undefined,
      };
      self.postMessage(result);
    }
  } catch (error) {
    self.postMessage({error: error instanceof Error ? error.message : String(error)});
  }
};
