import {expect, it} from 'vitest';
import {pickDigGiven} from '../src/digging';

it('counts both members of each outside pair separately from single grid cells', () => {
  const values = Array.from({length: 81}, (_, i) => i < 50 ? 1 : 0);
  // Seven mirrored pairs across the left/top sides: 14 individual clues.
  const clues: (number | null)[] = new Array(18).fill(null);
  const pairs = [[0, 8], [1, 7], [2, 6], [3, 5], [9, 17], [10, 16], [11, 15]];
  for (const pair of pairs) for (const index of pair) clues[index] = 6;
  const draws = Array.from({length: 64}, (_, i) => pickDigGiven(values, clues, true, () => (i + 0.5) / 64)!);
  expect(draws.filter(draw => draw.kind === 'digits')).toHaveLength(50);
  expect(draws.filter(draw => draw.kind === 'clues')).toHaveLength(14);
  for (const pair of pairs) {
    expect(draws.filter(draw => draw.kind === 'clues' && pair.includes(draw.index))).toHaveLength(2);
  }
});

it('gives exactly 50 of 65 equal tickets to digits and 15 to outside clues', () => {
  const values = Array.from({length: 81}, (_, i) => i < 50 ? i % 9 + 1 : 0);
  const clues = Array.from({length: 36}, (_, i) => i < 15 ? i : null);
  const draws = Array.from({length: 65}, (_, i) => pickDigGiven(values, clues, true, () => (i + 0.5) / 65)!);
  expect(draws.filter(draw => draw.kind === 'digits')).toHaveLength(50);
  expect(draws.filter(draw => draw.kind === 'clues')).toHaveLength(15);
  expect(new Set(draws.map(draw => `${draw.kind}:${draw.index}`)).size).toBe(65);
  expect(draws).toContainEqual({kind: 'clues', index: 0}); // zero is a given
});

it('recounts current givens after removals and respects disabled outside digging', () => {
  const values = [1, 0, 3, 0];
  const clues = [null, 0, 6];
  expect(pickDigGiven(values, clues, true, () => 0.6)).toEqual({kind: 'clues', index: 1});
  values[0] = 0;
  clues[1] = null;
  expect(pickDigGiven(values, clues, true, () => 0.6)).toEqual({kind: 'clues', index: 2});
  expect(pickDigGiven(values, clues, false, () => 0.99)).toEqual({kind: 'digits', index: 2});
  expect(pickDigGiven([0], [null], true)).toBeNull();
});
