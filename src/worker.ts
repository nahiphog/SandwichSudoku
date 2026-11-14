import {nextMove,solveExact,validate} from './sandwich';
self.onmessage=({data})=>{try{validate(data.grid,data.clues);const result=data.action==='hint'?nextMove(data.grid,data.clues):solveExact(data.grid,data.clues);self.postMessage({result})}catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)})}};
