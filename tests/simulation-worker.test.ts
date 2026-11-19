import {afterEach, expect, it, vi} from 'vitest';
import {generateSimulationPuzzle} from '../src/sandwich';

vi.mock('../src/sandwich', () => ({generateSimulationPuzzle: vi.fn()}));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.resetModules(); });

it.each([false, true])('forwards grid-first=%s and transfers only grids meeting the threshold', async gridFirst => {
  const worker = {
    onmessage: undefined as undefined | ((event: {data: {trials: number; maxGivens: number; clueType: string; gridFirst?: boolean}}) => void),
    postMessage: vi.fn(),
  };
  vi.stubGlobal('self', worker);
  vi.mocked(generateSimulationPuzzle)
    .mockReturnValueOnce({grid: {values: new Uint8Array([1, 2, 0])} as never, clues: [0, null], fullyDug: true})
    .mockReturnValueOnce({grid: {values: new Uint8Array([1, 2, 3])} as never, clues: [0, null], fullyDug: false});
  await import('../src/simulation-worker');
  worker.onmessage!({data: {trials: 2, maxGivens: 3, clueType: 'sum-before-nine', gridFirst}});
  expect(generateSimulationPuzzle).toHaveBeenNthCalledWith(1, 'sum-before-nine', gridFirst);
  expect(worker.postMessage).toHaveBeenCalledTimes(2);
  const [first, second] = worker.postMessage.mock.calls.map(call => call[0]);
  expect(first).toMatchObject({trial: 1, givens: 3, puzzle: {values: '120', clues: '0,'}});
  expect(Number.isNaN(Date.parse(first.generatedAt))).toBe(false);
  expect(second).toMatchObject({trial: 2, givens: 4, fullyDug: false});
  expect(second.puzzle).toBeUndefined();
});

it('reports a generation failure instead of silently ending the run', async () => {
  const worker = {onmessage: undefined as undefined | ((event: {data: object}) => void), postMessage: vi.fn()};
  vi.stubGlobal('self', worker);
  vi.mocked(generateSimulationPuzzle).mockImplementation(() => { throw new Error('Generation failed'); });
  await import('../src/simulation-worker');
  worker.onmessage!({data: {trials: 1, maxGivens: 60, clueType: 'sandwich'}});
  expect(worker.postMessage).toHaveBeenCalledWith({error: 'Generation failed'});
});
