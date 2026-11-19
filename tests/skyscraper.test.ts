import {describe, expect, it} from 'vitest';
import {bit, emptyGrid, gridFromValues, UNITS} from '../src/vendor/engine/board';
import {buildCustomPuzzle, clueCells, cluesFor, lineSupport, nextMove, solveExact, validate, visibleBuildings} from '../src/sandwich';

const type = 'skyscraper' as const;
const values = Array.from({length: 81}, (_, i) => {
  const row = Math.floor(i / 9);
  return (row * 3 + Math.floor(row / 3) + i % 9) % 9 + 1;
});

describe('Skyscraper', () => {
  it('counts only buildings taller than every preceding building', () => {
    expect(visibleBuildings([2, 1, 4, 3, 6, 5, 9, 8, 7])).toBe(4);
    expect(visibleBuildings([7, 8, 9, 5, 6, 3, 4, 1, 2])).toBe(3);
  });

  it('generates independent clues on all four sides in grid order', () => {
    const clues = cluesFor(values, type);
    expect(clues).toHaveLength(36);
    expect(clues[0]).toBe(9);
    expect(clues[18]).toBe(1);
    expect(clues[9]).toBe(5);
    expect(clues[27]).toBe(1);
    for (let i = 0; i < 9; i++) {
      expect(clueCells(18 + i)).toEqual([...UNITS[i]].reverse());
      expect(clueCells(27 + i)).toEqual([...UNITS[9 + i]].reverse());
    }
    expect(() => validate(gridFromValues(values), clues, type)).not.toThrow();
  });

  it('handles extreme and invalid clues', () => {
    const grid = emptyGrid();
    expect(lineSupport(grid, UNITS[0], 1, type)![0]).toBe(bit(9));
    expect(lineSupport(grid, UNITS[0], 9, type)).toEqual(Array.from({length: 9}, (_, i) => bit(i + 1)));
    for (const clue of [0, 10, -1, 2.5]) expect(lineSupport(grid, UNITS[0], clue, type)).toBeNull();
    expect(() => validate(grid, new Array(36).fill(null), type)).not.toThrow();
  });

  it('matches exhaustive candidate support for every clue', () => {
    const grid = emptyGrid();
    // Independent permutation oracle also checks memoized paths merging together.
    grid.cands[2] = bit(2) | bit(5) | bit(8);
    grid.cands[6] = bit(1) | bit(4) | bit(7);
    const expected = Array.from({length: 10}, () => new Array<number>(9).fill(0));
    function enumerate(line: number[], remaining: number[]) {
      if (!remaining.length) {
        const count = line.filter((height, i) => line.slice(0, i).every(previous => previous < height)).length;
        line.forEach((digit, i) => { expected[count][i] |= bit(digit); });
        return;
      }
      for (const digit of remaining) if (grid.cands[line.length] & bit(digit)) {
        enumerate([...line, digit], remaining.filter(d => d !== digit));
      }
    }
    enumerate([], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let clue = 1; clue <= 9; clue++) {
      expect(lineSupport(grid, UNITS[0], clue, type)).toEqual(expected[clue][0] ? expected[clue] : null);
    }
  });

  it('uses right and bottom clues for deductions and rejects contradictions', () => {
    for (const [index, cell] of [[18, 8], [27, 72]]) {
      const clues = new Array(36).fill(null);
      clues[index] = 1;
      const move = nextMove(emptyGrid(), clues, type)!;
      expect(move.name).toBe('Skyscraper');
      expect(move.sandwichUnit).toBe(index);
      expect(move.eliminations).toContainEqual({cell, digit: 8});
      expect(move.eliminations).not.toContainEqual({cell, digit: 9});
      clues[index] = 2;
      expect(() => validate(gridFromValues(values), clues, type)).toThrow();
    }
  });

  it('solves uniquely and preserves four-sided clues in custom builds', () => {
    const clues = cluesFor(values, type);
    const result = solveExact(gridFromValues(values.map((d, i) => i % 4 ? d : 0)), clues, 10000, type);
    expect(result.exhausted).toBe(false);
    expect(result.solutions).toHaveLength(1);
    expect([...result.solutions[0].values]).toEqual(values);
    const puzzle = buildCustomPuzzle(Array.from({length: 81}, (_, i) => i), [0, 9, 18, 27], type);
    expect(puzzle.clues).toEqual(cluesFor(puzzle.grid.values, type).map((clue, i) => i % 9 === 0 ? clue : null));
  });
});
