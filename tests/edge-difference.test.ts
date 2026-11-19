import {describe, expect, it} from 'vitest';
import {bit, emptyGrid, gridFromValues, UNITS} from '../src/vendor/engine/board';
import {buildCustomPuzzle, cluesFor, edgeDifference, lineSupport, nextMove, solveExact, validate} from '../src/sandwich';

const values = Array.from({length: 81}, (_, i) => {
  const row = Math.floor(i / 9);
  return (row * 3 + Math.floor(row / 3) + i % 9) % 9 + 1;
});
const type = 'edge-difference' as const;

describe('edge difference clues', () => {
  it('accepts both endpoint orders, ignoring the interior', () => {
    expect(edgeDifference([2, 1, 3, 4, 5, 6, 7, 8, 9])).toBe(7);
    expect(edgeDifference([9, 8, 7, 6, 5, 4, 3, 1, 2])).toBe(7);
  });

  it('calculates all row and column endpoints', () => {
    const clues = cluesFor(values, type);
    for (let i = 0; i < 9; i++) {
      expect(clues[i]).toBe(Math.abs(values[i * 9] - values[i * 9 + 8]));
      expect(clues[9 + i]).toBe(Math.abs(values[i] - values[72 + i]));
    }
    expect(() => validate(gridFromValues(values), clues, type)).not.toThrow();
  });

  it('filters endpoint candidates and distinguishes missing clues from zero', () => {
    const grid = emptyGrid();
    const support = lineSupport(grid, UNITS[0], 8, type)!;
    expect(support[0]).toBe(bit(1) | bit(9));
    expect(support[8]).toBe(bit(1) | bit(9));
    expect(support[4]).toBe([2, 3, 4, 5, 6, 7, 8].reduce((mask, d) => mask | bit(d), 0));
    for (const invalid of [0, -1, 9, 7.5]) expect(lineSupport(grid, UNITS[0], invalid, type)).toBeNull();
    expect(() => validate(grid, new Array(18).fill(null), type)).not.toThrow();
    const clues = new Array(18).fill(null);
    clues[9] = 7;
    const move = nextMove(grid, clues, type)!;
    expect(move.name).toBe('Edge difference');
    expect(move.sandwichUnit).toBe(9);
    expect(move.eliminations).toContainEqual({cell: 72, digit: 5});
    expect(move.eliminations).not.toContainEqual({cell: 72, digit: 2});
  });

  it('preserves solution candidates and solves with the selected rule', () => {
    const partial = gridFromValues(values.map((d, i) => i % 3 ? 0 : d));
    const clues = cluesFor(values, type);
    for (let u = 0; u < 18; u++) {
      const support = lineSupport(partial, UNITS[u], clues[u]!, type)!;
      UNITS[u].forEach((cell, j) => expect(support[j] & bit(values[cell])).not.toBe(0));
    }
    const puzzle = gridFromValues(values.map((d, i) => i % 4 ? d : 0));
    const result = solveExact(puzzle, clues, 100000, type);
    expect(result.exhausted).toBe(false);
    expect(result.solutions).toHaveLength(1);
    expect([...result.solutions[0].values]).toEqual(values);
    clues[0] = clues[0] === 8 ? 7 : 8;
    expect(() => validate(gridFromValues(values), clues, type)).toThrow();
  });

  it('uses edge differences for custom builds', () => {
    const puzzle = buildCustomPuzzle(Array.from({length: 81}, (_, i) => i), [0, 9], type);
    const all = cluesFor(puzzle.grid.values, type);
    expect(puzzle.clues).toEqual(all.map((clue, i) => i === 0 || i === 9 ? clue : null));
  });
});
