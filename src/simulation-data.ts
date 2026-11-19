export const TRIAL_OPTIONS = [1, 10, 100, 1000, 10000, 100000, 1000000] as const;
export const DEFAULT_TRIALS = 1000000;
export const countGivens = (values: ArrayLike<number>, clues: readonly (number | null)[]) =>
  Array.from(values).filter(value => value !== 0).length + clues.filter(clue => clue !== null).length;

export interface SimulationTrial {
  trial: number;
  givens: number;
  generatedAt: string;
  elapsed: number;
  fullyDug: boolean;
  puzzle?: {values: string; clues: string};
}

export function decodeSimulationPuzzle(puzzle: NonNullable<SimulationTrial['puzzle']>) {
  return {
    values: Array.from(puzzle.values, Number),
    clues: puzzle.clues.split(',').map(clue => clue === '' ? null : Number(clue)),
  };
}
