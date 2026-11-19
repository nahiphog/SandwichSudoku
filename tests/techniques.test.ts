import {expect, it} from 'vitest';
import {DISPLAYED_TECHNIQUES, LOGICAL_ORDER} from '../src/techniques';
import {TECHS} from '../src/vendor/engine/ratings';

it.each(['CHUTE_REMOTE_PAIR', 'TURBOT_FISH', 'FINNED_X_WING', 'SIMPLE_COLORS', 'FINNED_SWORDFISH'] as const)(
  'excludes %s from the catalog and logical walkthroughs', id => {
    expect(DISPLAYED_TECHNIQUES).not.toContain(id);
    expect(LOGICAL_ORDER).not.toContain(id);
  });

it('keeps the 200-point boundary and Brute Force, but removes higher-rated techniques', () => {
  expect(DISPLAYED_TECHNIQUES).toContain('WXYZ_WING');
  expect(DISPLAYED_TECHNIQUES).toContain('BRUTE_FORCE');
  expect(DISPLAYED_TECHNIQUES).not.toContain('SUE_DE_COQ');
  expect(DISPLAYED_TECHNIQUES.every(id => TECHS[id].score <= 200 || id === 'BRUTE_FORCE')).toBe(true);
});

it('limits logical solving to displayed, variant-safe techniques without brute force', () => {
  expect(LOGICAL_ORDER).toContain('WXYZ_WING');
  expect(LOGICAL_ORDER).not.toContain('SUE_DE_COQ');
  expect(LOGICAL_ORDER).not.toContain('BRUTE_FORCE');
  for (const id of LOGICAL_ORDER) {
    expect(DISPLAYED_TECHNIQUES).toContain(id);
    expect(TECHS[id].score).toBeLessThanOrEqual(200);
    expect(TECHS[id].category).not.toBe('Uniqueness');
  }
});
