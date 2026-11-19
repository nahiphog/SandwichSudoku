import { afterEach, beforeEach, expect, it, vi } from 'vitest';
// A repeatable random stream keeps generation coverage stable across CI runs.
beforeEach(() => {
  let state = 12345;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  });
});
afterEach(() => vi.restoreAllMocks());
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

it('keeps at least one sandwich clue and preserves uniqueness when digging sums', () => {
  let digitUpdates = 0;
  const {grid, clues} = generatePuzzle(false, true, true, (_, __, phase) => {
    if (phase === 'digits') digitUpdates++;
  });
  expect(digitUpdates).toBeGreaterThan(0);
  expect(clues.filter(clue => clue !== null).length).toBeGreaterThan(0);
  const result = solveExact(grid, clues);
  expect(result.exhausted).toBe(false);
  expect(result.solutions).toHaveLength(1);
}, 60000);

it('removes outside clues in matching row and column pairs', () => {
  const {clues} = generatePuzzle(false, true, 'pairs');
  for (let index = 0; index < 9; index++) {
    expect(clues[index] === null).toBe(clues[8 - index] === null);
    expect(clues[9 + index] === null).toBe(clues[17 - index] === null);
  }
}, 60000);
