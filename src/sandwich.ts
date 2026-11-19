import { type Grid, UNITS, bit, digitsOf, cloneGrid, gridFromValues, isBroken, isSolved, setValue } from './vendor/engine/board';
import { findNextStep, applyStep } from './vendor/engine/humanSolver';
import { TECHS } from './vendor/engine/ratings';
import { LOGICAL_ORDER } from './techniques';
import type { CellDigit } from './vendor/engine/steps';

export type ClueType = "sandwich" | "edge-difference" | "skyscraper" | "x-sums" | "sum-before-nine";
export type Clues = (number | null)[]; // Left rows, top columns; Four-sided variants add right rows, bottom columns.
export interface Move {
  name: string;
  score: number;
  description: string;
  placements: CellDigit[];
  eliminations: CellDigit[];
  primary?: CellDigit[];
  secondary?: CellDigit[];
  fins?: CellDigit[];
  /** Outside clue index: left 0–8, top 9–17, right 18–26, bottom 27–35. */
  sandwichUnit?: number;
}
export const RING = Array.from({length:81},(_,i)=>i).filter(i=>{const r=Math.floor(i/9),c=i%9;return r>=2&&r<=6&&c>=2&&c<=6&&(r===2||r===6||c===2||c===6)});
export const CORNERS = Array.from({length:81},(_,i)=>i).filter(i=>{const r=Math.floor(i/9),c=i%9;return (r<2||r>6)&&(c<2||c>6)});
export function sandwichSum(line: number[]): number {
  const a=line.indexOf(1), b=line.indexOf(9);
  if(a<0||b<0) throw new Error('A complete line needs 1 and 9.');
  return line.slice(Math.min(a,b)+1,Math.max(a,b)).reduce((s,d)=>s+d,0);
}
export const edgeDifference = (line: number[]): number => Math.abs(line[0] - line[8]);
export const fourSided = (type: ClueType): boolean => type === 'skyscraper' || type === 'x-sums' || type === 'sum-before-nine';
export const clueCount = (type: ClueType): number => fourSided(type) ? 36 : 18;
export const clueMin = (type: ClueType): number => type === 'sandwich' || type === 'sum-before-nine' ? 0 : 1;
export const clueMax = (type: ClueType): number => ({sandwich: 35, 'edge-difference': 8, skyscraper: 9, 'x-sums': 45, 'sum-before-nine': 36})[type];
export const clueLabel = (type: ClueType): string => type === 'sum-before-nine' ? 'PRE-9' : type === 'x-sums' ? 'X-SUM' : type === 'sandwich' ? 'SUM' : type === 'skyscraper' ? 'VIEW' : 'DIFF';
export const clueName = (type: ClueType): string => type === 'sum-before-nine' ? 'Sum before nine' : type === 'x-sums' ? 'X-sums' : type === 'sandwich' ? 'Sandwich sum' : type === 'skyscraper' ? 'Skyscraper' : 'Edge difference';
export const clueCells = (index: number): number[] => index < 18 ? UNITS[index] : [...UNITS[index - 18]].reverse();
export const cluePosition = (index: number): string => `${index % 18 < 9 ? 'Row' : 'Column'} ${index % 9 + 1} (${['left', 'top', 'right', 'bottom'][Math.floor(index / 9)]})`;
export function visibleBuildings(line: number[]): number {
  let tallest = 0, visible = 0;
  for (const height of line) if (height > tallest) { tallest = height; visible++; }
  return visible;
}
export const xSum = (line: number[]): number => line.slice(0, line[0]).reduce((sum, digit) => sum + digit, 0);
export function sumBeforeNine(line: number[]): number {
  const end = line.indexOf(9);
  if (end < 0) throw new Error('A complete line needs 9.');
  return line.slice(0, end).reduce((sum, digit) => sum + digit, 0);
}
export const cluesFor = (values: ArrayLike<number>, clueType: ClueType = 'sandwich'): Clues =>
  Array.from({length: clueCount(clueType)}, (_, index) =>
    (clueType === 'sum-before-nine' ? sumBeforeNine : clueType === 'x-sums' ? xSum : clueType === 'skyscraper' ? visibleBuildings : clueType === 'edge-difference' ? edgeDifference : sandwichSum)(clueCells(index).map(i => values[i])));
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
export type SumDigMode = "none" | "single" | "pairs";
type DigProgress = (values: number[], clues: Clues, phase: "start" | "digits" | "clues" | "rating") => void;
function digPuzzle(logicalOnly: boolean, rotational: boolean, digClues: boolean | SumDigMode, progress?: DigProgress, clueType: ClueType = 'sandwich') {
  const solution = generate();
  const clues = cluesFor(solution.values, clueType);
  const values = Array.from(solution.values);
  const groups = rotational
    ? Array.from({length: 40}, (_, cell) => [cell, 80 - cell])
    : Array.from(values.keys(), cell => [cell]);
  progress?.(values, clues, "start");
  let fullyDug = true;
  let rating = logicalOnly ? rateLogicalPuzzle(solution, clues, clueType) : null;
  function canRemove(candidate: Grid): boolean {
    const check = solveExact(candidate, clues, 250, clueType);
    if (check.exhausted) fullyDug = false;
    if (check.exhausted || check.solutions.length !== 1) return false;
    if (logicalOnly) {
      const candidateRating = rateLogicalPuzzle(candidate, clues, clueType);
      if (!candidateRating) return false;
      rating = candidateRating;
    }
    return true;
  }
  for (const group of shuffle(groups)) {
    for (const cell of group) values[cell] = 0;
    if (!canRemove(gridFromValues(values))) {
      for (const cell of group) values[cell] = solution.values[cell];
    } else {
      progress?.(values, clues, "digits");
    }
  }
  const grid = gridFromValues(values);
  if (digClues && digClues !== 'none') {
    let remaining = clues.length;
    const groups = digClues === 'pairs'
      ? Array.from({length: clues.length / 9}, (_, side) =>
          [0, 1, 2, 3].map(offset => [side * 9 + offset, side * 9 + 8 - offset])).flat()
      : Array.from(clues.keys(), index => [index]);
    for (const group of shuffle(groups)) {
      if (remaining - group.length < 1) continue;
      const originals = group.map(index => clues[index]);
      for (const index of group) clues[index] = null;
      if (canRemove(grid)) {
        remaining -= group.length;
        progress?.(values, clues, "clues");
      } else group.forEach((index, offset) => { clues[index] = originals[offset]; });
    }
  }
  return {grid, clues, fullyDug, rating, solution: solution.values};
}

