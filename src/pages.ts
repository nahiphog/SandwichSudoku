import {mountSimulation} from './simulation';
import {TECHS} from './vendor/engine/ratings';
import {DISPLAYED_TECHNIQUES} from './techniques';
import {pages, pagePath, resolvePage} from './routes';

// Both source modules and built assets live one directory below the app root.
export const appBase = new URL(/* @vite-ignore */ '../', import.meta.url).pathname;

export function mountPages() {
  const menu = document.createElement('details');
  menu.className = 'page-menu';
  menu.innerHTML = '<summary>Pages</summary><nav aria-label="Pages">' +
    pages.filter(([id]) => id !== 'about').map(([id, label]) => `<a href="${pagePath(id, appBase)}">${label}</a>`).join('') + '</nav>';
  const aboutLink = document.createElement('a');
  aboutLink.className = 'header-about';
  aboutLink.href = pagePath('about', appBase);
  aboutLink.textContent = 'About';
  document.querySelector('header')!.append(menu, aboutLink);
  const main = document.querySelector('main')!;
  const [intro, workspace, lower] = Array.from(main.children) as HTMLElement[];
  const [history, transfer] = Array.from(lower.children) as HTMLDetailsElement[];
  const techniques = document.createElement('section');
  techniques.className = 'card technique-catalog';
  techniques.innerHTML = '<table><caption class="visually-hidden">Techniques and difficulty ratings</caption><thead><tr><th scope="col">Technique</th><th scope="col">Difficulty</th></tr></thead><tbody></tbody></table>';
  const entries = [
    ...DISPLAYED_TECHNIQUES.map(id => TECHS[id]).map(tech => ({
      name: tech.name, score: tech.score,
      status: !tech.implemented ? 'Unavailable' : tech.name === 'Brute Force' ? 'Optional' :
        tech.category === 'Uniqueness' ? 'Classic only' :
        !tech.enabled ? 'Disabled' : 'Enabled',
    })),
    {name: 'Sandwich sum', score: 5, status: 'Enabled'},
    {name: 'Edge difference', score: 5, status: 'Enabled'},
    {name: 'Skyscraper', score: 5, status: 'Enabled'},
    {name: 'X-sums', score: 5, status: 'Enabled'},
    {name: 'Sum before nine', score: 5, status: 'Enabled'},
    {name: 'Phistomefel Ring', score: 200, status: 'Enabled'},
  ].sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  for (const entry of entries) {
    const row = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = entry.name;
    if (entry.status !== 'Enabled') {
      const status = document.createElement('small');
      status.textContent = entry.status;
      name.append(status);
    }
    const detail = document.createElement('td');
    detail.className = 'technique-rating';
    detail.textContent = entry.score.toLocaleString('en-US');
    row.append(name, detail);
    techniques.querySelector('tbody')!.append(row);
  }
  main.append(techniques);
  const simulation = mountSimulation();
  const about = workspace.querySelector<HTMLElement>('.rules')!;
  main.append(simulation, about);

  const heading = intro.querySelector('h1')!;
  const description = intro.querySelector('p')!;
  const generate = intro.querySelector<HTMLElement>('.generation-actions')!;
  const clueType = document.getElementById('clue-type')!;
  const boardPanel = workspace.querySelector('.board-panel')!;
  const nav = menu.querySelector('nav')!;
  function route() {
    const url = new URL(location.href);
    const [page, label] = resolvePage(url, appBase);
    if (url.searchParams.has('page')) {
      url.searchParams.delete('page');
      url.pathname = pagePath(page, appBase);
      window.history.replaceState(null, '', url);
    }
    const hasBoard = ['generate', 'import-grid', 'custom-build'].includes(page);
    document.body.dataset.page = page;
    menu.querySelector('summary')!.textContent = 'Pages';
    menu.open = false;
    [...Array.from(nav.querySelectorAll('a')), aboutLink].forEach(link => {
      if (link.pathname === pagePath(page, appBase)) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    intro.hidden = page === 'simulation';
    heading.textContent = label;
    heading.parentElement!.hidden = page === 'generate';
    if (page === 'generate' || page === 'custom-build') generate.prepend(clueType);
    else boardPanel.prepend(clueType);
    description.textContent = ({
      generate: '',
      'import-grid': 'Load a Sudoku puzzle and check its solution.',
      'custom-build': 'Click cells and outside clue positions to highlight where givens may appear. Build fills only highlighted positions and verifies exactly one solution.',
      simulation: '',
      about: '',
      techniques: 'Techniques and difficulty ratings.',
    })[page];
    description.hidden = page === 'generate';
    generate.hidden = page !== 'generate' && page !== 'custom-build';
    document.querySelectorAll<HTMLElement>('.generation-actions > label').forEach(label => label.hidden = page === 'custom-build');
    document.getElementById('generate-puzzle')!.hidden = page === 'custom-build';
    document.getElementById('custom-generate')!.hidden = page !== 'custom-build';
    document.getElementById('custom-clear')!.hidden = page !== 'custom-build';
    workspace.hidden = !hasBoard;
    lower.hidden = page === 'simulation' || page === 'about' || page === 'techniques';
    history.hidden = !hasBoard;
    transfer.hidden = !hasBoard;
    if (page === 'import-grid') {
      transfer.open = true;
      main.insertBefore(lower, workspace);
      history.hidden = true;
    } else {
      main.insertBefore(workspace, lower);
    }
    simulation.hidden = page !== 'simulation';
    techniques.hidden = page !== 'techniques';
    about.hidden = page !== 'about';
    window.dispatchEvent(new Event("pagechange"));
    document.title = `${label} · Sandwich Sudoku`;
  }
  nav.addEventListener('click', event => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, '', link.href);
    route();
    menu.querySelector('summary')!.focus();
  });
  aboutLink.addEventListener('click', event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, '', aboutLink.href);
    route();
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
