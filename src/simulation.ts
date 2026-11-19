import {clueCount, clueLabel, clueName, cluePosition, fourSided, type ClueType} from './sandwich';
import {copyGridText} from './grid-output';
import {gridFromValues} from './vendor/engine/board';
import {DEFAULT_TRIALS, TRIAL_OPTIONS, decodeSimulationPuzzle, type SimulationTrial} from './simulation-data';
import './simulation.css';

export function mountSimulation(): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'card simulation';
  panel.innerHTML = `<h1>Simulation</h1>
    <p>Generate unique puzzles and track their total givens: grid digits plus outside clues.</p>
    <form><fieldset class="clue-switch"><legend>Choose your puzzle type</legend>
    <select name="clueType" aria-label="Choose your puzzle type">
      <option value="sandwich">Sandwich sums</option><option value="edge-difference">Edge difference</option>
      <option value="skyscraper">Skyscraper</option><option value="x-sums">X-sums</option><option value="sum-before-nine">Sum before nine</option>
    </select></fieldset>
    <label>Total trials <select name="trials">${TRIAL_OPTIONS.map(value => `<option value="${value}" ${value === DEFAULT_TRIALS ? 'selected' : ''}>${value.toLocaleString('en-US')}</option>`).join('')}</select></label>
    <label>Display grid with at most <select name="maxGivens" aria-label="Maximum givens to display">${Array.from({length: 60}, (_, i) => `<option value="${i + 1}" ${i === 59 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select> cells (numbers inside the grid and outside the grid)</label>
    <label class="simulation-grid-first"><input type="checkbox" name="gridFirst"> Dig the cells inside the grid first</label>
    <button class="primary" type="submit">Run simulation</button><button type="button" class="simulation-cancel" hidden>Cancel</button></form>
    <p class="simulation-settings">No brute force method: off · Rotational symmetry: off · Outside clues: dig one at a time</p>
    <p role="status" class="simulation-status">Ready to run.</p>
    <section class="simulation-results" hidden><h2>Givens histogram</h2>
      <p class="simulation-summary"></p><div class="simulation-histogram"></div>
      <button class="simulation-export">Download histogram CSV</button>
      <h2 class="simulation-matches-heading">Matching puzzles</h2><p class="simulation-match-count"></p>
      <div class="simulation-pagination"><button class="simulation-previous">Previous</button><span></span><button class="simulation-next">Next</button></div>
      <div class="simulation-puzzles"></div></section>`;
  const get = <T extends Element = HTMLElement>(selector: string) => panel.querySelector<T>(selector)!;
  const form = get<HTMLFormElement>('form');
  const start = get<HTMLButtonElement>('button[type=submit]');
  const cancel = get<HTMLButtonElement>('.simulation-cancel');
  const status = get('.simulation-status');
  const previous = get<HTMLButtonElement>('.simulation-previous');
  const next = get<HTMLButtonElement>('.simulation-next');
  let runner: Worker | undefined;
  let matches: SimulationTrial[] = [];
  let bins: number[] = [];
  let completed = 0, requested = 0, threshold = 60, page = 0, limited = 0;
  let clueType: ClueType = 'sandwich';
  let renderedMatchesKey = '';
  const pageSize = 10;
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'medium',
  });

  function stop(message: string) {
    runner?.terminate();
    runner = undefined;
    status.textContent = message;
    start.disabled = false;
    cancel.hidden = true;
    form.querySelectorAll<HTMLSelectElement | HTMLInputElement>('select, input').forEach(select => { select.disabled = false; });
  }

  function renderHistogram() {
    const max = Math.max(1, ...bins);
    const width = 920, height = 220, left = 65, top = 20;
    const barWidth = width / bins.length;
    const bars = bins.map((count, x) => {
      const h = height * count / max;
      return `<rect x="${left + x * barWidth}" y="${top + height - h}" width="${Math.max(1, barWidth - 1)}" height="${h}" fill="#315d49"><title>X = ${x}: ${count} trials</title></rect>`;
    }).join('');
    const ticks = bins.map((_, x) => x % 10 ? '' : `<text x="${left + (x + .5) * barWidth}" y="260" text-anchor="middle">${x}</text>`).join('');
    get('.simulation-histogram').innerHTML = `<svg viewBox="0 0 1000 310" role="img" aria-label="Histogram of ${completed} trials. Horizontal axis: total givens X. Vertical axis: number of trials.">
      <line x1="${left}" y1="${top}" x2="${left}" y2="240" stroke="#899287"/><line x1="${left}" y1="240" x2="985" y2="240" stroke="#899287"/>
      <text x="55" y="25" text-anchor="end">${max}</text><text x="55" y="244" text-anchor="end">0</text>
      <text transform="translate(16 135) rotate(-90)" text-anchor="middle">Trials</text>${bars}${ticks}<text x="525" y="292" text-anchor="middle">Total givens (X)</text></svg>`;
    get('.simulation-summary').textContent = `${completed.toLocaleString()} of ${requested.toLocaleString()} trials completed. ${limited ? `${limited.toLocaleString()} reached a digging search limit; their puzzles are still verified unique.` : 'Every completed puzzle has a verified unique solution.'}`;
  }

  function renderMatches() {
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
    previous.disabled = page === 0;
    next.disabled = page + 1 >= totalPages;
    get('.simulation-pagination span').textContent = `Page ${page + 1} of ${totalPages.toLocaleString()}`;
    get('.simulation-match-count').textContent = `${matches.length.toLocaleString()} puzzles with at most ${threshold} givens. All matches remain available on these pages until a new run or page reload.`;
    const key = `${page}:${Math.min(pageSize, Math.max(0, matches.length - page * pageSize))}`;
    if (key === renderedMatchesKey) return;
    renderedMatchesKey = key;
    const container = get('.simulation-puzzles');
    container.replaceChildren();
    for (const result of matches.slice(page * pageSize, (page + 1) * pageSize)) {
      const {values, clues} = decodeSimulationPuzzle(result.puzzle!);
      const card = document.createElement('article');
      card.className = 'simulation-puzzle';
      const heading = document.createElement('h3');
      heading.textContent = `Trial ${result.trial.toLocaleString()} · ${clueName(clueType)} · Givens (X): ${result.givens}`;
      const time = document.createElement('time');
      time.dateTime = result.generatedAt;
      time.textContent = `${dateFormat.format(new Date(result.generatedAt))} (MYT, UTC+08:00)`;
      const board = document.createElement('div');
      board.className = `walkthrough-grid${fourSided(clueType) ? ' four-sided-grid' : ''}`;
      board.setAttribute('aria-label', `Trial ${result.trial} puzzle grid`);
      const end = fourSided(clueType) ? 10 : 9;
      for (let r = -1; r < end; r++) for (let c = -1; c < end; c++) {
        const tile = document.createElement('span');
        if (r < 0 || c < 0 || r === 9 || c === 9) {
          const corner = (r < 0 || r === 9) && (c < 0 || c === 9);
          const index = r < 0 ? 9 + c : r === 9 ? 27 + c : c === 9 ? 18 + r : r;
          tile.textContent = corner ? (r === -1 && c === -1 ? clueLabel(clueType) : '') : String(clues[index] ?? '');
          if (!corner) tile.setAttribute('aria-label', `${cluePosition(index)} clue ${clues[index] ?? 'absent'}`);
        } else {
          tile.textContent = values[r * 9 + c] ? String(values[r * 9 + c]) : '';
          tile.className = ['cell', r % 3 === 0 && 'box-top', c % 3 === 0 && 'box-left', r === 8 && 'edge-bottom', c === 8 && 'edge-right'].filter(Boolean).join(' ');
          tile.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${values[r * 9 + c] || 'empty'}`);
        }
        board.append(tile);
      }
      const copy = document.createElement('button');
      copy.textContent = 'Copy to clipboard';
      copy.title = 'Copy importable puzzle JSON, including all outside clues';
      const feedback = document.createElement('span');
      feedback.setAttribute('role', 'status');
      copy.onclick = async () => { feedback.textContent = await copyGridText(gridFromValues(values), clues, clueType); };
      card.append(heading, time, board, copy, feedback);
      if (!result.fullyDug) {
        const note = document.createElement('p');
        note.textContent = 'Unique puzzle; some digging checks reached the search limit.';
        card.append(note);
      }
      container.append(card);
    }
  }
  previous.onclick = () => { page--; renderMatches(); };
  next.onclick = () => { page++; renderMatches(); };
  form.onsubmit = event => {
    event.preventDefault();
    if (runner) return;
    const data = new FormData(form);
    requested = Number(data.get('trials'));
    threshold = Number(data.get('maxGivens'));
    const gridFirst = data.get('gridFirst') === 'on';
    clueType = data.get('clueType') as ClueType;
    matches = []; completed = page = limited = 0; renderedMatchesKey = '';
    bins = new Array(82 + clueCount(clueType)).fill(0);
    get<HTMLElement>('.simulation-results').hidden = false;
    renderHistogram(); renderMatches();
    start.disabled = true; cancel.hidden = false;
    form.querySelectorAll<HTMLSelectElement | HTMLInputElement>('select, input').forEach(select => { select.disabled = true; });
    status.textContent = `Running 0 of ${requested.toLocaleString()} trials…`;
    runner = new Worker(new URL('./simulation-worker.ts', import.meta.url), {type: 'module'});
    runner.onmessage = ({data: result}: MessageEvent<SimulationTrial & {error?: string}>) => {
      if (result.error) { stop(`Simulation stopped: ${result.error}. Completed results are retained.`); return; }
      completed = result.trial;
      bins[result.givens]++;
      if (!result.fullyDug) limited++;
      if (result.puzzle) matches.push(result);
      renderHistogram();
      // Render at most ten boards, not an ever-growing DOM for million-trial runs.
      if (result.puzzle) renderMatches();
      if (completed === requested) stop(`Completed ${completed.toLocaleString()} trials.`);
      else status.textContent = `Running ${completed.toLocaleString()} of ${requested.toLocaleString()} trials…`;
    };
    runner.onerror = () => stop('Simulation stopped after a calculation error. Completed results are retained.');
    runner.postMessage({trials: requested, maxGivens: threshold, clueType, gridFirst});
  };
  cancel.onclick = () => stop(`Simulation cancelled after ${completed.toLocaleString()} completed trials. Results are retained.`);
  get<HTMLButtonElement>('.simulation-export').onclick = () => {
    const csv = ['Givens X,Trials', ...bins.map((count, x) => `${x},${count}`)].join('\n');
    const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
    const link = document.createElement('a');
    link.href = url; link.download = `${clueType}-histogram.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return panel;
}