export function rateLogicalPuzzle(input: Grid, clues: Clues, clueType: ClueType = 'sandwich') {
  const grid = cloneGrid(input);
  const techniques = new Map<string, number>();
  const moves: Move[] = [];
  let score = 0;
  while (!isSolved(grid)) {
    const move = nextMove(grid, clues, clueType);
    if (!move) return null;
    moves.push(move);
    applyMove(grid, move);
    techniques.set(move.name, (techniques.get(move.name) ?? 0) + 1);
    score += move.score;
  }
  validate(grid, clues, clueType);
  const weights = new Map(moves.map(move => [move.name, move.score]));
  const sortedTechniques = [...techniques].sort(([a], [b]) =>
    weights.get(a)! - weights.get(b)! || a.localeCompare(b));
  return {score, techniques: sortedTechniques, moves};
}

export function generatePuzzle(logicalOnly = false, rotational = true, digClues: boolean | SumDigMode = false, progress?: DigProgress, clueType: ClueType = 'sandwich') {
  const puzzle = digPuzzle(logicalOnly, rotational, digClues, progress, clueType);
  progress?.(Array.from(puzzle.grid.values), puzzle.clues, "rating");
  const rating = puzzle.rating ?? rateLogicalPuzzle(puzzle.grid, puzzle.clues, clueType);
  return {...puzzle, rating, solution: rating ? null : puzzle.solution};
}

