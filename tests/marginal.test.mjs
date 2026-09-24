import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runMarginal,createMarginalSampler} from './marginal-js-reference.mjs';
import {MARGINAL_DEFAULTS,validateMarginalParameters,validateMarginalResult} from '../web/js/marginal-model.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/marginal-reference.json',import.meta.url)));
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<=1e-8+1e-8*Math.abs(b),`${label}: ${a} vs ${b}`);
for(const c of fixture.cases) test(`与 MATLAB ${fixture.matlabRelease} 原始全扫描算法逐步对照 N=${c.params.N}, L=${c.params.ChainLength}`,()=>{
  let cursor=0;
  const next=(kind,a=0,b=0)=>{const row=c.draws[cursor++];assert.ok(row,'draw sequence exhausted');assert.equal(row[0],kind);near(a,row[1],'draw parameter a');near(b,row[2],'draw parameter b');return row[3];};
  const r=runMarginal(c.params,{uniform:()=>next(1),normal:(a,b)=>next(2,a,b),gamma:(a,b)=>next(3,a,b)});
  assert.equal(cursor,c.draws.length);
  validateMarginalResult(r,c.params);
  for(const[key,value]of Object.entries(c.expected)) {
    const expected=Array.isArray(value)?value:[value],actual=Array.isArray(r[key])?r[key]:[r[key]];
    assert.equal(actual.length,expected.length,key);actual.forEach((v,i)=>near(v,expected[i],`${key}[${i}]`));
  }
});
test('参数验证与结果完整性',()=>{
  assert.deepEqual(validateMarginalParameters(MARGINAL_DEFAULTS),MARGINAL_DEFAULTS);
  for(const params of [{N:3},{N:4.5},{ChainLength:0},{alpha:0},{sigmaX2:0},{A2:'1);evil()'}])assert.throws(()=>validateMarginalParameters({...MARGINAL_DEFAULTS,...params}));
  const p={...MARGINAL_DEFAULTS,N:10,ChainLength:1};const r=runMarginal(p);validateMarginalResult(r,p);
  assert.throws(()=>validateMarginalResult({...r,counts:[99]},p));
});
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed+0.5)/4294967296;};}
test('正态、Gamma、Beta 抽样的均值与方差符合目标分布',()=>{
  const rng=createMarginalSampler(seeded(179));
  const cases=[{sample:()=>rng.normal(-2,3),mean:-2,variance:9},{sample:()=>rng.gamma(0.4,2),mean:0.8,variance:1.6},{sample:()=>rng.gamma(3,2),mean:6,variance:12},{sample:()=>{const a=rng.gamma(2,1),b=rng.gamma(5,1);return a/(a+b);},mean:2/7,variance:10/(49*8)}];
  for(const c of cases){let s=0,s2=0;const n=120000;for(let i=0;i<n;i++){const v=c.sample();s+=v;s2+=v*v;}const mean=s/n,variance=s2/n-mean*mean;assert.ok(Math.abs(mean-c.mean)<0.025*Math.max(1,Math.abs(c.mean)));assert.ok(Math.abs(variance-c.variance)<0.05*c.variance);}
});
test('默认规模、边界参数与参考方程',()=>{
  for(const p of [MARGINAL_DEFAULTS,{N:4,ChainLength:1,alpha:.001,sigmaX2:100,A2:.01},{N:50,ChainLength:20,alpha:100,sigmaX2:.01,A2:1000}]){
    const r=runMarginal(p,createMarginalSampler(seeded(321)));validateMarginalResult(r,p);
    let expectedK=0;for(let i=0;i<p.N;i++)expectedK+=r.hyperp/(r.hyperp+i);near(expectedK,3,'reference root');
  }
});
