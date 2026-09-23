import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULTS, executionSource, validateParameters, validateResult } from '../web/js/model.js';
import { drawHeatmap, temperatureColor } from '../web/js/charts.js';

const reference = JSON.parse(await readFile(new URL('./fixtures/matlab-reference.json', import.meta.url)));

test('参数边界和默认参数', () => {
  assert.deepEqual(validateParameters({gridSize:'61',numSteps:'300',ratio:'0.20'}), DEFAULTS);
  assert.deepEqual(validateParameters({gridSize:11,numSteps:1,ratio:0.01}), {gridSize:11,numSteps:1,ratio:0.01});
  assert.deepEqual(validateParameters({gridSize:81,numSteps:500,ratio:0.25}), {gridSize:81,numSteps:500,ratio:0.25});
  for (const [key, values] of Object.entries({gridSize:['',10,82,15.5,NaN],numSteps:['',0,501,3.1,Infinity],ratio:['',0,0.009,0.251,NaN,Infinity,'0.2); system(1)']})) {
    for (const value of values) assert.throws(() => validateParameters({...DEFAULTS,[key]:value}));
  }
});

test('只有经过校验的数字进入 MATLAB 调用', () => {
  assert.match(executionSource(DEFAULTS), /heat_demo\(61, 300, 0.2\)/);
  assert.throws(() => executionSource({...DEFAULTS,numSteps:'1); error(1)'}));
});

test('结果必须包含本次参数、完整矩阵、完整曲线及有限数值', () => {
  for (const result of reference.cases) assert.equal(validateResult(result,result),result);
  const base = reference.cases[0];
  assert.throws(() => validateResult(base,{...DEFAULTS,numSteps:1}));
  assert.throws(() => validateResult({...base,final:base.final.slice(1)},DEFAULTS));
  assert.throws(() => validateResult({...base,peak:[1]},DEFAULTS));
  assert.throws(() => validateResult({...base,finalPeak:NaN},DEFAULTS));
});

test('MATLAB 基准符合固定冷边界及稳定扩散的物理约束', () => {
  for (const r of reference.cases) {
    for (const row of [r.final[0],r.final.at(-1)]) assert.ok(row.every(v=>v===20));
    for (const row of r.final) assert.equal(row[0],20), assert.equal(row.at(-1),20);
    for (let i=1;i<r.peak.length;i++) assert.ok(r.peak[i]<=r.peak[i-1]+1e-10);
    assert.ok(r.final.flat().every(v=>v>=20-1e-10 && v<=r.initialPeak+1e-10));
  }
  assert.equal(reference.cases[0].initialPeak.toFixed(3),'97.685');
  assert.equal(reference.cases[0].finalPeak.toFixed(3),'34.011');
});

test('热力图共享色标，并保持 MATLAB 的 y 轴朝向', () => {
  let image;
  const canvas = {getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:(pixels)=>{image=pixels;}})};
  drawHeatmap(canvas,[[20,100],[100,20]],20,100);
  assert.deepEqual(Array.from(image.data.slice(0,3)),temperatureColor(100,20,100));
  assert.deepEqual(Array.from(image.data.slice(8,11)),temperatureColor(20,20,100));
  assert.deepEqual(temperatureColor(0,20,100),temperatureColor(20,20,100));
  assert.deepEqual(temperatureColor(200,20,100),temperatureColor(100,20,100));
});
