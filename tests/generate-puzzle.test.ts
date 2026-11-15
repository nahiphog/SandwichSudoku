import { expect, it } from 'vitest';
import { cluesFor, generatePuzzle, solveExact } from '../src/sandwich';

it('removes digits while retaining all clues and exactly one solution', () => {
  const { grid, clues } = generatePuzzle();
  expect(grid.values).toContain(0);
  expect(Array.from(grid.values, Boolean)).toEqual(Array.from(grid.values, Boolean).reverse());
  expect(clues).toHaveLength(18);
  expect(clues).not.toContain(null);
  const result = solveExact(grid, clues);
  expect(result.exhausted).toBe(false);
  expect(result.solutions).toHaveLength(1);
  expect(cluesFor(result.solutions[0].values)).toEqual(clues);
});

it('certifies and scores a generated puzzle without filling the returned grid', () => {
  const {grid, rating} = generatePuzzle(true);
  expect(grid.values).toContain(0);
  expect(Array.from(grid.values, Boolean)).toEqual(Array.from(grid.values, Boolean).reverse());
  expect(rating?.score).toBeGreaterThan(0);
  expect(rating?.techniques.length).toBeGreaterThan(0);
  expect(rating?.techniques.map(([name]) => name)).not.toContain('Brute Force');
});
