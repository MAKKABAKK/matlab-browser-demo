import { runMarginal } from './marginal-compute.js';
import { validateMarginalParameters, validateMarginalResult } from './marginal-model.js';
self.onmessage=({data})=>{
  if(data.type!=='run') return;
  const send=(type,extra={})=>self.postMessage({type,id:data.id,...extra});
  try {
    const params=validateMarginalParameters(data.params), start=performance.now();
    const values=runMarginal(params,undefined,(iteration,total)=>send('progress',{iteration,total}));
    send('result',{values:validateMarginalResult(values,params),durationMs:performance.now()-start});
  } catch(error) {send('error',{message:error.message||String(error)});}
};
