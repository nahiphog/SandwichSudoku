import { type Grid, UNITS, bit, digitsOf, cloneGrid, gridFromValues, isBroken, isSolved, setValue } from './vendor/engine/board';
import { findNextStep, applyStep } from './vendor/engine/humanSolver';
import { TECHS, SOLVE_ORDER } from './vendor/engine/ratings';
import type { CellDigit } from './vendor/engine/steps';

export type Clues = (number | null)[]; // rows first, then columns; null is not zero
export interface Move { name: string; score: number; description: string; placements: CellDigit[]; eliminations: CellDigit[] }
export const RING = Array.from({length:81},(_,i)=>i).filter(i=>{const r=Math.floor(i/9),c=i%9;return r>=2&&r<=6&&c>=2&&c<=6&&(r===2||r===6||c===2||c===6)});
export const CORNERS = Array.from({length:81},(_,i)=>i).filter(i=>{const r=Math.floor(i/9),c=i%9;return (r<2||r>6)&&(c<2||c>6)});
export function sandwichSum(line: number[]): number {
  const a=line.indexOf(1), b=line.indexOf(9);
  if(a<0||b<0) throw new Error('A complete line needs 1 and 9.');
  return line.slice(Math.min(a,b)+1,Math.max(a,b)).reduce((s,d)=>s+d,0);
}
export const cluesFor = (values: ArrayLike<number>): Clues => UNITS.slice(0,18).map(u=>sandwichSum(u.map(i=>values[i])));
const shuffle = <T>(a:T[]):T[] => {for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
/** Randomized backtracking, so generation is not limited to one base-grid pattern. */
export function generate(): Grid {
  function fill(g:Grid):Grid|null {
    let cell=-1, ds:number[]=[];
    for(let i=0;i<81;i++) if(!g.values[i]) {const d=digitsOf(g.cands[i]);if(!d.length)return null;if(cell<0||d.length<ds.length){cell=i;ds=d}}
    if(cell<0)return g;
    for(const d of shuffle(ds)){const next=cloneGrid(g);setValue(next,cell,d);const done=fill(next);if(done)return done}return null;
  }
  return fill(gridFromValues(new Array(81).fill(0)))!;
}
/** Keep each removal only when exact search proves the remaining puzzle unique. */
function digPuzzle(rotational: boolean, digClues: boolean) {
  const solution = generate();
  const clues = cluesFor(solution.values);
  const values = Array.from(solution.values);
  const groups = rotational
    ? Array.from({length: 40}, (_, cell) => [cell, 80 - cell])
    : Array.from(values.keys(), cell => [cell]);
  let fullyDug = true;
  for (const group of shuffle(groups)) {
    for (const cell of group) values[cell] = 0;
    const check = solveExact(gridFromValues(values), clues, 250);
    if (check.exhausted) fullyDug = false;
    if (check.exhausted || check.solutions.length !== 1) {
      for (const cell of group) values[cell] = solution.values[cell];
    }
  }
  const grid = gridFromValues(values);
  if (digClues) {
    let remaining = clues.length;
    for (const index of shuffle(Array.from(clues.keys()))) {
      if (remaining === 1) break;
      const clue = clues[index];
      clues[index] = null;
      const check = solveExact(grid, clues, 250);
      if (check.exhausted) fullyDug = false;
      if (!check.exhausted && check.solutions.length === 1) remaining--;
      else clues[index] = clue;
    }
  }
  return {grid, clues, fullyDug, solution: solution.values};
}

export function rateLogicalPuzzle(input: Grid, clues: Clues) {
  const grid = cloneGrid(input);
  const techniques = new Map<string, number>();
  const moves: Move[] = [];
  let score = 0;
  while (!isSolved(grid)) {
    const move = nextMove(grid, clues);
    if (!move) return null;
    moves.push(move);
    applyMove(grid, move);
    techniques.set(move.name, (techniques.get(move.name) ?? 0) + 1);
    score += move.score;
  }
  validate(grid, clues);
  return {score, techniques: [...techniques], moves};
}

export function generatePuzzle(logicalOnly = false, rotational = true, digClues = false) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const puzzle = digPuzzle(rotational, digClues);
    const rating = rateLogicalPuzzle(puzzle.grid, puzzle.clues);
    if (!logicalOnly || rating) return {...puzzle, rating, solution: rating ? null : puzzle.solution};
  }
  throw new Error('No puzzle with a complete logical solve was found. Try generating again.');
}

