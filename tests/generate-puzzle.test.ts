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
import { cluesFor, generatePuzzle, rateLogicalPuzzle, solveExact } from '../src/sandwich';
import { gridFromValues } from '../src/vendor/engine/board';
import {DISPLAYED_TECHNIQUES} from '../src/techniques';
import {TECHS} from '../src/vendor/engine/ratings';

it.each(['sandwich', 'edge-difference'] as const)('preserves a logical solve after every removal without restarting (%s)', clueType => {
  let starts = 0;
  let digits = 0;
  let outside = 0;
  const result = generatePuzzle(true, true, 'single', (values, clues, phase) => {
    if (phase === 'start') starts++;
    if (phase !== 'digits' && phase !== 'clues') return;
    if (phase === 'digits') digits++;
    else outside++;
    const grid = gridFromValues(values);
    expect(rateLogicalPuzzle(grid, clues, clueType)).not.toBeNull();
    const exact = solveExact(grid, clues, 100000, clueType);
    expect(exact.exhausted).toBe(false);
    expect(exact.solutions).toHaveLength(1);
  }, clueType);
  expect(starts).toBe(1);
  expect(digits).toBeGreaterThan(0);
  expect(outside).toBeGreaterThan(0);
  expect(result.rating).toEqual(rateLogicalPuzzle(result.grid, result.clues, clueType));
  expect(result.rating!.moves.every(move => move.score <= 200)).toBe(true);
  const allowedNames = [...DISPLAYED_TECHNIQUES.map(id => TECHS[id].name), 'Sandwich sum', 'Edge difference', 'Phistomefel Ring'];
  for (const move of result.rating!.moves) expect(allowedNames).toContain(move.name);
}, 60000);

it('generates a unique logical edge difference puzzle with paired clue digging', () => {
  const {grid, clues, rating} = generatePuzzle(true, true, 'pairs', undefined, 'edge-difference');
  expect(grid.values).toContain(0);
  expect(rating).not.toBeNull();
  const result = solveExact(grid, clues, 100000, 'edge-difference');
  expect(result.exhausted).toBe(false);
  expect(result.solutions).toHaveLength(1);
  const all = cluesFor(result.solutions[0].values, 'edge-difference');
  expect(clues.some(clue => clue !== null)).toBe(true);
  clues.forEach((clue, i) => { if (clue !== null) expect(clue).toBe(all[i]); });
  for (let i = 0; i < 9; i++) {
    expect(clues[i] === null).toBe(clues[8 - i] === null);
    expect(clues[9 + i] === null).toBe(clues[17 - i] === null);
  }
}, 60000);

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
}, 60000);

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
