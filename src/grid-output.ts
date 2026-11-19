import {applyMove, type Clues, type Move} from './sandwich';
import {cellName, cloneGrid, digitsOf, type Grid} from './vendor/engine/board';

export function mountWalkthrough(panel: HTMLElement, puzzle: Grid, clues: Clues, moves: Move[], solution?: Uint8Array) {
  panel.innerHTML = '<h2>Solution walkthrough</h2><p aria-live="polite"></p><small>Teal marks the pattern, amber marks supporting candidates, purple marks fins. Red struck-through candidates are eliminated in this step.</small><div class="walkthrough-grid" aria-label="Walkthrough grid"></div><div class="walkthrough-nav"><button>Previous</button><button>Next</button><button>Show solution</button></div>';
  const description = panel.querySelector('p')!;
  const board = panel.querySelector('.walkthrough-grid')!;
  const [previous, next, finish] = Array.from(panel.querySelectorAll('button'));
  const end = moves.length || (solution ? 1 : 0);
  let step = 0;
  function render() {
    const grid = cloneGrid(puzzle);
    for (const move of moves.slice(0, step)) applyMove(grid, move);
    if (step && solution) grid.values.set(solution);
    const move = moves[step - 1];
    const changes = [...(move?.placements ?? []), ...(move?.eliminations ?? [])];
    description.textContent = move
      ? `Step ${step} of ${end} · ${move.name}. ${move.description}`
      : step ? 'Exact search completed the grid.'
      : solution ? 'The logical solver stalled. Show solution to see the verified completion.' : `Starting grid · ${end} steps`;
    board.replaceChildren();
    for (let r = -1; r < 9; r++) {
      for (let c = -1; c < 9; c++) {
        const tile = document.createElement('span');
        if (r < 0 || c < 0) {
          tile.textContent = r < 0 && c < 0 ? '' : String(clues[r < 0 ? 9 + c : r] ?? '');
          const unit = r < 0 ? 9 + c : r;
          if (!(r < 0 && c < 0) && move?.sandwichUnit === unit) {
            tile.className = 'walkthrough-driving-clue';
            tile.setAttribute('aria-label', `${unit < 9 ? 'Row' : 'Column'} ${unit % 9 + 1} sum ${clues[unit]}, driving this deduction`);
          }
        } else {
          const cell = r * 9 + c;
          if (grid.values[cell]) {
            tile.textContent = String(grid.values[cell]);
          } else {
            const candidates = document.createElement('span');
            candidates.className = 'walkthrough-candidates';
            const digits = digitsOf(grid.cands[cell]);
            for (let digit = 1; digit <= 9; digit++) {
              const mark = document.createElement('span');
              const matches = (entries?: Move['primary']) =>
                entries?.some(entry => entry.cell === cell && entry.digit === digit);
              const eliminated = matches(move?.eliminations);
              mark.textContent = digits.includes(digit) || eliminated ? String(digit) : '';
              if (mark.textContent) {
                mark.className = [
                  matches(move?.primary) && 'candidate-primary',
                  matches(move?.secondary) && 'candidate-secondary',
                  matches(move?.fins) && 'candidate-fin',
                  eliminated && 'candidate-eliminated',
                ].filter(Boolean).join(' ');
                mark.setAttribute('aria-label', `${cellName(cell)} candidate ${digit}${eliminated ? ', eliminated' : ''}`);
              }
              candidates.append(mark);
            }
            tile.append(candidates);
          }
          tile.title = cellName(cell);
          tile.className = ['cell', !puzzle.values[cell] && 'walkthrough-entry',
            r % 3 === 0 && 'box-top', c % 3 === 0 && 'box-left',
            r === 8 && 'edge-bottom', c === 8 && 'edge-right',
            move?.primary?.some(entry => entry.cell === cell) && 'pattern-primary',
            move?.secondary?.some(entry => entry.cell === cell) && 'pattern-secondary',
            move?.fins?.some(entry => entry.cell === cell) && 'pattern-fin',
            (move?.sandwichUnit === r || move?.sandwichUnit === 9 + c) && 'walkthrough-driving-unit',
            changes.some(change => change.cell === cell) && 'deduction'].filter(Boolean).join(' ');
        }
        board.append(tile);
      }
    }
    previous.disabled = step === 0;
    next.disabled = finish.disabled = step === end;
  }
  previous.onclick = () => { step--; render(); };
  next.onclick = () => { step++; render(); };
  finish.onclick = () => { step = end; render(); };
  panel.hidden = false;
  render();
}

export async function copyGridText(grid: Grid, clues: Clues) {
  const text = JSON.stringify({version: 1, values: Array.from(grid.values), clues});
  try {
    await navigator.clipboard.writeText(text);
    return 'Grid string copied with all row and column clue positions.';
  } catch {
    window.prompt('Copy this puzzle string', text);
    return 'Puzzle string prepared.';
  }
}

export async function copyGridImage(grid: Grid, clues: Clues) {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = canvas.height = size * 10 + 8;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fffefa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '32px sans-serif';
  ctx.fillStyle = '#293d39';
  const label = (value: number | null, row: number, col: number) => {
    if (value !== null) ctx.fillText(String(value), (col + 0.5) * size, (row + 0.5) * size);
  };
  for (let i = 0; i < 9; i++) {
    label(clues[i], i + 1, 0);
    label(clues[9 + i], 0, i + 1);
  }
  grid.values.forEach((digit, cell) => {
    if (digit) label(digit, 1 + Math.floor(cell / 9), 1 + cell % 9);
  });
  ctx.strokeStyle = '#455b50';
  for (let i = 0; i <= 9; i++) {
    const offset = (i + 1) * size;
    ctx.lineWidth = i % 3 === 0 ? 4 : 1;
    ctx.beginPath();
    ctx.moveTo(size, offset);
    ctx.lineTo(size * 10, offset);
    ctx.moveTo(offset, size);
    ctx.lineTo(offset, size * 10);
    ctx.stroke();
  }
  const png = new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')));
  });
  try {
    await navigator.clipboard.write([new ClipboardItem({'image/png': png})]);
    return 'Grid image copied with row and column sums.';
  } catch {
    const blob = await png.catch(() => null);
    if (!blob) return 'The grid image could not be created.';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sandwich-sudoku.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'Grid image downloaded as PNG.';
  }
}
