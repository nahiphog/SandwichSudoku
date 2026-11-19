const pages = [
  ['generate', 'Generate'],
  ['import-grid', 'Import grid'],
  ['techniques', 'Techniques'],
  ['simulation', 'Simulation'],
  ['about', 'About'],
  ['custom-build', 'Custom build'],
] as const;

export function mountPages() {
  const menu = document.createElement('details');
  menu.className = 'page-menu';
  menu.innerHTML = '<summary>Generate</summary><nav aria-label="Studio pages">' +
    pages.map(([id, label]) => `<a href="?page=${id}">${label}</a>`).join('') + '</nav>';
  document.querySelector('header')!.append(menu);
  const main = document.querySelector('main')!;
  const [intro, workspace, lower] = Array.from(main.children) as HTMLElement[];
  const [history, techniques, transfer] = Array.from(lower.children) as HTMLDetailsElement[];
  const simulation = document.createElement('section');
  simulation.className = 'card simulation';
  simulation.innerHTML = `<h1>Simulation</h1>
    <p>Generate sample grids, remove random digits, and check whether each puzzle has a unique solution.</p>
    <form><label>Samples <input name="samples" type="number" min="1" max="100" value="10" required></label>
    <label>Digits to remove <input name="removed" type="number" min="0" max="81" value="35" required></label>
    <button class="primary">Run simulation</button><button type="button" hidden>Cancel</button></form>
    <p role="status"></p><button id="simulation-export" hidden>Download results CSV</button>
    <div class="simulation-table"><table hidden><thead><tr><th>Sample</th><th>Givens</th><th>Result</th><th>Milliseconds</th></tr></thead><tbody></tbody></table></div>`;
  const about = workspace.querySelector<HTMLElement>('.rules')!;
  main.append(simulation, about);
  const form = simulation.querySelector('form')!;
  const start = form.querySelector('button')!;
  const cancel = form.querySelector<HTMLButtonElement>('button[type=button]')!;
  const output = simulation.querySelector('[role=status]')!;
  const table = simulation.querySelector('table')!;
  const exportButton = simulation.querySelector<HTMLButtonElement>('#simulation-export')!;
  let runner: Worker | undefined;
  let csv: string[] = [];
  function stop(message: string) {
    runner?.terminate();
    runner = undefined;
    output.textContent = message;
    start.disabled = false;
    cancel.hidden = true;
  }
  form.onsubmit = event => {
    event.preventDefault();
    const data = new FormData(form);
    const samples = Number(data.get('samples'));
    const removed = Number(data.get('removed'));
    csv = ['Sample,Givens,Result,Milliseconds'];
    table.tBodies[0].replaceChildren();
    table.hidden = true;
    exportButton.hidden = true;
    start.disabled = true;
    cancel.hidden = false;
    output.textContent = `Running 0 of ${samples} samples…`;
    runner = new Worker(new URL('./simulation-worker.ts', import.meta.url), {type: 'module'});
    runner.onmessage = ({data: {sample, givens, result, elapsed}}) => {
      const row = table.tBodies[0].insertRow();
      const fields = [sample, givens, result, elapsed];
      for (const field of fields) row.insertCell().textContent = String(field);
      csv.push(fields.join(','));
      table.hidden = false;
      exportButton.hidden = false;
      if (sample === samples) stop(`Completed ${samples} samples.`);
      else output.textContent = `Running ${sample} of ${samples} samples…`;
    };
    runner.onerror = () => stop('Simulation stopped after a calculation error.');
    runner.postMessage({samples, removed});
  };
  cancel.onclick = () => stop('Simulation cancelled. Completed samples are available below.');
  exportButton.onclick = () => {
    const url = URL.createObjectURL(new Blob([csv.join('\n')], {type: 'text/csv'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sandwich-simulation.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const heading = intro.querySelector('h1')!;
  const description = intro.querySelector('p')!;
  const generate = intro.querySelector<HTMLElement>('.generation-actions')!;
  const nav = menu.querySelector('nav')!;
  function route() {
    const requested = new URLSearchParams(location.search).get('page');
    const [page, label] = pages.find(([id]) => id === requested) ?? pages[0];
    const hasBoard = ['generate', 'import-grid', 'custom-build'].includes(page);
    document.body.dataset.page = page;
    menu.querySelector('summary')!.textContent = label;
    menu.open = false;
    nav.querySelectorAll('a').forEach(link => {
      if (link.search === `?page=${page}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    intro.hidden = page === 'simulation';
    heading.textContent = label;
    description.textContent = ({
      generate: '',
      'import-grid': 'Load a Sandwich Sudoku puzzle and check its solution.',
      techniques: 'Explore the solver’s techniques and their difficulty scores.',
      'custom-build': 'Click cells and outside sum positions to highlight where givens may appear. Build fills only highlighted positions and verifies exactly one solution.',
      simulation: '',
      about: '',
    })[page];
    description.hidden = page === 'generate';
    generate.hidden = page !== 'generate' && page !== 'custom-build';
    document.querySelectorAll<HTMLElement>('.generation-actions > label').forEach(label => label.hidden = page === 'custom-build');
    document.getElementById('generate-puzzle')!.hidden = page === 'custom-build';
    document.getElementById('custom-generate')!.hidden = page !== 'custom-build';
    document.getElementById('custom-clear')!.hidden = page !== 'custom-build';
    workspace.hidden = !hasBoard;
    lower.hidden = page === 'simulation' || page === 'about';
    history.hidden = !hasBoard;
    techniques.hidden = page !== 'techniques';
    techniques.open = page === 'techniques';
    transfer.hidden = !hasBoard;
    if (page === 'import-grid') {
      transfer.open = true;
      main.insertBefore(lower, workspace);
      history.hidden = true;
    } else {
      main.insertBefore(workspace, lower);
    }
    simulation.hidden = page !== 'simulation';
    about.hidden = page !== 'about';
    window.dispatchEvent(new Event("pagechange"));
    document.title = `${label} · Sandwich Sudoku Studio`;
  }
  nav.addEventListener('click', event => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, '', link.href);
    route();
    menu.querySelector('summary')!.focus();
  });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target as Node)) menu.open = false;
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      menu.open = false;
      menu.querySelector('summary')!.focus();
    }
  });
  window.addEventListener('popstate', route);
  route();
}