/** All compatible permutations of a line; union their candidates for sound eliminations. */
export function lineSupport(g:Grid, cells:number[], clue:number):number[]|null {
  const support=new Array<number>(9).fill(0), line=new Array<number>(9).fill(0);
  let count=0;
  const visit=(p:number,used:number,phase:number,sum:number):void=>{
    if(sum>clue)return;
    if(p===9){if(phase===2&&sum===clue){count++;line.forEach((d,j)=>support[j]|=bit(d))}return}
    const mask=(g.values[cells[p]]?bit(g.values[cells[p]]):g.cands[cells[p]])&~used;
    for(const d of digitsOf(mask)){
      const bread=d===1||d===9;
      const nextPhase=bread?phase+1:phase;
      const nextSum=sum+(!bread&&phase===1?d:0);
      if(nextPhase===2&&nextSum!==clue)continue;
      line[p]=d;visit(p+1,used|bit(d),nextPhase,nextSum);
    }
  };
  visit(0,0,0,0);return count?support:null;
}
export function sandwichMove(g:Grid,clues:Clues):Move|null {
  for(let u=0;u<18;u++){
    if(clues[u]===null)continue;
    const support=lineSupport(g,UNITS[u],clues[u]!);
    if(!support)throw new Error(`${u<9?'Row':'Column'} ${u%9+1} cannot satisfy its sandwich clue.`);
    const eliminations:CellDigit[]=[];
    UNITS[u].forEach((cell,j)=>{if(!g.values[cell])for(const digit of digitsOf(g.cands[cell]&~support[j]))eliminations.push({cell,digit})});
    if(eliminations.length)return {name:'Sandwich sum',score:0,description:`${u<9?'Row':'Column'} ${u%9+1}: every valid arrangement sums to ${clues[u]} between 1 and 9. Remove candidates absent from all those arrangements.`,placements:[],eliminations};
  }return null;
}
/** Conservative per-digit bounds on equal multisets, in both directions. */
export function ringMove(g:Grid):Move|null {
  for(let digit=1;digit<=9;digit++){
    const b=bit(digit);
    const bounds=(cells:number[])=>({fixed:cells.filter(c=>g.values[c]===digit).length,possible:cells.filter(c=>!g.values[c]&&(g.cands[c]&b))});
    const a=bounds(RING),z=bounds(CORNERS);
    const lo=Math.max(a.fixed,z.fixed),hi=Math.min(a.fixed+a.possible.length,z.fixed+z.possible.length);
    if(lo>hi)throw new Error('The Phistomefel digit counts contradict each other.');
    const placements:CellDigit[]=[],eliminations:CellDigit[]=[];
    for(const side of [a,z]){
      if(side.fixed===hi)side.possible.forEach(cell=>eliminations.push({cell,digit}));
      else if(side.fixed+side.possible.length===lo)side.possible.forEach(cell=>placements.push({cell,digit}));
    }
    if(placements.length||eliminations.length)return {name:'Phistomefel Ring',score:200,description:`The ring and corners contain the same number of ${digit}s. Their shared count is between ${lo} and ${hi}; a saturated count removes candidates, and a required count forces the remaining positions.`,placements,eliminations};
  }return null;
}
export const SAFE_ORDER=SOLVE_ORDER.filter(t=>TECHS[t].category!=='Uniqueness');
export function nextMove(g:Grid,clues:Clues):Move|null {
  if(isBroken(g))throw new Error('The grid has conflicting digits or no valid candidates.');
  const sandwich=sandwichMove(g,clues);
  const cheap=findNextStep(g,SAFE_ORDER.filter(t=>TECHS[t].score<200));
  if(cheap)return {...cheap,name:TECHS[cheap.tech].name,score:TECHS[cheap.tech].score};
  if(sandwich)return sandwich;
  const ring=ringMove(g);if(ring)return ring;
  const step=findNextStep(g,SAFE_ORDER);
  return step?{...step,name:TECHS[step.tech].name,score:TECHS[step.tech].score}:null;
}
export function applyMove(g:Grid,m:Move):void {
  // The imported applyStep only consumes these two fields.
  applyStep(g,{...m,tech:'NAKED_SINGLE'});
}
export function validate(g:Grid,clues:Clues):void {
  for(const unit of UNITS){const values=unit.map(c=>g.values[c]).filter(Boolean);if(new Set(values).size!==values.length)throw new Error('Duplicate digits in a row, column, or box.');}
  if(isBroken(g))throw new Error('An empty cell has no possible value.');
  for(let u=0;u<18;u++)if(clues[u]!==null&&!lineSupport(g,UNITS[u],clues[u]!))throw new Error(`${u<9?'Row':'Column'} ${u%9+1} conflicts with its clue.`);
}
/** Exact variant search, capped and explicit about inconclusive searches. */
export function solveExact(start:Grid, clues:Clues, budget=100000):{solutions:Grid[]; exhausted:boolean} {
  const solutions:Grid[]=[];let nodes=0, exhausted=false;
  function search(input:Grid):void {
    if(solutions.length>=2||exhausted)return;
    if(++nodes>budget){exhausted=true;return}
    const g=cloneGrid(input);
    try {
      while(true){if(isBroken(g))return;const s=sandwichMove(g,clues);if(s){applyMove(g,s);continue}const single=findNextStep(g,['FULL_HOUSE','NAKED_SINGLE','HIDDEN_SINGLE']);if(single){applyStep(g,single);continue}break}
      if(isSolved(g)){validate(g,clues);solutions.push(g);return}
    }catch{return}
    let cell=-1,ds:number[]=[];
    for(let i=0;i<81;i++)if(!g.values[i]){const d=digitsOf(g.cands[i]);if(cell<0||d.length<ds.length){cell=i;ds=d}}
    for(const d of ds){const next=cloneGrid(g);setValue(next,cell,d);search(next);if(solutions.length>=2||exhausted)return}
  }
  validate(start,clues);search(start);return {solutions,exhausted};
}
