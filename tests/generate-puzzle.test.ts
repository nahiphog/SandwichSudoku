import { expect, it } from 'vitest';
import { cluesFor, generatePuzzle, solveExact } from '../src/sandwich';

it('removes digits while retaining all clues and exactly one solution', () => {
  const { grid, clues } = generatePuzzle();
  expect(grid.values).toContain(0);
  expect(clues).toHaveLength(18);
  expect(clues).not.toContain(null);
  const result = solveExact(grid, clues);
  expect(result.exhausted).toBe(false);
  expect(result.solutions).toHaveLength(1);
  expect(cluesFor(result.solutions[0].values)).toEqual(clues);
});
