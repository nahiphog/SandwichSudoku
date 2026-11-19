import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {countGivens, decodeSimulationPuzzle, DEFAULT_TRIALS, TRIAL_OPTIONS} from '../src/simulation-data';
import {generateSimulationPuzzle, solveExact, validate} from '../src/sandwich';

beforeEach(() => {
  let state = 12345;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  });
});
afterEach(() => vi.restoreAllMocks());

it('offers the requested trial counts and defaults to one million', () => {
  expect(TRIAL_OPTIONS).toEqual([1, 10, 100, 1000, 10000, 100000, 1000000]);
  expect(DEFAULT_TRIALS).toBe(1000000);
});

it('counts both inside and outside givens, including a zero clue', () => {
  expect(countGivens([1, 0, 3, 0], [null, 0, 6, null])).toBe(4);
});

it('retains every clue position and zero during compact puzzle storage', () => {
  const values = Array.from({length: 81}, (_, i) => i % 10);
  const clues = Array.from({length: 36}, (_, i) => i % 3 ? i : null);
  clues[1] = 0;
  expect(decodeSimulationPuzzle({values: values.join(''), clues: clues.map(c => c ?? '').join(',')})).toEqual({values, clues});
});

it.each(['sandwich', 'edge-difference', 'skyscraper', 'x-sums', 'sum-before-nine'] as const)(
  'generates unique, dug simulation puzzles without requiring symmetry (%s)', clueType => {
    const {grid, clues} = generateSimulationPuzzle(clueType);
    expect(grid.values).toContain(0);
    expect(clues).toContain(null);
    const mask = Array.from(grid.values, Boolean);
    expect(mask).not.toEqual([...mask].reverse());
    expect(() => validate(grid, clues, clueType)).not.toThrow();
    const check = solveExact(grid, clues, 100000, clueType);
    expect(check.exhausted).toBe(false);
    expect(check.solutions).toHaveLength(1);
  }, 60000);
