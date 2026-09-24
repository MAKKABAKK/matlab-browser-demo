async(page)=>{
  const base=__BASE_URL__,output=__OUTPUT_DIR__;
  const report={passed:false,checks:[],durations:[]},requests=[],errors=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  const check=(condition,name)=>{if(!condition)throw new Error(name);report.checks.push(name);};
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='result')window.__marginalResult=data;if(data.type==='progress')window.__iteration=data.iteration;});}};
  });
  const finish=async()=>{await page.waitForFunction(()=>['complete','error'].includes(document.querySelector('#status-panel').dataset.state),null,{timeout:240000});check(await page.locator('#status-panel').getAttribute('data-state')==='complete','RunMat 计算成功：'+await page.locator('#status-detail').innerText());return page.evaluate(()=>window.__marginalResult);};
  try{
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'marginal.html');
    for(const[key,value]of Object.entries({N:600,ChainLength:1000,alpha:1,sigmaX2:1,A2:30}))check(await page.locator('#'+key).inputValue()===String(value),'保留原始默认参数 '+key);
    check(!requests.some(u=>u.endsWith('.wasm')),'首屏不加载 WASM');
    await page.locator('#small').click();check(await page.locator('#N').inputValue()==='60'&&await page.locator('#ChainLength').inputValue()==='20','小规模参数需要用户主动选择');
    await page.locator('#run').click();const first=await finish();report.durations.push({params:'60 samples / 20 iterations',ms:first.durationMs});
    check(first.values.N===60&&first.values.AlphaS.length===20,'实际 .m 返回完整结果');
    check(requests.some(u=>u.endsWith('.wasm'))&&requests.some(u=>u.endsWith('Marginal_FullCollapsed_browser.m')),'加载真实 WASM 及 MATLAB 源文件');
    check((await page.locator('#alpha-chart polyline').getAttribute('points')).split(' ').length===20,'曲线包含全部迭代');
    check(await page.locator('#cluster-rows tr').count()===first.values.K,'显示所有最终分组');
    const wasmCount=requests.filter(u=>u.endsWith('.wasm')).length;
    await page.locator('#N').fill('30');check(await page.locator('#final-alpha').innerText()==='—','修改参数清除旧结果');
    for(const[key,value]of Object.entries({ChainLength:15,alpha:2,sigmaX2:2,A2:10}))await page.locator('#'+key).fill(String(value));
    await page.locator('#run').click();const changed=await finish();check(changed.values.N===30&&changed.values.ChainLength===15&&changed.values.sigmaX2===2&&changed.values.A2===10,'修改后的参数进入 MATLAB');
    check(requests.filter(u=>u.endsWith('.wasm')).length===wasmCount,'重复运行复用运行器');
    await page.locator('#reset').click();await page.locator('#ChainLength').fill('10');await page.locator('#run').click();const large=await finish();report.durations.push({params:'600 samples / 10 iterations',ms:large.durationMs});
    check(large.values.counts.reduce((a,b)=>a+b,0)===600&&Math.abs(large.values.hyperp-0.3048644803893017)<1e-10,'600 样本运行完成，分组人数和参考根正确');
    await page.screenshot({path:output+'/desktop.png',fullPage:true});
    await page.locator('#N').fill('12');await page.locator('#ChainLength').fill('1000');await page.locator('#run').click();const long=await finish();report.durations.push({params:'12 samples / 1000 iterations',ms:long.durationMs});
    check(long.values.AlphaS.length===1000&&long.values.ClusterS.length===1000,'完整 1000 轮长链（12 样本）运行完成');
    await page.locator('#N').fill('3');await page.locator('#run').click();check(await page.locator('#validation-error').isVisible(),'拒绝没有有限正参考根的样本数');
    await page.locator('#reset').click();await page.evaluate(()=>{window.__iteration=0;});
    await page.locator('#run').click();await page.waitForFunction(()=>window.__iteration>0,null,{timeout:60000});await page.locator('#stop').click();
    check(await page.locator('#status-panel').getAttribute('data-state')==='cancelled','原默认 600/1000 启动并报告进度，可以停止');
    check(await page.locator('#cluster-count').innerText()==='—','取消后不显示旧结果');
    await page.locator('#N').fill('4');await page.locator('#ChainLength').fill('1');await page.locator('#run').click();const small=await finish();
    check(small.values.hyperp>0&&await page.locator('#alpha-chart circle').count()===1,'单次迭代可见，小样本参考根为正');
    await page.setViewportSize({width:390,height:844});await page.locator('#small').click();await page.locator('#run').click();await finish();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'手机布局无横向溢出');await page.screenshot({path:output+'/mobile.png',fullPage:true});
    await page.locator('#source-file').selectOption('Marginal_FullCollapsed.m');await page.waitForFunction(()=>document.querySelector('#source-code').textContent.includes('mnrnd'));check(true,'可查看未经修改的原代码');
    await page.reload();await page.locator('#small').click();
    await page.route('**/matlab/Marginal_FullCollapsed_browser.m',route=>route.fulfill({status:200,contentType:'text/plain',body:"function result=Marginal_FullCollapsed_browser(a,b,c,d,e)\nresult=[]; error('Test:Expected','MATLAB test failure');\nend"}));
    await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#status-panel').dataset.state==='error',null,{timeout:240000});
    check((await page.locator('#status-detail').innerText()).includes('MATLAB test failure'),'实际执行 .m 中的错误，不能由 JavaScript 替代计算');
    await page.unroute('**/matlab/Marginal_FullCollapsed_browser.m');await page.locator('#run').click();await finish();
    check((await page.locator('#how-it-works').innerText()).includes('没有转换成 Python'),'页面解释实际计算方式');
    check(!requests.some(u=>u.includes('marginal-compute')),'不加载旧 JavaScript 数值算法');
    check(requests.every(u=>u.startsWith(base)),'只请求本站资源');check(errors.length===0,'无未处理页面错误');
    report.passed=true;
  }catch(e){report.failure=e.message;}
  finally{await page.unrouteAll({behavior:'ignoreErrors'});await page.evaluate(r=>{window.__qaReport=r;},report);}
}
