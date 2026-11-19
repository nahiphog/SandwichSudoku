import {expect, it} from 'vitest';
import {bit, emptyGrid, UNITS} from '../src/vendor/engine/board';
import {lineSupport} from '../src/sandwich';

it('matches exhaustive Sandwich arrangements for every sum', () => {
  const grid = emptyGrid();
  grid.cands[2] = bit(2) | bit(5) | bit(8);
  grid.cands[6] = bit(1) | bit(4) | bit(7);
  const expected = Array.from({length: 36}, () => new Array<number>(9).fill(0));
  function enumerate(line: number[], remaining: number[]) {
    if (!remaining.length) {
      const a = line.indexOf(1), b = line.indexOf(9);
      let sum = 0;
      for (let i = Math.min(a, b) + 1; i < Math.max(a, b); i++) sum += line[i];
      line.forEach((digit, i) => { expected[sum][i] |= bit(digit); });
      return;
    }
    for (const digit of remaining) if (grid.cands[line.length] & bit(digit)) {
      enumerate([...line, digit], remaining.filter(d => d !== digit));
    }
  }
  enumerate([], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let clue = 0; clue <= 35; clue++) {
    const oracle = expected[clue][0] ? expected[clue] : null;
    expect(lineSupport(grid, UNITS[0], clue)).toEqual(oracle);
    expect(lineSupport(grid, UNITS[0], clue)).toEqual(oracle);
  }
});

it('keys cached support by rule, clue, candidate masks, and direction', () => {
  const grid = emptyGrid();
  UNITS[0].forEach((cell, i) => { grid.cands[cell] = bit(i + 1); });
  expect(lineSupport(grid, UNITS[0], 1, 'x-sums')).not.toBeNull();
  expect(lineSupport(grid, UNITS[0], 1, 'skyscraper')).toBeNull();
  expect(lineSupport(grid, [...UNITS[0]].reverse(), 1, 'x-sums')).toBeNull();
  expect(lineSupport(grid, UNITS[0], 45, 'x-sums')).toBeNull();
  grid.cands[0] = bit(9); grid.cands[8] = bit(1);
  expect(lineSupport(grid, UNITS[0], 45, 'x-sums')).not.toBeNull();
  expect(lineSupport(grid, UNITS[0], 1, 'x-sums')).toBeNull();
});

it('does not let callers mutate the cached candidate support', () => {
  const grid = emptyGrid();
  const support = lineSupport(grid, UNITS[0], 9, 'skyscraper')!;
  support.fill(0);
  expect(lineSupport(grid, UNITS[0], 9, 'skyscraper')).toEqual(Array.from({length: 9}, (_, i) => bit(i + 1)));
});
