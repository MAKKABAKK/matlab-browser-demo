async (page) => {
  page.setDefaultTimeout(180000);
  const base = __BASE_URL__;
  const fixture = __FIXTURE_PATH__;
  const report = { checks: [], numeric: [], requests: [], errors: [] };
  const requestListener = request => report.requests.push(request.url());
  const errorListener = error => report.errors.push(error.message);
  page.on('request', requestListener);
  page.on('pageerror', errorListener);
  const check = (value, message) => { if (!value) throw new Error(message); report.checks.push(message); };
  const state = () => page.locator('#status-panel').getAttribute('data-state');
  const finish = async () => {
    await page.waitForFunction(() => ['complete','error'].includes(document.querySelector('#status-panel').dataset.state), null, {timeout:180000});
    check(await state()==='complete', '计算完成：' + await page.locator('#status-detail').textContent());
  };
  try {
    await page.setViewportSize({width:1440,height:900});
    await page.goto(base);
    await page.waitForLoadState('networkidle');
    check(!report.requests.some(url=>url.includes('/vendor/')), '首屏不加载运行器');
    await page.locator('#run').click();
    await finish();
    check(await page.locator('#final-peak').textContent()==='34.011', '默认参数的界面结果正确');
    check(await page.locator('#trend path[data-series]').count()===2, '生成两条温度曲线');
    check(await page.locator('#initial-map').getAttribute('width')==='61', '热力图来自完整网格');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:__OUTPUT_DIR__+'/desktop.png',fullPage:true});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), '桌面无横向溢出');

    await page.route('**/__verification__/matlab-reference.json', route=>route.fulfill({path:fixture,contentType:'application/json'}));
    report.numeric = await page.evaluate(async () => {
      const reference = await (await fetch('./__verification__/matlab-reference.json')).json();
      const worker = new Worker('./js/worker.js',{type:'module'});
      const reports=[];
      try {
        for (const [index,expected] of reference.cases.entries()) {
          const params={gridSize:expected.gridSize,numSteps:expected.numSteps,ratio:expected.ratio};
          const actual=await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(new Error('Numerical test timed out')),180000);
            worker.onerror=e=>{clearTimeout(timer);reject(new Error(e.message));};
            worker.onmessage=({data})=>{
              if(data.id!==index+1)return;
              if(data.type==='result'){clearTimeout(timer);resolve(data.values);}
              if(data.type==='error'){clearTimeout(timer);reject(new Error(data.message));}
            };
            worker.postMessage({type:'run',id:index+1,params});
          });
          let count=0,maxAbsoluteError=0;
          function compare(a,b,path) {
            if(typeof b==='number'){
              if(!Number.isFinite(a))throw new Error(path+' is not finite');
              const error=Math.abs(a-b);
              if(error>1e-8+1e-8*Math.abs(b))throw new Error(path+' differs by '+error);
              count++;maxAbsoluteError=Math.max(maxAbsoluteError,error);
            } else if(Array.isArray(b)) {
              if(!Array.isArray(a)||a.length!==b.length)throw new Error(path+' shape mismatch');
              b.forEach((v,i)=>compare(a[i],v,path+'['+i+']'));
            } else {
              if(!a||JSON.stringify(Object.keys(a).sort())!==JSON.stringify(Object.keys(b).sort()))throw new Error(path+' keys mismatch');
              for(const key of Object.keys(b))compare(a[key],b[key],path+'.'+key);
            }
          }
          compare(actual,expected,'result');
          reports.push({params,count,maxAbsoluteError,matlabRelease:reference.matlabRelease});
        }
      } finally {worker.terminate();}
      return reports;
    });
    await page.unroute('**/__verification__/matlab-reference.json');
    check(report.numeric.length===4, '四组完整 MATLAB 数值基准通过');

    await page.locator('#ratio').fill('0.26');
    check(await page.locator('#final-peak').textContent()==='—', '参数变化清除旧结果');
    await page.locator('#run').click();
    check(await page.locator('#validation-error').isVisible(), '非法参数被拒绝');
    await page.locator('#reset').click();
    check(await page.locator('#ratio').inputValue()==='0.2', '恢复默认参数');
    await page.locator('#gridSize').fill('11');
    await page.locator('#numSteps').fill('1');
    await page.locator('#ratio').fill('0.01');
    await page.locator('#run').click();
    await finish();
    check((await page.locator('#cooling-note').textContent()).includes('尚未'), '未达到半冷却条件正确显示');

    await page.locator('#gridSize').fill('81');
    await page.locator('#numSteps').fill('500');
    await page.locator('#ratio').fill('0.25');
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.querySelector('#status-panel').dataset.state==='computing');
    await page.locator('#stop').click();
    check(await state()==='cancelled', '计算可以停止');
    check(await page.locator('#final-peak').textContent()==='—', '取消不会保留上次结果');
    await page.locator('#reset').click();
    await page.locator('#run').click();
    await finish();

    await page.reload();
    let pending, resolvePending;
    const pendingReady = new Promise(resolve=>{resolvePending=resolve;});
    await page.route('**/runmat_wasm_web_bg.wasm',route=>{pending=route;resolvePending();});
    await page.locator('#run').click();
    await Promise.race([pendingReady,page.waitForTimeout(10000)]);
    check(Boolean(pending),'捕获运行器加载阶段');
    await page.locator('#stop').click();
    await pending.abort().catch(()=>{});
    await page.unroute('**/runmat_wasm_web_bg.wasm');
    check(await state()==='cancelled','加载阶段可以停止');

    await page.route('**/runmat_wasm_web_bg.wasm',route=>route.fulfill({status:503,body:'test failure'}));
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.querySelector('#status-panel').dataset.state==='error');
    check((await page.locator('#status-detail').textContent()).includes('503'),'加载失败显示原因');
    await page.unroute('**/runmat_wasm_web_bg.wasm');
    await page.locator('#run').click();
    await finish();

    await page.reload();
    await page.route('**/matlab/heat_demo.m',route=>route.fulfill({body:"function result = heat_demo(a,b,c)\nresult = [];\nerror('Demo:Expected', 'Test script error');\nend",contentType:'text/plain'}));
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.querySelector('#status-panel').dataset.state==='error');
    check((await page.locator('#status-detail').textContent()).includes('Test script error'),'MATLAB 脚本错误真实显示');
    await page.unroute('**/matlab/heat_demo.m');
    await page.locator('#run').click();
    await finish();

    await page.locator('#source-file').selectOption('simulate_heat_diffusion_demo.m');
    await page.waitForFunction(()=>document.querySelector('#source-code').textContent.startsWith('function simulation'));
    check(true,'只读源码可切换');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>window.scrollTo(0,0));
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'手机无横向溢出');
    await page.waitForFunction(()=>Math.abs(document.querySelector('#trend').viewBox.baseVal.width-document.querySelector('#trend').clientWidth)<=1);
    check(true,'手机曲线坐标文字保持可读尺寸');
    await page.screenshot({path:__OUTPUT_DIR__+'/mobile.png',fullPage:true});
    await page.locator('#run').click();
    await finish();
    check(await page.locator('#final-peak').textContent()==='34.011','手机尺寸下运行与结果正确');
    check(await page.evaluate(({urls,base})=>urls.every(url=>new URL(url).origin===new URL(base).origin),{urls:report.requests,base}),'运行过程只请求本站资源');
    check(report.errors.length===0,'没有未处理页面错误');
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>window.scrollTo(0,0));
    report.passed=true;
  } catch(error) {report.passed=false;report.failure=error.message;}
  finally {
    page.off('request',requestListener);page.off('pageerror',errorListener);
    await page.unrouteAll({behavior:'ignoreErrors'});
    await page.evaluate(report=>{window.__qaReport=report;},report);
  }
}
