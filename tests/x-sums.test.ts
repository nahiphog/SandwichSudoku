import {describe, expect, it} from 'vitest';
import {bit, emptyGrid, gridFromValues, UNITS} from '../src/vendor/engine/board';
import {buildCustomPuzzle, clueCells, cluesFor, lineSupport, nextMove, solveExact, validate, xSum} from '../src/sandwich';

const type = 'x-sums' as const;
const values = Array.from({length: 81}, (_, i) => {
  const row = Math.floor(i / 9);
  return (row * 3 + Math.floor(row / 3) + i % 9) % 9 + 1;
});

describe('X-sums', () => {
  it('includes the first digit and uses it as the length', () => {
    expect(xSum([3, 8, 9, 1, 2, 4, 5, 6, 7])).toBe(20);
    expect(xSum([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(1);
    expect(xSum([9, 8, 7, 6, 5, 4, 3, 2, 1])).toBe(45);
  });

  it('generates independent sums on all four sides', () => {
    const clues = cluesFor(values, type);
    expect(clues).toHaveLength(36);
    expect(clues[0]).toBe(1);
    expect(clues[18]).toBe(45);
    for (let u = 0; u < 36; u++) {
      const line = clueCells(u).map(cell => values[cell]);
      expect(clues[u]).toBe(line.filter((_, i) => i < line[0]).reduce((a, b) => a + b, 0));
    }
    expect(() => validate(gridFromValues(values), clues, type)).not.toThrow();
  });

  it('deduces extreme clues and rejects impossible sums', () => {
    const grid = emptyGrid();
    expect(lineSupport(grid, UNITS[0], 1, type)![0]).toBe(bit(1));
    expect(lineSupport(grid, UNITS[0], 45, type)![0]).toBe(bit(9));
    for (const clue of [0, 2, 46, -1, 20.5]) expect(lineSupport(grid, UNITS[0], clue, type)).toBeNull();
    grid.cands[0] = bit(3);
    const support = lineSupport(grid, UNITS[0], 20, type)!;
    expect(support[1]).toBe(bit(8) | bit(9));
    expect(support[2]).toBe(bit(8) | bit(9));
    // Even with a valid prefix, the unsummed suffix must admit distinct digits.
    grid.cands[7] = grid.cands[8] = bit(1);
    expect(lineSupport(grid, UNITS[0], 20, type)).toBeNull();
  });

  it('matches an independent permutation oracle for every sum', () => {
    const grid = emptyGrid();
    grid.cands[2] = bit(2) | bit(5) | bit(8);
    grid.cands[6] = bit(1) | bit(4) | bit(7);
    const expected = Array.from({length: 46}, () => new Array<number>(9).fill(0));
    function enumerate(line: number[], remaining: number[]) {
      if (!remaining.length) {
        let sum = 0;
        for (let i = 0; i < line[0]; i++) sum += line[i];
        line.forEach((digit, i) => { expected[sum][i] |= bit(digit); });
        return;
      }
      for (const digit of remaining) if (grid.cands[line.length] & bit(digit)) {
        enumerate([...line, digit], remaining.filter(d => d !== digit));
      }
    }
    enumerate([], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let clue = 1; clue <= 45; clue++) {
      expect(lineSupport(grid, UNITS[0], clue, type)).toEqual(expected[clue][0] ? expected[clue] : null);
    }
  });

  it('uses each direction for hints and rejects contradictory right/bottom clues', () => {
    for (const [index, cell] of [[0, 0], [9, 0], [18, 8], [27, 72]]) {
      const clues = new Array(36).fill(null);
      clues[index] = 1;
      const move = nextMove(emptyGrid(), clues, type)!;
      expect(move.name).toBe('X-sums');
      expect(move.sandwichUnit).toBe(index);
      expect(move.eliminations).toContainEqual({cell, digit: 9});
      expect(move.eliminations).not.toContainEqual({cell, digit: 1});
      if (index >= 18) expect(() => validate(gridFromValues(values), clues, type)).toThrow();
    }
    expect(() => validate(emptyGrid(), new Array(36).fill(null), type)).not.toThrow();
  });

  it('solves uniquely and retains selected clues in custom builds', () => {
    const clues = cluesFor(values, type);
    const result = solveExact(gridFromValues(values.map((d, i) => i % 4 ? d : 0)), clues, 10000, type);
    expect(result.exhausted).toBe(false);
    expect(result.solutions).toHaveLength(1);
    expect([...result.solutions[0].values]).toEqual(values);
    const puzzle = buildCustomPuzzle(Array.from({length: 81}, (_, i) => i), [0, 9, 18, 27], type);
    expect(puzzle.clues).toEqual(cluesFor(puzzle.grid.values, type).map((clue, i) => i % 9 === 0 ? clue : null));
  });
});
