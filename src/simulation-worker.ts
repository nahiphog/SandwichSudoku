import { gridFromValues } from './vendor/engine/board';
import { cluesFor, generate, solveExact } from './sandwich';

self.onmessage = ({data: {samples, removed}}) => {
  for (let sample = 1; sample <= samples; sample++) {
    const start = performance.now();
    const complete = generate();
    const clues = cluesFor(complete.values);
    const values = Array.from(complete.values);
    const cells = values.map((_, index) => index);
    for (let i = 0; i < removed; i++) {
      const j = i + Math.floor(Math.random() * (81 - i));
      [cells[i], cells[j]] = [cells[j], cells[i]];
      values[cells[i]] = 0;
    }
    const {solutions, exhausted} = solveExact(gridFromValues(values), clues, 500);
    const result = exhausted ? 'Search limit' : solutions.length === 1 ? 'Unique' : 'Multiple solutions';
    self.postMessage({sample, givens: 81 - removed, result, elapsed: Math.round(performance.now() - start)});
  }
};
