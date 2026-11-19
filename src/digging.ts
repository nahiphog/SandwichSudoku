/** One ticket per currently present given, independent of removal-group size. */
export function pickDigGiven(values: ArrayLike<number>, clues: readonly (number | null)[], outsideEnabled: boolean, random = Math.random) {
  const entries: {kind: 'digits' | 'clues'; index: number}[] = [];
  for (let index = 0; index < values.length; index++) {
    if (values[index] !== 0) entries.push({kind: 'digits', index});
  }
  if (outsideEnabled) clues.forEach((clue, index) => {
    if (clue !== null) entries.push({kind: 'clues', index});
  });
  return entries.length ? entries[Math.floor(random() * entries.length)] : null;
}
