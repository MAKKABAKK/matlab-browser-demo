async(page)=>{
  const base=__BASE_URL__,output=__OUTPUT_DIR__;
  const report={passed:false,checks:[],durations:[]},requests=[],errors=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  const check=(condition,name)=>{if(!condition)throw new Error(name);report.checks.push(name);};
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='result')window.__marginalResult=data;if(data.type==='progress')window.__iteration=data.iteration;});}};
  });
  const finish=async()=>{await page.waitForFunction(()=>['complete','error'].includes(document.querySelector('#status-panel').dataset.state),null,{timeout:120000});check(await page.locator('#status-panel').getAttribute('data-state')==='complete','浏览器计算成功');return page.evaluate(()=>window.__marginalResult);};
  try{
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'marginal.html');
    for(const[key,value]of Object.entries({N:600,ChainLength:1000,alpha:1,sigmaX2:1,A2:30}))check(await page.locator('#'+key).inputValue()===String(value),'原始默认参数 '+key);
    await page.locator('#run').click();const first=await finish();report.durations.push({params:'600 samples / 1000 iterations',ms:first.durationMs});
    check(first.values.N===600&&first.values.AlphaS.length===1000,'默认规模完整运行');
    check((await page.locator('#alpha-chart polyline').getAttribute('points')).split(' ').length===1000,'图表显示完整迭代曲线');
    check(Math.abs(first.values.hyperp-0.3048644803893017)<1e-10,'600 个样本的正数参考根正确');
    check(await page.locator('#cluster-rows tr').count()===first.values.K,'显示所有最终分组');
    check(first.values.counts.reduce((a,b)=>a+b,0)===600,'分组人数覆盖全部样本');
    await page.screenshot({path:output+'/desktop.png',fullPage:true});
    await page.locator('#N').fill('30');check(await page.locator('#final-alpha').innerText()==='—','修改参数清除旧结果');
    for(const[key,value]of Object.entries({ChainLength:15,alpha:2,sigmaX2:2,A2:10}))await page.locator('#'+key).fill(String(value));
    await page.locator('#run').click();const changed=await finish();check(changed.values.N===30&&changed.values.ChainLength===15&&changed.values.sigmaX2===2&&changed.values.A2===10,'修改后的参数进入计算');
    await page.locator('#run').click();const again=await finish();check(JSON.stringify(again.values.X)!==JSON.stringify(changed.values.X),'重新运行生成新数据');
    await page.locator('#N').fill('3');await page.locator('#run').click();check(await page.locator('#validation-error').isVisible(),'拒绝没有有限正参考根的样本数');
    await page.locator('#reset').click();check(await page.locator('#N').inputValue()==='600'&&await page.locator('#A2').inputValue()==='30','恢复原始默认值');
    await page.locator('#N').fill('2000');await page.locator('#ChainLength').fill('5000');await page.evaluate(()=>{window.__iteration=0;});
    await page.locator('#run').click();await page.waitForFunction(()=>window.__iteration>0);await page.locator('#stop').click();
    check(await page.locator('#status-panel').getAttribute('data-state')==='cancelled','后台计算可停止');
    check(await page.locator('#cluster-count').innerText()==='—','取消后不显示旧结果');
    await page.locator('#N').fill('4');await page.locator('#ChainLength').fill('1');await page.locator('#run').click();const small=await finish();
    check(small.values.hyperp>0&&await page.locator('#alpha-chart circle').count()===1,'单次迭代可见且小样本参考根为正');
    await page.setViewportSize({width:390,height:844});await page.locator('#reset').click();await page.locator('#run').click();await finish();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'手机布局无横向溢出');
    await page.screenshot({path:output+'/mobile.png',fullPage:true});
    await page.route('**/marginal-worker.js',route=>route.fulfill({status:503,body:'unavailable'}));await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#status-panel').dataset.state==='error');
    check(await page.locator('#final-alpha').innerText()==='—','计算文件加载失败有提示并清空结果');await page.unroute('**/marginal-worker.js');await page.locator('#run').click();await finish();
    check((await page.locator('#how-it-works').innerText()).includes('人工等价移植为 JavaScript'),'页面明确解释计算方式');
    check(!requests.some(u=>u.includes('/vendor/')||u.endsWith('.wasm')),'此页不下载 RunMat 运行器');
    check(requests.every(u=>u.startsWith(base)),'只请求本站资源');check(errors.length===0,'无未处理页面错误');
    report.passed=true;
  }catch(e){report.failure=e.message;}
  finally{await page.unrouteAll({behavior:'ignoreErrors'});await page.evaluate(r=>{window.__qaReport=r;},report);}
}
