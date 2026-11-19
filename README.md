# Sandwich Sudoku Studio

A TypeScript/Vite website for constructing and solving sandwich sudoku.

```sh
npm install
npm run dev
npm test
npm run build
```

Subpages use clean paths such as `about/`, `import-grid/`, and `custom-build/`.
The build emits an HTML entry for every subpage so direct links and refreshes
work on static hosting, including GitHub Pages project sites. Older `?page=`
links automatically switch to the corresponding path.

Generate creates a completely filled valid Sudoku and displays nine column sums
above the grid and nine row sums to its left. Each sum excludes the 1 and 9.
Click a cell and type, use the keypad, or edit any outside clue. Blank clues are
absent constraints; zero clues require adjacent 1 and 9. Clear digits retains
the clues; Blank grid clears both. JSON import/export saves constructions.

Choose **Edge difference** in the puzzle type toggle above the grid to use
absolute endpoint differences instead of sandwich sums. Left clues compare
the first and last cells of each row; top clues compare the top and bottom
cells of each column. For example, endpoints 2 and 9 give 7 in either order.
Edge clues range from 1 to 8. Generation, custom builds, hints, exact solving,
walkthroughs, and copied puzzles use the selected rule. Simulation has its own
clue type selector. Switching types clears the old clues and resets candidates;
Undo restores the previous puzzle. JSON stores `clueType` as `sandwich` or
`edge-difference`, `skyscraper`, `x-sums`, or `sum-before-nine`; older JSON without this field defaults to sandwich sums.

Choose **Skyscraper** to treat each digit as a building of that height. An outside
clue counts buildings visible from its direction; taller buildings hide shorter
ones. Independent clues from 1 to 9 can appear on all four sides. Skyscraper JSON
stores 36 clues: nine left row clues, nine top column clues, nine right row clues,
then nine bottom column clues. Rows are ordered top to bottom and columns left
to right; use `null` for an absent clue. Paired clue digging mirrors positions within each available side: 1 with 9,
2 with 8, 3 with 7, and 4 with 6. The middle clue stays because it has no partner.
This applies independently to both sides for Sandwich/Edge difference and all
four sides for Skyscraper, X-sums, and Sum before nine.

Choose **X-sums** to sum the first X digits viewed from a clue, where the first
digit gives X and is included in the sum. For example, a top clue of 20 with
3 in the first cell sums the first three cells to 20. Clues range from 1 to 45
and can appear on all four sides. JSON uses `clueType: "x-sums"` and the same
36-position ordering as Skyscraper. Generation, custom builds, simulation,
hints, solving, walkthroughs, and text/image exports all support X-sums.

Choose **Sum before nine** to sum every digit before the 9 viewed from a clue,
excluding the 9. A clue of 6 can begin with 249, 1329, or 69. Clues range from
0 to 36: zero places 9 first, while 36 places 9 last. All four sides are
supported throughout generation, custom builds, simulation, solving, and exports.
JSON uses `clueType: "sum-before-nine"` with the same 36-position ordering as
Skyscraper and X-sums; `null` means absent and is distinct from zero.

Digging interleaves grid digits and outside clues. Every currently present given
gets one equally likely selection ticket: 50 grid digits and 15 outside clues
give a 50/65 chance of selecting a grid digit. Selecting a paired position tests
both partners together; each partner has its own ticket, so a pair is never
counted as a single given. **Dig grid cells first** is off by default. Turn it on
to attempt every allowed grid-cell removal before drawing only from outside clues.
Rotational symmetry and mirrored outside pairs still apply in either order. Protected positions and previously tested groups are
skipped if drawn; they remain in the current-given counts. When outside digging
is disabled, only grid digits enter the draw. Every allowed removal group is
tested once, and removals must preserve uniqueness and the chosen logical setting.

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

## Simulation

Total trials offers 1, 10, 100, 1,000, 10,000, 100,000, and 1,000,000 (default).
The display limit ranges from 1 to 60 total givens (default 60), counting grid
digits and every outside clue, including zero. Each trial uses unrestricted
logical/brute-force digging, no rotational symmetry, single outside-clue
removals, and mixed grid/outside selection by default. Enable **Dig the cells
inside the grid first** to finish grid digging before attempting outside clues.
Logical rating is skipped.

The vertical-bar histogram updates after every completed puzzle. Matching
puzzles are retained in memory and paginated ten per page, with generation
time in Malaysia time, total givens, and a clipboard button for importable JSON.
Cancellation retains completed results; a new run or reload clears them.
Histogram counts can be downloaded as CSV. Digging search-limit cases remain
verified unique and are labelled separately from fully dug puzzles.

Entering Custom Build starts a fresh blank grid and clears outside clues,
highlights, candidates, undo history, and previous solve reports. In-flight
generation is cancelled so it cannot refill the new construction.