/** All compatible permutations of a line; union their candidates for sound eliminations. */
export function lineSupport(g:Grid, cells:number[], clue:number, clueType: ClueType = 'sandwich'):number[]|null {
  if (clueType === 'edge-difference') return edgeSupport(g, cells, clue);
  if (clueType === 'skyscraper') return skyscraperSupport(g, cells, clue);
  if (clueType === 'x-sums') return xSumSupport(g, cells, clue);
  if (clueType === 'sum-before-nine') return sumBeforeNineSupport(g, cells, clue);
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
/** Memoized permutations enforce endpoint differences and distinct digits. */
function edgeSupport(g: Grid, cells: number[], clue: number): number[] | null {
  if (!Number.isInteger(clue) || clue < 1 || clue > 8) return null;
  const masks = cells.map(cell => g.values[cell] ? bit(g.values[cell]) : g.cands[cell]);
  const support = new Array<number>(9).fill(0);
  const memo = new Map<number, boolean>();
  function visit(p: number, used: number, first: number): boolean {
    if (p === 9) return true;
    const key = (first * 10 + p) * 1024 + used;
    if (memo.has(key)) return memo.get(key)!;
    let valid = false;
    for (const digit of digitsOf(masks[p] & ~used)) {
      if (p === 8 && Math.abs(first - digit) !== clue) continue;
      if (p === 0 && !digitsOf(masks[8]).some(last => Math.abs(digit - last) === clue)) continue;
      if (visit(p + 1, used | bit(digit), p === 0 ? digit : first)) {
        support[p] |= bit(digit);
        valid = true;
      }
    }
    memo.set(key, valid);
    return valid;
  }
  return visit(0, 0, 0) ? support : null;
}
/** Union of candidates across all compatible visible-building permutations. */
function skyscraperSupport(g: Grid, cells: number[], clue: number): number[] | null {
  if (!Number.isInteger(clue) || clue < 1 || clue > 9) return null;
  const masks = cells.map(cell => g.values[cell] ? bit(g.values[cell]) : g.cands[cell]);
  const support = new Array<number>(9).fill(0);
  const memo = new Map<number, boolean>();
  function visit(p: number, used: number, tallest: number, visible: number): boolean {
    if (visible > clue || visible + 9 - tallest < clue) return false;
    if (p === 9) return visible === clue;
    const key = used * 100 + tallest * 10 + visible;
    if (memo.has(key)) return memo.get(key)!;
    let valid = false;
    for (const digit of digitsOf(masks[p] & ~used)) {
      if (visit(p + 1, used | bit(digit), Math.max(tallest, digit), visible + Number(digit > tallest))) {
        support[p] |= bit(digit);
        valid = true;
      }
    }
    memo.set(key, valid);
    return valid;
  }
  return visit(0, 0, 0, 0) ? support : null;
}
/** The first digit sets the prefix length; the rest of the line must still be completable. */
function xSumSupport(g: Grid, cells: number[], clue: number): number[] | null {
  if (!Number.isInteger(clue) || clue < 1 || clue > 45) return null;
  const masks = cells.map(cell => g.values[cell] ? bit(g.values[cell]) : g.cands[cell]);
  const support = new Array<number>(9).fill(0);
  const memo = new Map<number, boolean>();
  function visit(p: number, used: number, first: number, sum: number): boolean {
    if (sum > clue || (p > 0 && p >= first && sum !== clue)) return false;
    if (p === 9) return true;
    // Position follows from the used digits; first and sum describe the prefix constraint.
    const key = (first * 46 + sum) * 1024 + used;
    if (memo.has(key)) return memo.get(key)!;
    let valid = false;
    for (const digit of digitsOf(masks[p] & ~used)) {
      const length = p === 0 ? digit : first;
      if (visit(p + 1, used | bit(digit), length, sum + (p < length ? digit : 0))) {
        support[p] |= bit(digit);
        valid = true;
      }
    }
    memo.set(key, valid);
    return valid;
  }
  return visit(0, 0, 0, 0) ? support : null;
}
/** Stop summing at 9, while enforcing distinct digits throughout the entire line. */
function sumBeforeNineSupport(g: Grid, cells: number[], clue: number): number[] | null {
  if (!Number.isInteger(clue) || clue < 0 || clue > 36) return null;
  const masks = cells.map(cell => g.values[cell] ? bit(g.values[cell]) : g.cands[cell]);
  const support = new Array<number>(9).fill(0);
  const memo = new Map<number, boolean>();
  function visit(p: number, used: number, sum: number): boolean {
    const passedNine = Boolean(used & bit(9));
    if (sum > clue || (passedNine && sum !== clue)) return false;
    if (p === 9) return sum === clue;
    // The used-digit mask also determines position and whether 9 has been passed.
    const key = sum * 1024 + used;
    if (memo.has(key)) return memo.get(key)!;
    let valid = false;
    for (const digit of digitsOf(masks[p] & ~used)) {
      if (visit(p + 1, used | bit(digit), sum + (!passedNine && digit !== 9 ? digit : 0))) {
        support[p] |= bit(digit);
        valid = true;
      }
    }
    memo.set(key, valid);
    return valid;
  }
  return visit(0, 0, 0) ? support : null;
}
export function sandwichMove(g:Grid,clues:Clues, clueType: ClueType = 'sandwich'):Move|null {
  for(let u=0;u<clueCount(clueType);u++){
    if(clues[u]==null)continue;
    const support=lineSupport(g,clueCells(u),clues[u]!,clueType);
    if(!support)throw new Error(`${cluePosition(u)} cannot satisfy its ${clueName(clueType)} clue.`);
    const eliminations:CellDigit[]=[];
    clueCells(u).forEach((cell,j)=>{if(!g.values[cell])for(const digit of digitsOf(g.cands[cell]&~support[j]))eliminations.push({cell,digit})});
    if(eliminations.length)return {sandwichUnit: u, primary: clueCells(u).flatMap(cell => (g.values[cell] ? [g.values[cell]] : digitsOf(g.cands[cell])).map(digit => ({cell, digit}))),name:clueName(clueType),score:5,description:`${cluePosition(u)}: ${clueType === 'sandwich' ? `every valid arrangement sums to ${clues[u]} between 1 and 9` : clueType === 'sum-before-nine' ? `the digits before 9 sum to ${clues[u]} when viewed from this direction, excluding the 9` : clueType === 'x-sums' ? `the first X digits sum to ${clues[u]}, where X is the first digit viewed from this direction` : clueType === 'skyscraper' ? `every valid arrangement shows ${clues[u]} buildings from this direction` : `every valid arrangement has an absolute difference of ${clues[u]} between the two end cells`}. Remove candidates absent from all those arrangements.`,placements:[],eliminations};
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
    if(placements.length||eliminations.length)return {primary: RING.flatMap(cell => (g.values[cell] ? [g.values[cell]] : digitsOf(g.cands[cell])).map(digit => ({cell, digit}))), secondary: CORNERS.flatMap(cell => (g.values[cell] ? [g.values[cell]] : digitsOf(g.cands[cell])).map(digit => ({cell, digit}))),name:'Phistomefel Ring',score:200,description:`The ring and corners contain the same number of ${digit}s. Their shared count is between ${lo} and ${hi}; a saturated count removes candidates, and a required count forces the remaining positions.`,placements,eliminations};
  }return null;
}
export const SAFE_ORDER = LOGICAL_ORDER;
export function nextMove(g:Grid,clues:Clues, clueType: ClueType = 'sandwich'):Move|null {
  if(isBroken(g))throw new Error('The grid has conflicting digits or no valid candidates.');
  const sandwich=sandwichMove(g,clues,clueType);
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
export function validate(g:Grid,clues:Clues, clueType: ClueType = 'sandwich'):void {
  for(const unit of UNITS){const values=unit.map(c=>g.values[c]).filter(Boolean);if(new Set(values).size!==values.length)throw new Error('Duplicate digits in a row, column, or box.');}
  if(isBroken(g))throw new Error('An empty cell has no possible value.');
  for(let u=0;u<clueCount(clueType);u++)if(clues[u]!=null&&!lineSupport(g,clueCells(u),clues[u]!,clueType))throw new Error(`${cluePosition(u)} conflicts with its clue.`);
}
/** Exact variant search, capped and explicit about inconclusive searches. */
export function solveExact(start:Grid, clues:Clues, budget=100000, clueType: ClueType = 'sandwich'):{solutions:Grid[]; exhausted:boolean} {
  const solutions:Grid[]=[];let nodes=0, exhausted=false;
  function search(input:Grid):void {
    if(solutions.length>=2||exhausted)return;
    if(++nodes>budget){exhausted=true;return}
    const g=cloneGrid(input);
    try {
      while(true){if(isBroken(g))return;const s=sandwichMove(g,clues,clueType);if(s){applyMove(g,s);continue}const single=findNextStep(g,['FULL_HOUSE','NAKED_SINGLE','HIDDEN_SINGLE']);if(single){applyStep(g,single);continue}break}
      if(isSolved(g)){validate(g,clues,clueType);solutions.push(g);return}
    }catch{return}
    let cell=-1,ds:number[]=[];
    for(let i=0;i<81;i++)if(!g.values[i]){const d=digitsOf(g.cands[i]);if(cell<0||d.length<ds.length){cell=i;ds=d}}
    for(const d of ds){const next=cloneGrid(g);setValue(next,cell,d);search(next);if(solutions.length>=2||exhausted)return}
  }
  validate(start,clues,clueType);search(start);return {solutions,exhausted};
}

export function buildCustomPuzzle(cells: number[], sums: number[], clueType: ClueType = 'sandwich') {
  if (!sums.length) throw new Error('Highlight at least one outside clue.');
  for (let attempt = 0; attempt < 100; attempt++) {
    const solution = generate();
    const allClues = cluesFor(solution.values, clueType);
    const values = Array.from(solution.values, (digit, cell) => cells.includes(cell) ? digit : 0);
    const clues = allClues.map((clue, index) => sums.includes(index) ? clue : null);
    const grid = gridFromValues(values);
    const check = solveExact(grid, clues, 250, clueType);
    if (!check.exhausted && check.solutions.length === 1) {
      const rating = rateLogicalPuzzle(grid, clues, clueType);
      return {grid, clues, rating, solution: rating ? null : solution.values, fullyDug: false};
    }
  }
  throw new Error('No unique puzzle found using only these highlighted positions. Highlight more cells or clues and try again.');
}
