import {MARGINAL_DEFAULTS,MARGINAL_FIELDS,validateMarginalParameters,validateMarginalResult} from './marginal-model.js';
const get=id=>document.getElementById(id);
let worker,timer,result;
let busy=false;
let runId=0;
for(const f of MARGINAL_FIELDS) {
  const wrap=document.createElement('div'); wrap.className='field';
  const label=document.createElement('label'); label.htmlFor=f.key;label.textContent=f.label;
  const input=document.createElement('input');Object.assign(input,{id:f.key,name:f.key,type:'number',min:f.min,max:f.max,step:f.integer?'1':'any',value:MARGINAL_DEFAULTS[f.key],required:true});input.setAttribute('aria-describedby',f.key+'-hint');
  const box=document.createElement('div');box.className='number-field';box.append(input);
  const hint=document.createElement('p');hint.className='hint';hint.id=f.key+'-hint';hint.textContent=f.hint;
  wrap.append(label,box,hint);get('parameter-inputs').append(wrap);
  input.addEventListener('input',()=>{clear();get('validation-error').hidden=true;status('idle','参数已更新','点击「运行 MCMC」生成本次结果。');});
}
function status(state,title,detail){get('status-panel').dataset.state=state;get('status-title').textContent=title;get('status-detail').textContent=detail;}
function clear(){result=undefined;for(const id of ['cluster-count','final-alpha','reference-alpha'])get(id).textContent='—';get('alpha-chart').replaceChildren();get('alpha-chart').setAttribute('aria-label','运行后显示 alpha 曲线');get('cluster-rows').replaceChildren();get('sample-summary').textContent='等待运行';get('run-time').textContent='';}
function setBusy(value){busy=value;get('parameter-fields').disabled=value;get('run').disabled=value;get('reset').disabled=value;get('small').disabled=value;get('stop').hidden=!value;get('iteration-progress').hidden=!value;if(!value)clearTimeout(timer);}
function terminate(){worker?.terminate();worker=undefined;runId++;setBusy(false);}
function armTimeout(message){clearTimeout(timer);timer=setTimeout(()=>fail(message),180000);}
function fail(message){terminate();clear();status('error','本次运行未完成',message);}
function draw(){
  if(!result)return;
  const svg=get('alpha-chart'),w=Math.max(280,svg.clientWidth),h=300,l=48,r=w-18,t=20,b=258;
  const max=Math.max(result.hyperp,...result.AlphaS)*1.08||1;
  const x=i=>l+(result.ChainLength===1?0.5:i/(result.ChainLength-1))*(r-l),y=v=>b-v/max*(b-t);
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  const add=(tag,attrs,text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);};
  for(const v of [0,max/2,max]){add('line',{x1:l,x2:r,y1:y(v),y2:y(v),stroke:'#e1e6df'});add('text',{x:l-7,y:y(v)+4,'text-anchor':'end','font-size':11,fill:'#526b57'},v.toFixed(2));}
  for(const i of new Set([0,Math.floor((result.ChainLength-1)/2),result.ChainLength-1]))add('text',{x:x(i),y:b+24,'text-anchor':'middle','font-size':11,fill:'#526b57'},i+1);
  add('line',{'data-series':'reference',x1:l,x2:r,y1:y(result.hyperp),y2:y(result.hyperp),stroke:'#263931','stroke-dasharray':'6 4'});
  add('polyline',{'data-series':'alpha',points:result.AlphaS.map((v,i)=>`${x(i)},${y(v)}`).join(' '),fill:'none',stroke:'#ca4d29','stroke-width':1.5});
  if(result.ChainLength===1)add('circle',{cx:x(0),cy:y(result.AlphaS[0]),r:3,fill:'#ca4d29'});
  svg.setAttribute('aria-label',`${result.ChainLength} 次迭代的 alpha 曲线，参考值 ${result.hyperp.toFixed(6)}`);
}
get('marginal-form').addEventListener('submit',event=>{
  event.preventDefault();if(busy)return;clear();get('validation-error').hidden=true;
  let params;try{params=validateMarginalParameters(Object.fromEntries(MARGINAL_FIELDS.map(f=>[f.key,get(f.key).value])));}catch(e){get('validation-error').textContent=e.message;get('validation-error').hidden=false;status('idle','请检查参数','修正后即可运行。');return;}
  setBusy(true);get('iteration-progress').value=0;status('loading','正在加载 MATLAB 运行器','首次运行需要自动加载约 69 MB 资源，可随时停止。');
  const id=++runId;armTimeout('运行器加载超时，请检查网络后重试。');
  try{
    worker??=new Worker(new URL('./marginal-worker.js',import.meta.url),{type:'module'});
    worker.onerror=e=>{e.preventDefault();if(id===runId)fail(e.message||'计算组件加载失败，请重试。');};
    worker.onmessage=({data})=>{
      if(data.id!==runId)return;
      if(data.type==='download'){
        get('iteration-progress').hidden=false;
        if(data.percent===null)get('iteration-progress').removeAttribute('value');else get('iteration-progress').value=data.percent;
        get('status-detail').textContent=`已加载 ${(data.loaded/1e6).toFixed(1)} MB；加载完成后开始执行 .m。`;
      } else if(data.type==='computing'){
        get('iteration-progress').value=0;status('computing','正在执行 MATLAB 代码',`共 ${params.ChainLength} 次迭代，请保持此页面打开。`);armTimeout('本轮计算超过 3 分钟，请减少样本数后重试。');
      } else if(data.type==='progress'){
        get('iteration-progress').value=100*data.iteration/data.total;
        const minutes=data.elapsedMs/data.iteration*(data.total-data.iteration)/60000;
        get('status-detail').textContent=`已完成 ${data.iteration} / ${data.total} 次迭代；估计还需 ${minutes<1?'不到 1':Math.ceil(minutes)} 分钟（会随分组数变化）。`;
        armTimeout('本轮长时间没有完成，请减少样本数后重试。');
      }
      else if(data.type==='error')fail(data.message);
      else if(data.type==='result'){
        try{
          result=validateMarginalResult(data.values,params);setBusy(false);
          get('cluster-count').textContent=result.K;get('final-alpha').textContent=result.alpha.toFixed(6);get('reference-alpha').textContent=result.hyperp.toFixed(6);
          get('sample-summary').textContent=`${result.N} 个样本 · ${result.ChainLength} 次迭代`;
          result.Means.forEach((mean,i)=>{const row=document.createElement('tr');for(const value of [i+1,result.counts[i],mean.toFixed(6)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}get('cluster-rows').append(row);});
          draw();get('run-time').textContent=`${(data.durationMs/1000).toFixed(2)} s`;status('complete','计算完成','曲线和表格对应本次参数与新生成的数据。');
        }catch(e){fail(e.message);}
      }
    };worker.postMessage({type:'run',id,params});
  }catch(e){fail(e.message);}
});
get('stop').addEventListener('click',()=>{terminate();clear();status('cancelled','已停止','可修改参数后重新运行。');});
get('reset').addEventListener('click',()=>{for(const[key,value]of Object.entries(MARGINAL_DEFAULTS))get(key).value=value;clear();get('validation-error').hidden=true;status('idle','准备就绪','已恢复原程序默认参数。');});
get('small').addEventListener('click',()=>{get('N').value=60;get('ChainLength').value=20;clear();get('validation-error').hidden=true;status('idle','小规模参数已填入','60 个样本、20 次迭代；点击运行开始。');});
window.addEventListener('resize',draw);window.addEventListener('pagehide',terminate);
let sourceToken=0;
async function loadSource(){
  const token=++sourceToken,name=get('source-file').value;
  if(!['Marginal_FullCollapsed.m','Marginal_FullCollapsed_browser.m'].includes(name))return;
  try{const response=await fetch(new URL(`../matlab/${name}`,import.meta.url));if(!response.ok)throw new Error('源码加载失败，请刷新重试。');const source=await response.text();if(token===sourceToken)get('source-code').textContent=source;}catch(e){if(token===sourceToken)get('source-code').textContent=e.message;}
}
get('source-file').addEventListener('change',loadSource);loadSource();
