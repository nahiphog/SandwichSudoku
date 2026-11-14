import {mountPages} from './pages';
import './style.css';
import {gridFromValues,cloneGrid,digitsOf,isSolved,type Grid} from './vendor/engine/board';
import {TECHS} from './vendor/engine/ratings';
import {generate,cluesFor,RING,CORNERS,applyMove,type Clues,type Move} from './sandwich';

let grid=generate(), clues=cluesFor(grid.values), selected=40, ring=false, candidates=false, score=0, history:Move[]=[], pending:Move|null=null;
let worker:Worker|null=null;
const undo:{grid:Grid;clues:Clues;score:number;history:Move[]}[]=[];
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><a class="brand" href="./"><span class="brand-icon">S</span> sandwich<span class="brand-tag">SUDOKU STUDIO</span></a><span class="header-note">A little constraint. A lot of possibility.</span></header>
<main><section class="intro"><div><div class="eyebrow">THE SPACE BETWEEN 1 & 9</div><h1>Good things in between.</h1><p>Create a grid. Follow the sums. Find your next breakthrough.</p></div><div class="generation-actions"><button id="generate">Generate</button><button id="generate-puzzle" class="primary">Generate puzzle</button></div></section>
<div class="workspace"><section class="board-panel"><div class="panel-top"><div><span class="dot"></span><strong id="board-title">Your grid</strong></div><span id="filled"></span></div><div class="board-wrap"><div id="board" role="group" aria-label="Editable sandwich sudoku grid"></div></div><div class="board-tools"><button id="notes" aria-pressed="false">Candidates</button><button id="ring" aria-pressed="false">◈ &nbsp; Phistomefel Ring</button><button id="undo">↶ Undo</button></div><div class="keypad">${Array.from({length:9},(_,i)=>`<button data-digit="${i+1}" aria-label="Enter ${i+1}">${i+1}</button>`).join('')}<button data-digit="0" aria-label="Erase selected cell">⌫</button></div><p class="board-caption">Select a cell to edit · 1–9 to enter · Delete to erase · Arrow keys to move</p></section>
<aside><section class="card rules"><div class="eyebrow">A CLASSIC, WITH A TWIST</div><h2>Meet sandwich sudoku.</h2><p>Normal sudoku rules apply. Clues outside the grid give the sum of digits <strong>between 1 and 9</strong> in that row or column, not including the 1 and 9 themselves.</p><div class="example"><span>1</span><b>3</b><b>5</b><b>2</b><span>9</span><em> = 10</em></div><small>Only the filling counts. Adjacent 1 and 9 give 0.</small></section>
<section class="card"><div class="card-heading"><h2>Solving desk</h2><span class="badge"><b id="score">0</b> points</span></div><p id="status" role="status" aria-live="polite">A complete grid, fresh from the maker. Erase digits to shape your puzzle, or start blank.</p><div class="actions"><button id="hint" class="primary">Find next step →</button><button id="solve">Solve & check uniqueness</button><button id="cancel" hidden>Cancel calculation</button></div><div id="hint-detail"></div><div class="minor-actions"><button id="blank">Blank grid</button><button id="clear">Clear digits, keep clues</button></div></section>
<section class="card ring-card"><div class="card-heading"><h2>Phistomefel Ring</h2><span class="badge">+200 / use</span></div><p>The <span class="teal-text">16 ring cells</span> and <span class="orange-text">16 corner cells</span> contain identical digit counts.</p><div id="tally"></div><small>The solver compares both sets to force digits or remove candidates. Viewing the ring adds no points.</small></section></aside></div>
<section class="lower"><details class="card"><summary>Solving history <span id="step-count">0 steps</span></summary><ol id="history"></ol></details><details class="card"><summary>Technique library <span>${Object.keys(TECHS).length} imported + 2 variant techniques</span></summary><p>Imported from <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">sudokUI</a>. Original ratings are preserved. Classic uniqueness deductions are disabled for sandwich puzzles; the extra clues can break their assumptions. Upstream roadmap entries remain labelled.</p><div class="tech-list"><div><strong>Phistomefel Ring</strong><span>200 · Active</span></div><div><strong>Sandwich sum</strong><span>0 · Active</span></div>${Object.entries(TECHS).map(([,t])=>`<div><strong>${t.name}</strong><span>${t.score} · ${!t.implemented?'Upstream roadmap':t.category==='Uniqueness'?'Classic only':!t.enabled?'Imported · redundant':t.name==='Brute Force'?'Exact search':'Active'}</span></div>`).join('')}</div></details><details class="card"><summary>Import / export <span>Save your construction</span></summary><p>JSON stores all 81 digits and 18 clues (rows, then columns). Use null for an absent clue.</p><textarea id="data" aria-label="Puzzle JSON" placeholder="Paste exported puzzle JSON"></textarea><div class="minor-actions"><button id="export">Export</button><button id="import">Import</button></div></details></section>
</main><footer>Made for curious minds. <span>TypeScript · sudokUI engine · GPL-3.0</span></footer>`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
function status(s:string){el('status').textContent=s}
function stop(){worker?.terminate();worker=null;el<HTMLButtonElement>('generate-puzzle').disabled=false;el('cancel').hidden=true;el<HTMLButtonElement>('hint').disabled=false;el<HTMLButtonElement>('solve').disabled=false;}
function save(){stop();undo.push({grid:cloneGrid(grid),clues:[...clues],score,history:[...history]});pending=null;}
function resetRating(){score=0;history=[];pending=null}
function edit(cell:number,digit:number){save();const values=Array.from(grid.values);values[cell]=digit;grid=gridFromValues(values);resetRating();render();status('Grid updated. Find a logical step or check its solutions.');}
function render(){
  const board=el('board');board.replaceChildren();
  const corner=document.createElement('div');corner.className='clue-label';corner.textContent='SUM';board.append(corner);
  function clueInput(u:number){const input=document.createElement('input');input.className='clue';input.type='text';input.inputMode='numeric';input.maxLength=2;input.value=clues[u]===null?'':String(clues[u]);input.placeholder='·';input.setAttribute('aria-label',`${u<9?'Row':'Column'} ${u%9+1} sandwich clue`);input.onchange=()=>{const raw=input.value.trim(),v=raw===''?null:Number(raw);if(v!==null&&(!/^\d+$/.test(raw)||!Number.isInteger(v)||v<0||v>35)){status('Clues must be whole numbers from 0 to 35, or blank.');render();return}save();clues[u]=v;grid=gridFromValues(grid.values);resetRating();render();status('Clue updated.');};return input}
  for(let c=0;c<9;c++)board.append(clueInput(9+c));
  for(let r=0;r<9;r++){board.append(clueInput(r));for(let c=0;c<9;c++){
    const i=r*9+c,b=document.createElement('button');b.className='cell';b.dataset.cell=String(i);
    if(c%3===0)b.classList.add('box-left');if(r%3===0)b.classList.add('box-top');if(c===8)b.classList.add('edge-right');if(r===8)b.classList.add('edge-bottom');
    if(ring&&RING.includes(i))b.classList.add('ring-cell');if(ring&&CORNERS.includes(i))b.classList.add('corner-cell');if(i===selected)b.classList.add('selected');
    if(pending?.placements.some(x=>x.cell===i)||pending?.eliminations.some(x=>x.cell===i))b.classList.add('deduction');
    b.setAttribute('aria-label',`Row ${r+1}, column ${c+1}, ${grid.values[i]||'empty'}`);b.setAttribute('aria-pressed',String(i===selected));
    if(grid.values[i])b.textContent=String(grid.values[i]);else if(candidates)b.innerHTML=`<span class="pencils">${Array.from({length:9},(_,d)=>`<span>${digitsOf(grid.cands[i]).includes(d+1)?d+1:''}</span>`).join('')}</span>`;
    b.onclick=()=>{selected=i;render();el('board').querySelector<HTMLButtonElement>(`[data-cell="${i}"]`)?.focus()};board.append(b);
  }}
  el('filled').textContent=`${grid.values.filter(Boolean).length} / 81 filled`;el('score').textContent=String(score);el('step-count').textContent=`${history.length} steps`;
  el('notes').setAttribute('aria-pressed',String(candidates));el('ring').setAttribute('aria-pressed',String(ring));
  el('history').replaceChildren(...history.map(m=>{const li=document.createElement('li');li.textContent=`${m.name} (+${m.score}) — ${m.description}`;return li}));
  el('tally').innerHTML=`<div class="tally-row"><span>Digit</span>${Array.from({length:9},(_,d)=>`<b>${d+1}</b>`).join('')}</div>${[RING,CORNERS].map((cells,j)=>`<div class="tally-row ${j?'orange-text':'teal-text'}"><span>${j?'Corners':'Ring'}</span>${Array.from({length:9},(_,d)=>`<b>${cells.filter(i=>grid.values[i]===d+1).length}</b>`).join('')}</div>`).join('')}<small>Counts show placed digits.</small>`;
  el('hint-detail').replaceChildren();if(pending){const p=document.createElement('p');p.textContent=`${pending.name} (+${pending.score}): ${pending.description}`;const b=document.createElement('button');b.textContent='Apply this step';b.className='primary';b.onclick=()=>{const move=pending!;save();applyMove(grid,move);history.push(move);score+=move.score;render();status(isSolved(grid)?'Grid filled. Use Solve & check uniqueness to verify.':'Step applied. Find the next deduction when ready.');};el('hint-detail').append(p,b)}
}
function run(action:'hint'|'solve'){
  stop();pending=null;render();status(action==='hint'?'Looking for a logical deduction…':'Searching for solutions that satisfy every sandwich clue…');
  el<HTMLButtonElement>('hint').disabled=true;el<HTMLButtonElement>('solve').disabled=true;el('cancel').hidden=false;
  worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{stop();if(data.error){status(data.error);return}if(action==='hint'){pending=data.result;render();status(pending?'A deduction is ready. Highlighted cells will change when you apply it.':isSolved(grid)?'This completed grid satisfies all Sudoku and sandwich rules.':'No logical step found. Exact search can check this position.');}else{const {solutions,exhausted}=data.result;if(solutions.length){save();grid=solutions[0];resetRating();render();status(solutions.length>1?'Multiple solutions found. Showing one; add more givens or clues to make the puzzle unique.':exhausted?'One solution found; search limit reached, so uniqueness is unknown.':'Exactly one solution found. All Sudoku and sandwich constraints are satisfied.')}else status(exhausted?'Search limit reached. No conclusion yet; add more givens or clues.':'No solution satisfies this grid and its clues.')}};
  worker.onerror=()=>{stop();status('Calculation failed. Your puzzle is unchanged; please try again.')};worker.postMessage({action,grid,clues});
}
el('generate').onclick=()=>{save();grid=generate();clues=cluesFor(grid.values);resetRating();render();status('Generated a complete valid Sudoku with 9 column clues above and 9 row clues on the left.')};
el('generate-puzzle').onclick = () => {
  stop();
  el<HTMLButtonElement>('generate-puzzle').disabled = true;
  el<HTMLButtonElement>('hint').disabled = true;
  el<HTMLButtonElement>('solve').disabled = true;
  el('cancel').hidden = false;
  status('Removing digits and checking uniqueness with all 18 clues…');
  worker = new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'});
  worker.onmessage = ({data}) => {
    stop();
    if (data.error) { status(data.error); return; }
    save();
    ({grid, clues} = data.result);
    resetRating();
    render();
    status('Generated a puzzle with exactly one solution and all 18 sandwich clues.');
  };
  worker.onerror = () => {
    stop();
    status('Puzzle generation failed. Please try again.');
  };
  worker.postMessage({action: 'generate-puzzle'});
};
el('blank').onclick=()=>{save();grid=gridFromValues(new Array(81).fill(0));clues=new Array(18).fill(null);resetRating();render();status('Enter givens and outside clues to build a sandwich puzzle.')};
el('clear').onclick=()=>{save();grid=gridFromValues(new Array(81).fill(0));resetRating();render();status('Digits cleared; sandwich clues retained. Clues alone may allow multiple solutions.')};
el('undo').onclick=()=>{const old=undo.pop();if(old){stop();({grid,clues,score,history}=old);pending=null;render();status('Last change undone.')}};
el('notes').onclick=()=>{candidates=!candidates;render()};el('ring').onclick=()=>{ring=!ring;render()};
el('hint').onclick=()=>run('hint');el('solve').onclick=()=>run('solve');el('cancel').onclick=()=>{stop();status('Calculation cancelled. Your grid is unchanged.')};
document.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach(b=>b.onclick=()=>edit(selected,Number(b.dataset.digit)));
window.addEventListener('keydown',e=>{if(el('board').closest<HTMLElement>('.workspace')?.hidden||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||(e.target instanceof HTMLElement && e.target.closest('.page-menu')))return;if(/^[1-9]$/.test(e.key)){e.preventDefault();edit(selected,Number(e.key))}else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();edit(selected,0)}else if(e.key.startsWith('Arrow')){e.preventDefault();const dr=e.key==='ArrowUp'?-9:e.key==='ArrowDown'?9:e.key==='ArrowLeft'?-1:1;selected=(selected+dr+81)%81;render();el('board').querySelector<HTMLButtonElement>(`[data-cell="${selected}"]`)?.focus()}});
el('export').onclick=()=>{el<HTMLTextAreaElement>('data').value=JSON.stringify({version:1,values:Array.from(grid.values),clues},null,2);status('Puzzle exported below. Copy the JSON to save it.')};
el('import').onclick=()=>{try{const data=JSON.parse(el<HTMLTextAreaElement>('data').value);if(!Array.isArray(data.values)||data.values.length!==81||!data.values.every((v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=9)||!Array.isArray(data.clues)||data.clues.length!==18||!data.clues.every((v:unknown)=>v===null||(Number.isInteger(v)&&Number(v)>=0&&Number(v)<=35)))throw Error();save();grid=gridFromValues(data.values);clues=data.clues;resetRating();render();status('Puzzle imported. Check its validity with the solver.')}catch{status('Invalid JSON: expected 81 digits (0–9) and 18 clues (0–35 or null).')}};
render();

mountPages();
