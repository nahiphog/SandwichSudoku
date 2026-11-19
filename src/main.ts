import {mountWalkthrough, copyGridImage, copyGridText} from './grid-output';
import {mountPages, appBase} from './pages';
import './style.css';
import {gridFromValues,cloneGrid,digitsOf,isSolved,type Grid} from './vendor/engine/board';
import {fourSided, clueMin, clueMax, clueCount, clueLabel, clueName, cluePosition, applyMove,type Clues,type Move,type ClueType} from './sandwich';

let grid=gridFromValues(new Array(81).fill(0)), clues: Clues=new Array(18).fill(null), selected=40, candidates=false, score=0, history:Move[]=[], pending:Move|null=null;
let clueType: ClueType = 'sandwich';
let worker:Worker|null=null;
const customCells = new Set<number>();
const customSums = new Set<number>();
let preview: {grid: Grid; clues: Clues} | null = null;
let progressTimer: ReturnType<typeof setTimeout> | undefined;
let generationStarted: number | null = null;
let elapsedTimer: ReturnType<typeof setInterval> | undefined;
const undo:{grid:Grid;clues:Clues;score:number;history:Move[];clueType:ClueType}[]=[];
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><a class="brand" href="${appBase}"><img src="${appBase}sandwich.svg" width="38" height="38" alt=""> Sandwich Sudoku</a></header>
<main><section class="intro"><div><h1>Generate</h1><p hidden></p></div><div class="generation-actions"><label><input id="logical-only" type="checkbox" checked> No brute force method</label><label><input id="rotational" type="checkbox" checked> Rotational symmetry</label><label title="Attempt every allowed grid-cell removal before trying outside clues."><input id="grid-first" type="checkbox"> Dig grid cells first</label><label>Outside clues <select id="dig-clues"><option value="none">Do not dig outside clues</option><option value="single" selected>Dig outside clues one at a time</option><option value="pairs">Dig outside clues in pairs</option></select></label><button id="generate-puzzle" class="primary">Generate puzzle</button><button id="custom-generate" hidden>Build from highlighted entries</button><button id="custom-clear" hidden>Clear highlights</button><span id="generation-time" role="timer" aria-label="Generation elapsed time" hidden></span></div></section>
<div class="workspace"><section class="board-panel"><fieldset id="clue-type" class="clue-switch" aria-describedby="clue-help"><legend>Choose your puzzle type</legend><select name="clue-type" aria-label="Choose your puzzle type" aria-describedby="clue-help"><option value="sandwich">Sandwich sums</option><option value="edge-difference">Edge difference</option><option value="skyscraper">Skyscraper</option><option value="x-sums">X-sums</option><option value="sum-before-nine">Sum before nine</option></select><p id="clue-help"></p></fieldset><div class="panel-top"><div><span class="dot"></span><strong id="board-title">Your grid</strong></div><span id="filled"></span></div><div class="board-wrap"><div id="board" role="group" aria-label="Editable sandwich sudoku grid"></div></div><div class="board-tools"><button id="notes" aria-pressed="false">Candidates</button><button id="undo">↶ Undo</button></div><div class="board-tools copy-tools"><button id="copy-string">Copy grid string</button><button id="copy-image">Copy grid image</button></div><div class="keypad">${Array.from({length:9},(_,i)=>`<button data-digit="${i+1}" aria-label="Enter ${i+1}">${i+1}</button>`).join('')}<button data-digit="0" aria-label="Erase selected cell">⌫</button></div><p class="board-caption">Select a cell to edit · 1–9 to enter · Delete to erase · Arrow keys to move</p></section>
<aside><section class="card rules"><h2>Sandwich sudoku</h2><p>Normal sudoku rules apply. Clues outside the grid give the sum of digits <strong>between 1 and 9</strong> in that row or column, not including the 1 and 9 themselves.</p><div class="example"><span>1</span><b>3</b><b>5</b><b>2</b><span>9</span><em> = 10</em></div><small>Only the filling counts. Adjacent 1 and 9 give 0.</small><h2>Edge difference sudoku</h2><p>Normal sudoku rules apply. Each outside clue gives the <strong>absolute difference between the two end cells</strong>. Left clues compare the first and last cells of a row; top clues compare the top and bottom cells of a column.</p><div class="example"><span>9</span><em> − </em><span>2</span><em> = 7</em></div><small>Either order works: |2 − 9| is also 7. Clues range from 1 to 8.</small><h2>Skyscraper</h2><p>Normal sudoku rules apply. Consider each digit in the grid as a building of that height. Clues outside the grid give the number of buildings that can be seen from that direction, with larger buildings hiding smaller ones.</p><small>Clues can appear to the left or right of a row, or above or below a column. Clues range from 1 to 9.</small><h2>X-sums</h2><p>Normal sudoku rules apply. Also, the clues outside the grid indicate the sum of the first X numbers placed in the corresponding direction, where X is equal to the first number placed in that direction. For example, if the number 20 is placed above R1C2, and this very cell holds the number 3, then the first three cells in that column sum to 20 (R1C2 + R2C2 + R3C2 = 20).</p><small>Clues can appear to the left or right of a row, or above or below a column. Clues range from 1 to 45.</small><h2>Sum before nine</h2><p>Normal sudoku rules apply. Clues outside the grid indicate the sum of all numbers that appear before the 9 in that row or column, looking from that direction. (For example, a row with a clue of “6” to its left might start with values like 249, 1329, or 69.)</p><small>Clues can appear on all four sides and range from 0 to 36. The 9 is excluded; a clue of 0 puts 9 first.</small></section>
<section class="card"><div class="card-heading"><h2>Solving desk</h2><span class="badge"><b id="score">0</b> points</span></div><p id="status" role="status" aria-live="polite">Generate a puzzle or enter your own digits and clues.</p><div class="actions"><button id="hint" class="primary">Find next step →</button><button id="solve">Solve & check uniqueness</button><button id="cancel" hidden>Cancel calculation</button></div><div id="generation-rating" hidden></div><div id="hint-detail"></div><div class="minor-actions"><button id="blank">Blank grid</button><button id="clear">Clear digits, keep clues</button></div></section>
<section id="walkthrough" class="card" hidden></section></aside></div>
<section class="lower"><details class="card"><summary>Solving history <span id="step-count">0 steps</span></summary><ol id="history"></ol></details><details class="card"><summary>Import / export <span>Save your construction</span></summary><p>JSON stores the clue type, all 81 digits and 18 clues (rows, then columns), or 36 Skyscraper, X-sums, or Sum before nine clues (left rows, top columns, right rows, bottom columns; each side in grid order). Use null for an absent clue.</p><textarea id="data" aria-label="Puzzle JSON" placeholder="Paste exported puzzle JSON"></textarea><div class="minor-actions"><button id="export">Export</button><button id="import">Import</button></div></details></section>
</main>`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
function status(s:string){el('status').textContent=s}
function updateGenerationTime() {
  if (generationStarted === null) return;
  el('generation-time').textContent = `Elapsed time: ${((performance.now() - generationStarted) / 1000).toFixed(1)} s`;
}
function startGenerationTimer() {
  generationStarted = performance.now();
  el('generation-time').hidden = false;
  updateGenerationTime();
  elapsedTimer = setInterval(updateGenerationTime, 100);
  for (const id of ['generate-puzzle', 'custom-generate']) {
    el(id).textContent = 'Cancel';
    el(id).classList.add('cancel-generation');
  }
}
function stopGenerationTimer() {
  updateGenerationTime();
  clearInterval(elapsedTimer);
  generationStarted = null;
  el('generate-puzzle').textContent = 'Generate puzzle';
  el('custom-generate').textContent = 'Build from highlighted entries';
  for (const id of ['generate-puzzle', 'custom-generate']) el(id).classList.remove('cancel-generation');
}
function stop(){const fallback=el<HTMLButtonElement>('brute-force-continue');if(fallback)fallback.disabled=false;clearTimeout(progressTimer);stopGenerationTimer();if(preview){preview=null;render();}worker?.terminate();worker=null;el<HTMLButtonElement>('generate-puzzle').disabled=false;el('cancel').hidden=true;el<HTMLButtonElement>('hint').disabled=false;el<HTMLButtonElement>('solve').disabled=false;}
function save(){stop();el("walkthrough").hidden=true;el("generation-rating").hidden=true;undo.push({grid:cloneGrid(grid),clues:[...clues],score,history:[...history],clueType});pending=null;}
function resetRating(){score=0;history=[];pending=null}
function edit(cell:number,digit:number){save();const values=Array.from(grid.values);values[cell]=digit;grid=gridFromValues(values);resetRating();render();status('Grid updated. Find a logical step or check its solutions.');}
function render(){
  el('clue-type').querySelector<HTMLSelectElement>('select')!.value = clueType;
  el('clue-help').textContent = clueType === 'sum-before-nine' ? 'Outside clues sum all digits before the 9, excluding the 9, viewed from that side. Clues range from 0 to 36; 0 means 9 comes first. Clues may appear on any side.' : clueType === 'x-sums' ? 'Outside clues sum the first X digits from that side, including the first digit, which gives X. Clues range from 1 to 45 and may appear on any side.' : clueType === 'skyscraper' ? 'Normal sudoku rules apply. Consider each digit in the grid as a building of that height. Clues outside the grid give the number of buildings that can be seen from that direction, with larger buildings hiding smaller ones. Clues range from 1 to 9 and may appear on any side.' : clueType === 'sandwich' ? 'Outside clues sum the digits between 1 and 9.' : 'Left clues: |first − last| in each row. Top clues: |top − bottom| in each column. Differences range from 1 to 8.';
  el('board').setAttribute('aria-label', `Editable ${clueType} sudoku grid`);
  const shownGrid = preview?.grid ?? grid;
  const shownClues = preview?.clues ?? clues;
  const board=el('board');board.replaceChildren();board.classList.toggle('four-sided-grid', fourSided(clueType));
  const corner=document.createElement('div');corner.className='clue-label';corner.textContent=clueLabel(clueType);board.append(corner);
  function clueInput(u:number){const input=document.createElement('input');input.className='clue';input.type='text';input.inputMode='numeric';input.maxLength=2;input.value=shownClues[u]===null?'':String(shownClues[u]);input.readOnly=!!preview;input.placeholder='·';input.setAttribute('aria-label',`${cluePosition(u)} ${clueName(clueType)} clue`);if(document.body.dataset.page==='custom-build'){
      input.readOnly=true;
      input.classList.toggle('custom-highlight',customSums.has(u));
      input.onclick=()=>{customSums.has(u)?customSums.delete(u):customSums.add(u);render()};
    }
    input.onchange=()=>{const raw=input.value.trim(),v=raw===''?null:Number(raw);if(v!==null&&(!/^\d+$/.test(raw)||!Number.isInteger(v)||v<clueMin(clueType)||v>(clueMax(clueType)))){status(clueType === 'sum-before-nine' ? 'Sum before nine clues must be whole numbers from 0 to 36, or blank.' : clueType === 'x-sums' ? 'X-sums clues must be whole numbers from 1 to 45, or blank.' : clueType === 'sandwich' ? 'Clues must be whole numbers from 0 to 35, or blank.' : clueType === 'skyscraper' ? 'Skyscraper clues must be whole numbers from 1 to 9, or blank.' : 'Edge differences must be whole numbers from 1 to 8, or blank.');render();return}save();clues[u]=v;grid=gridFromValues(grid.values);resetRating();render();status('Clue updated.');};return input}
  for(let c=0;c<9;c++)board.append(clueInput(9+c));
  if(fourSided(clueType))board.append(document.createElement('div'));
  for(let r=0;r<9;r++){board.append(clueInput(r));for(let c=0;c<9;c++){
    const i=r*9+c,b=document.createElement('button');b.className='cell';b.dataset.cell=String(i);
    if(c%3===0)b.classList.add('box-left');if(r%3===0)b.classList.add('box-top');if(c===8)b.classList.add('edge-right');if(r===8)b.classList.add('edge-bottom');
    if(i===selected)b.classList.add('selected');
    if(pending?.placements.some(x=>x.cell===i)||pending?.eliminations.some(x=>x.cell===i))b.classList.add('deduction');
    b.setAttribute('aria-label',`Row ${r+1}, column ${c+1}, ${shownGrid.values[i]||'empty'}`);b.setAttribute('aria-pressed',String(i===selected));
    if(shownGrid.values[i])b.textContent=String(shownGrid.values[i]);else if(candidates&&!preview)b.innerHTML=`<span class="pencils">${Array.from({length:9},(_,d)=>`<span>${digitsOf(grid.cands[i]).includes(d+1)?d+1:''}</span>`).join('')}</span>`;
    if(document.body.dataset.page==='custom-build'&&customCells.has(i))b.classList.add('custom-highlight');
    b.onclick=()=>{if(document.body.dataset.page==='custom-build'){customCells.has(i)?customCells.delete(i):customCells.add(i)}selected=i;render();el('board').querySelector<HTMLButtonElement>(`[data-cell="${i}"]`)?.focus()};board.append(b);
  }if(fourSided(clueType))board.append(clueInput(18+r));}
  if(fourSided(clueType)){board.append(document.createElement('div'));for(let c=0;c<9;c++)board.append(clueInput(27+c));board.append(document.createElement('div'));}
  el('filled').textContent=`${shownGrid.values.filter(Boolean).length} / 81 filled · ${shownClues.filter(clue => clue !== null).length} outside clues`;el('score').textContent=String(score);el('step-count').textContent=`${history.length} steps`;
  el('notes').setAttribute('aria-pressed',String(candidates));
  el('history').replaceChildren(...history.map(m=>{const li=document.createElement('li');li.textContent=`${m.name} (+${m.score}) — ${m.description}`;return li}));
  el('hint-detail').replaceChildren();if(pending){const p=document.createElement('p');p.textContent=`${pending.name} (+${pending.score}): ${pending.description}`;const b=document.createElement('button');b.textContent='Apply this step';b.className='primary';b.onclick=()=>{const move=pending!;save();applyMove(grid,move);history.push(move);score+=move.score;render();status(isSolved(grid)?'Grid filled. Use Solve & check uniqueness to verify.':'Step applied. Find the next deduction when ready.');};el('hint-detail').append(p,b)}
}
function run(action:'hint'|'solve'){
  stop();pending=null;render();status(action==='hint'?'Looking for a logical deduction…':'Searching for solutions that satisfy every outside clue…');
  el<HTMLButtonElement>('hint').disabled=true;el<HTMLButtonElement>('solve').disabled=true;el('cancel').hidden=false;
  worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{stop();if(data.error){status(data.error);return}if(action==='hint'){pending=data.result;render();status(pending?'A deduction is ready. Highlighted cells will change when you apply it.':isSolved(grid)?'This completed grid satisfies all Sudoku and selected clue rules.':'No logical step found. Exact search can check this position.');}else{const {solutions,exhausted}=data.result;if(solutions.length){save();grid=solutions[0];resetRating();render();status(solutions.length>1?'Multiple solutions found. Showing one; add more givens or clues to make the puzzle unique.':exhausted?'One solution found; search limit reached, so uniqueness is unknown.':'Exactly one solution found. All Sudoku and selected clue constraints are satisfied.')}else status(exhausted?'Search limit reached. No conclusion yet; add more givens or clues.':'No solution satisfies this grid and its clues.')}};
  worker.onerror=()=>{stop();status('Calculation failed. Your puzzle is unchanged; please try again.')};worker.postMessage({action,grid,clues,clueType});
}
el('generate-puzzle').onclick = () => {
  if (generationStarted !== null) { cancelGeneration(); return; }
  stop();
  startGenerationTimer();
  el<HTMLButtonElement>('hint').disabled = true;
  el<HTMLButtonElement>('solve').disabled = true;
  status('Removing digits and checking uniqueness…');
  worker = new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'});
  const updates: (() => void)[] = [];
  let playing = false;
  const play = () => {
    const update = updates.shift();
    if (!update) { playing = false; return; }
    playing = true;
    progressTimer = setTimeout(() => { update(); play(); }, 45);
  };
  worker.onmessage = ({data}) => {
    if (data.progress) {
      const {values, clues, phase} = data.progress;
      updates.push(() => {
        preview = {grid: gridFromValues(values), clues};
        render();
        status(phase === 'rating' ? 'Checking the logical solve…'
          : phase === 'clues' ? 'Removing outside clues…' : 'Removing digits…');
      });
    } else {
      updates.push(() => finish(data));
    }
    if (!playing) play();
  };
  const finish = (data: {error?: string; result: ReturnType<typeof import('./sandwich').generatePuzzle>}) => {
    stop();
    if (data.error) { status(data.error); return; }
    save();
    ({grid, clues} = data.result);
    resetRating();
    render();
    const report = el('generation-rating');
    const rating = data.result.rating;
    const walkthrough = mountWalkthrough(el("walkthrough"), grid, clues, rating?.moves ?? [], data.result.solution ?? undefined, clueType);
    report.hidden = false;
    report.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = rating ? `Total difficulty score: ${rating.score}` : 'Logical solve stalled';
    report.append(title);
    if (!rating) {
      const explanation = document.createElement('p');
      explanation.textContent = 'All supported logical techniques have been exhausted. Brute force is available as a last resort to complete the grid and verify uniqueness.';
      const fallback = document.createElement('button');
      fallback.id = 'brute-force-continue';
      fallback.textContent = 'Use brute force to continue';
      fallback.onclick = () => {
        run('solve');
        fallback.disabled = true;
      };
      report.append(explanation, fallback);
    }
    if (rating) {
      const table = document.createElement('table');
      table.className = 'difficulty-techniques';
      table.innerHTML = '<thead><tr><th scope="col">Technique</th><th scope="col">Steps</th></tr></thead>';
      const body = table.createTBody();
      for (const [name] of rating.techniques) {
        const row = body.insertRow();
        const technique = document.createElement('th');
        technique.scope = 'row';
        technique.textContent = name;
        row.append(technique);
        const steps = row.insertCell();
        const instances = rating.moves
          .map((move, index) => ({name: move.name, step: index + 1, score: move.score}))
          .filter(move => move.name === name);
        instances.forEach(({step}, index) => {
          const link = document.createElement('button');
          link.className = 'technique-step-link';
          link.dataset.walkthroughStep = String(step);
          link.textContent = String(step);
          link.setAttribute('aria-label', `${name}, instance ${index + 1}, step ${step}`);
          link.title = `Jump to step ${step}`;
          link.onclick = () => walkthrough.goToStep(step);
          steps.append(' ', link);
        });
      }
      report.append(table);
    }
    status(data.result.fullyDug
      ? 'Fully dug with exactly one solution under your selected settings. No further allowed removal passed the required checks.'
      : 'Exactly one solution. Full digging could not be verified because some removal checks reached the search limit.');
  };
  worker.onerror = () => {
    stop();
    status('Puzzle generation failed. Please try again.');
  };
  worker.postMessage({action: document.body.dataset.page === 'custom-build' ? 'custom-build' : 'generate-puzzle', clueType, cells: [...customCells], sums: [...customSums], logicalOnly: el<HTMLInputElement>('logical-only').checked, rotational: el<HTMLInputElement>('rotational').checked, gridFirst: el<HTMLInputElement>('grid-first').checked, digClues: el<HTMLSelectElement>('dig-clues').value});
};
el('custom-generate').onclick = () => el('generate-puzzle').click();
el('custom-clear').onclick = () => {customCells.clear();customSums.clear();render()};
let previousPage: string | undefined;
window.addEventListener('pagechange', () => {
  const page = document.body.dataset.page;
  if (page === 'custom-build' && previousPage !== 'custom-build') {
    stop();
    grid = gridFromValues(new Array(81).fill(0));
    clues = new Array(clueCount(clueType)).fill(null);
    customCells.clear();
    customSums.clear();
    undo.length = 0;
    candidates = false;
    selected = 40;
    resetRating();
    el('walkthrough').hidden = true;
    el('generation-rating').hidden = true;
    el('generation-time').hidden = true;
    el<HTMLTextAreaElement>('data').value = '';
    status('Highlight cells and outside clue positions to build a new puzzle.');
  }
  previousPage = page;
  render();
});
function cancelGeneration() {
  const visiblePuzzle = preview;
  if (!visiblePuzzle) {
    stop();
    status('Generation cancelled before a preview appeared.');
    return;
  }
  save();
  ({grid, clues} = visiblePuzzle);
  resetRating();
  render();
  status('Generation cancelled. The grid and clues shown at cancellation were kept.');
};
el('clue-type').onchange = () => {
  const nextType = el('clue-type').querySelector<HTMLSelectElement>('select')!.value as ClueType;
  if (nextType === clueType) return;
  save();
  clueType = nextType;
  customSums.clear();
  clues = new Array(clueCount(clueType)).fill(null);
  grid = gridFromValues(grid.values);
  resetRating();
  render();
  status('Clue type changed. Previous clues cleared; enter new clues or generate a puzzle. Undo restores the previous puzzle.');
};
el('blank').onclick=()=>{save();grid=gridFromValues(new Array(81).fill(0));clues=new Array(clueCount(clueType)).fill(null);resetRating();render();status('Enter givens and outside clues to build a puzzle.')};
el('clear').onclick=()=>{save();grid=gridFromValues(new Array(81).fill(0));resetRating();render();status('Digits cleared; outside clues retained. Clues alone may allow multiple solutions.')};
el('undo').onclick=()=>{const old=undo.pop();if(old){stop();el('walkthrough').hidden=true;el('generation-rating').hidden=true;({grid,clues,score,history,clueType}=old);pending=null;render();status('Last change undone.')}};
el('notes').onclick=()=>{candidates=!candidates;render()};
el('hint').onclick=()=>run('hint');el('solve').onclick=()=>run('solve');el('cancel').onclick=()=>{stop();status('Calculation cancelled. Your grid is unchanged.')};
document.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach(b=>b.onclick=()=>edit(selected,Number(b.dataset.digit)));
window.addEventListener('keydown',e=>{if(el('board').closest<HTMLElement>('.workspace')?.hidden||document.body.dataset.page==='custom-build'||e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||(e.target instanceof HTMLElement && e.target.closest('.page-menu')))return;if(/^[1-9]$/.test(e.key)){e.preventDefault();edit(selected,Number(e.key))}else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();edit(selected,0)}else if(e.key.startsWith('Arrow')){e.preventDefault();const dr=e.key==='ArrowUp'?-9:e.key==='ArrowDown'?9:e.key==='ArrowLeft'?-1:1;selected=(selected+dr+81)%81;render();el('board').querySelector<HTMLButtonElement>(`[data-cell="${selected}"]`)?.focus()}});
el('export').onclick=()=>{el<HTMLTextAreaElement>('data').value=JSON.stringify({version:1,clueType,values:Array.from(grid.values),clues},null,2);status('Puzzle exported below. Copy the JSON to save it.')};
el('import').onclick=()=>{try{const data=JSON.parse(el<HTMLTextAreaElement>('data').value);const importedType = data.clueType ?? 'sandwich';if(importedType !== 'sandwich' && importedType !== 'edge-difference' && importedType !== 'skyscraper' && importedType !== 'x-sums' && importedType !== 'sum-before-nine')throw Error();if(!Array.isArray(data.values)||data.values.length!==81||!data.values.every((v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=9)||!Array.isArray(data.clues)||data.clues.length!==clueCount(importedType)||!data.clues.every((v:unknown)=>v===null||(Number.isInteger(v)&&Number(v)>=clueMin(importedType)&&Number(v)<=(clueMax(importedType)))))throw Error();save();grid=gridFromValues(data.values);clues=data.clues;clueType=importedType;resetRating();render();status('Puzzle imported. Check its validity with the solver.')}catch{status('Invalid JSON: expected 81 digits (0–9) and 18 clues (sandwich: 0–35; edge difference: 1–8) or 36 Skyscraper (1–9), X-sums (1–45), or Sum before nine (0–36) clues, with null for absent clues, and a valid clueType.')}};
render();

el('copy-string').onclick = async () => status(await copyGridText(grid, clues, clueType));
el('copy-image').onclick = async () => status(await copyGridImage(grid, clues, clueType));
el('walkthrough').addEventListener('walkthroughstepchange', event => {
  const step = (event as CustomEvent<{step: number}>).detail.step;
  el('generation-rating').querySelectorAll('tr').forEach(row => row.classList.remove('active-technique-row'));
  el('generation-rating').querySelectorAll<HTMLButtonElement>('[data-walkthrough-step]').forEach(link => {
    if (Number(link.dataset.walkthroughStep) === step) {
      link.setAttribute('aria-current', 'step');
      link.closest('tr')?.classList.add('active-technique-row');
    }
    else link.removeAttribute('aria-current');
  });
});
mountPages();
