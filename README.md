# Sandwich Sudoku Studio

A TypeScript/Vite website for constructing and solving sandwich sudoku.

```sh
npm install
npm run dev
npm test
npm run build
```

Generate creates a completely filled valid Sudoku and displays nine column sums
above the grid and nine row sums to its left. Each sum excludes the 1 and 9.
Click a cell and type, use the keypad, or edit any outside clue. Blank clues are
absent constraints; zero clues require adjacent 1 and 9. Clear digits retains
the clues; Blank grid clears both. JSON import/export saves constructions.

Find next step previews a deduction; Apply this step records its explanation and
score. Candidate eliminations persist until the construction is edited. Undo
restores the grid, clues, candidates, history and score. Exact search runs in a
cancellable worker, checks sandwich constraints, and distinguishes unique,
multiple, impossible, and search-limit results. Exact-search completions are
not represented as logical difficulty ratings. Generated outside clues alone
are not guaranteed to uniquely determine the grid.

The full sudokUI engine is vendored unchanged, including all 80 catalogue entries
and 77 implemented techniques at the pinned revision. Classic uniqueness
techniques are excluded from automatic variant hints, since sandwich clues
can invalidate classic deadly-pattern arguments. Upstream roadmap and redundant
entries remain labelled. See THIRD_PARTY_NOTICES.md and LICENSE (GPL v3).

Phistomefel Ring compares per-digit lower and upper counts in the specified
16-cell ring and 16 corner cells in both directions. Each applied deduction
adds exactly 200 points, regardless of the number of affected cells; passive
viewing and nonproductive checks score nothing. This is conservative count-bound
reasoning, not exhaustive reasoning over all possible multisets. Sandwich line
filtering scores zero; classic techniques retain upstream scores. The displayed
score is the applied logical path, not a minimum or standardized variant rating.

The tests cover generation, sums, line-filter soundness, ring membership and
deductions, score metadata, imported steps, uniqueness, ambiguity, contradictions,
and budget exhaustion. The UI uses no server or account and sends no puzzle data
off-device. Google Fonts is optional; local font fallbacks are provided.
