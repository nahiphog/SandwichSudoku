import {describe,it,expect} from 'vitest';
import {UNITS,emptyGrid,gridFromValues,bit,cloneGrid} from '../src/vendor/engine/board';
import {generate,cluesFor,sandwichSum,lineSupport,ringMove,RING,CORNERS,solveExact,applyMove,nextMove,SAFE_ORDER} from '../src/sandwich';
import {TECHS} from '../src/vendor/engine/ratings';

describe('generator and sandwich clues',()=>{
  it('generates valid diverse grids, with all 18 clues and equal ring multisets',()=>{
    const seen=new Set<string>();
    for(let n=0;n<30;n++){
      const g=generate();seen.add([...g.values].join(''));
      for(const unit of UNITS)expect(new Set(unit.map(i=>g.values[i])).size).toBe(9);
      expect(cluesFor(g.values)).toHaveLength(18);
      expect(RING.map(i=>g.values[i]).sort()).toEqual(CORNERS.map(i=>g.values[i]).sort());
      for(let u=0;u<18;u++){
        const line=UNITS[u].map(i=>g.values[i]);const a=line.indexOf(1),b=line.indexOf(9);
        expect(cluesFor(g.values)[u]).toBe(line.filter((_,i)=>i>Math.min(a,b)&&i<Math.max(a,b)).reduce((s,d)=>s+d,0));
      }
    }
    expect(seen.size).toBe(30);
  });
  it('handles both orders, adjacent bread, and maximum filling',()=>{
    expect(sandwichSum([2,1,9,3,4,5,6,7,8])).toBe(0);
    expect(sandwichSum([9,2,3,4,5,6,7,8,1])).toBe(35);
    expect(sandwichSum([2,9,3,5,1,4,6,7,8])).toBe(8);
  });
  it('keeps every known solution candidate under line filtering',()=>{
    const full=generate(),g=cloneGrid(full);for(let i=0;i<81;i++)if(i%3)g.values[i]=0;
    const partial=gridFromValues(g.values),clues=cluesFor(full.values);
    for(let u=0;u<18;u++){const support=lineSupport(partial,UNITS[u],clues[u]!);expect(support).not.toBeNull();UNITS[u].forEach((c,j)=>expect(support![j]&bit(full.values[c])).not.toBe(0))}
  });
});
describe('Phistomefel deductions',()=>{
  it('uses exactly the specified 16-cell sets',()=>{expect(RING).toEqual([20,21,22,23,24,29,33,38,42,47,51,56,57,58,59,60]);expect(CORNERS).toEqual([0,1,7,8,9,10,16,17,63,64,70,71,72,73,79,80]);});
  it('eliminates a digit absent from the opposite set and scores once',()=>{
    const g=emptyGrid();for(const c of RING)g.cands[c]&=~bit(2);
    const move=ringMove(g)!;expect(move.name).toBe('Phistomefel Ring');expect(move.score).toBe(200);
    expect(move.eliminations).toEqual(CORNERS.map(cell=>({cell,digit:2})));applyMove(g,move);expect(ringMove(g)).toBeNull();
  });
  it('forces matching multiplicities in both directions',()=>{
    for(const [source,target] of [[RING,CORNERS],[CORNERS,RING]]){
      const g=emptyGrid();for(const c of source.slice(0,3)){g.values[c]=2;g.cands[c]=0}
      for(const c of target.slice(3))g.cands[c]&=~bit(2);
      const step=ringMove(g)!;expect(step.placements).toEqual(target.slice(0,3).map(cell=>({cell,digit:2})));expect(step.score).toBe(200);
    }
  });
  it('does not charge points just for a satisfied ring',()=>expect(ringMove(generate())).toBeNull());
});
describe('variant solver',()=>{
  it('solves a partial grid and establishes uniqueness',()=>{
    const full=generate(),values=[...full.values];for(let i=0;i<81;i+=4)values[i]=0;
    const result=solveExact(gridFromValues(values),cluesFor(full.values));expect(result.exhausted).toBe(false);expect(result.solutions).toHaveLength(1);expect(result.solutions[0].values).toEqual(full.values);
  });
  it('detects ambiguity without pretending a generated clue set is unique',()=>{const result=solveExact(emptyGrid(),new Array(18).fill(null));expect(result.solutions).toHaveLength(2)});
  it('rejects duplicate givens and incorrect sandwich clues',()=>{
    const full=generate(),clues=cluesFor(full.values);clues[0]=(clues[0]!+1)%36;
    expect(()=>solveExact(full,clues)).toThrow();
    const values=[...full.values];values[0]=values[1];expect(()=>solveExact(gridFromValues(values),new Array(18).fill(null))).toThrow();
  });
  it('distinguishes a zero clue from a missing clue',()=>{const full=generate();const line=[1,9,2,3,4,5,6,7,8];const g=gridFromValues([...line,...new Array(72).fill(0)]);expect(lineSupport(g,UNITS[0],0)).not.toBeNull();expect(lineSupport(g,UNITS[0],1)).toBeNull();expect(cluesFor(full.values).every(c=>c!==null)).toBe(true)});
  it('uses imported steps and excludes classic uniqueness assumptions',()=>{
    const full=generate(),values=[...full.values];values[0]=0;const move=nextMove(gridFromValues(values),cluesFor(full.values));expect(move?.placements).toContainEqual({cell:0,digit:full.values[0]});expect(SAFE_ORDER.every(t=>TECHS[t].category!=='Uniqueness')).toBe(true);
  });
  it('reports an inconclusive budget limit',()=>expect(solveExact(emptyGrid(),new Array(18).fill(null),0).exhausted).toBe(true));
});
