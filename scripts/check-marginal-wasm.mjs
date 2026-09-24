import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {initRunMat,createInMemoryFsProvider,subscribeStdout,unsubscribeStdout} from 'runmat';
import {validateMarginalResult} from '../web/js/marginal-model.js';
const root=new URL('../',import.meta.url);
const wasmModule=await WebAssembly.compile(await readFile(new URL('node_modules/runmat/dist/pkg-web/runmat_wasm_web_bg.wasm',root)));
const original=await readFile(new URL('matlab/Marginal_FullCollapsed_browser.m',root),'utf8');
const fixture=JSON.parse(await readFile(new URL('tests/fixtures/marginal-reference.json',root),'utf8'));
const reports=[];
for(const [i,c] of fixture.cases.entries()){
  const fsProvider=createInMemoryFsProvider();
  const uniform=c.draws.filter(r=>r[0]===1),normal=c.draws.filter(r=>r[0]===2),gamma=c.draws.filter(r=>r[0]===3);
  const literals=`testUniform=[${uniform.map(r=>r[3]).join(',')}];\ntestNormal=[${normal.map(r=>r.slice(1).join(',')).join(';')}];\ntestGamma=[${gamma.map(r=>r.slice(1).join(',')).join(';')}];\nuCursor=0; nCursor=0; gCursor=0;\n`;
  let source=original.replace(/(function[^\n]*\n)/,'$1'+literals);
  source=source.replace('index = min(3, floor(3*rand)+1);','uCursor=uCursor+1; index = min(3,floor(3*testUniform(uCursor))+1);')
    .replace('Gumbel(j) = -log(-log(rand));','uCursor=uCursor+1; Gumbel(j)=-log(-log(testUniform(uCursor)));')
    .replace('U = rand;','uCursor=uCursor+1; U=testUniform(uCursor);');
  const draw=(kind,cursor,target,a,b)=>`${cursor}=${cursor}+1; if gather(abs((${a})-test${kind}(${cursor},1))) > 1e-8+1e-8*gather(abs(test${kind}(${cursor},1))) || gather(abs((${b})-test${kind}(${cursor},2))) > 1e-8+1e-8*gather(abs(test${kind}(${cursor},2))); error('Test:Parameter','Sampler parameter differs'); end; ${target}=gather(test${kind}(${cursor},3));`;
  source=source.replace('X(n) = normrnd(truemean(index),1);',draw('Normal','nCursor','X(n)','truemean(index)','1'))
    .replace('Means(k) = normrnd(M,sqrt(S2));',draw('Normal','nCursor','Means(k)','M','sqrt(S2)'))
    .replace('ga = gamrnd(alpha+1,1);',draw('Gamma','gCursor','ga','alpha+1','1'))
    .replace('gb = gamrnd(N,1);',draw('Gamma','gCursor','gb','N','1'))
    .replace('alpha = gather(gamrnd(shape,1./rate));',draw('Gamma','gCursor','alpha','shape','1./rate'));
  source=source.replace('result = struct(',`if uCursor~=${uniform.length} || nCursor~=${normal.length} || gCursor~=${gamma.length}; error('Test:Draws','Draw count differs'); end\nresult = struct(`);
  await fsProvider.writeFile('/Marginal_FullCollapsed_browser.m',new TextEncoder().encode(source));
  const session=await initRunMat({wasmModule,fsProvider,enableGpu:false,enableJit:false,telemetryConsent:false,language:{compat:'runmat'}});
  const progress=[];
  const subscription=await subscribeStdout(e=>{const m=/MARGINAL_PROGRESS:(\d+)/.exec(e.text||'');if(m)progress.push(Number(m[1]));});
  try{
    const p=c.params;
    const execution=await session.executeRequest({source:{kind:'text',name:'verification.m',text:`addpath('/'); r=Marginal_FullCollapsed_browser(${p.N},${p.ChainLength},${p.alpha},${p.sigmaX2},${p.A2}); disp(jsonencode(r));`}});
    assert.ok(!execution.error,JSON.stringify(execution.error));
    const lines=execution.stdout.map(e=>e.text).join('').trim().split('\n');
    const actual=validateMarginalResult(JSON.parse(lines.at(-1)),p);
    for(const [key,value]of Object.entries(c.expected)){
      const b=Array.isArray(value)?value:[value],a=Array.isArray(actual[key])?actual[key]:[actual[key]];
      assert.equal(a.length,b.length,key);
      a.forEach((v,j)=>assert.ok(Math.abs(v-b[j])<=1e-8+1e-8*Math.abs(b[j]),`${key}[${j}]: ${v} vs ${b[j]}`));
    }
    assert.deepEqual(progress,Array.from({length:p.ChainLength},(_,j)=>j+1));
    reports.push({params:p,passed:true,progressEvents:progress.length,executionMs:execution.executionTimeMs});
    console.log(`PASS RunMat WASM vs MATLAB reference ${i+1}: N=${p.N}, iterations=${p.ChainLength}`);
  }finally{await unsubscribeStdout(subscription);session.dispose();}
}
await mkdir(new URL('output/',root),{recursive:true});
await writeFile(new URL('output/marginal-wasm-reference.json',root),JSON.stringify({passed:true,reports},null,2)+'\n');
