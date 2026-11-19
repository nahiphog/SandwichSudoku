import {TECHS, SOLVE_ORDER, type Tech} from './vendor/engine/ratings';

export const MAX_LOGICAL_SCORE = 200;
export const DISPLAYED_TECHNIQUES = (Object.keys(TECHS) as Tech[])
  .filter(tech => TECHS[tech].score <= MAX_LOGICAL_SCORE || tech === 'BRUTE_FORCE');

// Uniqueness techniques assume classic Sudoku; brute force stays an optional
// exact-search fallback, never part of a no-brute-force logical walkthrough.
export const LOGICAL_ORDER = SOLVE_ORDER.filter(tech =>
  DISPLAYED_TECHNIQUES.includes(tech) && tech !== 'BRUTE_FORCE' && TECHS[tech].category !== 'Uniqueness');
