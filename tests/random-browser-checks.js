async (page) => {
  const base = __BASE_URL__;
  const output = __OUTPUT_DIR__;
  const report = { passed: false, checks: [] };
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push(r.url()));
  const check = (condition, name) => { if (!condition) throw new Error(name); report.checks.push(name); };
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); this.addEventListener('message', ({data}) => { if (data.type === 'result') window.__result = data.values; }); }
    };
  });
  try {
    await page.goto(base + 'random.html');
    check(!requests.some(url => url.includes('/vendor/')), '运行前不加载运行器');
    const run = async () => {
      await page.locator('#run').click();
      await page.waitForFunction(() => ['complete','error'].includes(document.querySelector('#status-panel').dataset.state), null, {timeout:180000});
      check(await page.locator('#status-panel').getAttribute('data-state') === 'complete', '实际 .m 执行成功');
      return page.evaluate(() => window.__result);
    };
    const first = await run();
    check(first.samples.length === 100 && first.samples.every(Number.isFinite), '返回 100 个有限随机数');
    const expected = first.samples.reduce((a,b) => a+b,0)/100;
    check(Math.abs(expected-first.mean)<1e-12, 'MATLAB 均值与全部样本独立重算一致');
    check(await page.locator('#sample-mean').innerText() === first.mean.toFixed(6), '页面均值显示正确');
    check((await page.locator('#random-chart polyline').getAttribute('points')).split(' ').length === 100, '图表包含全部 100 个样本');
    await page.screenshot({path:output+'/random-desktop.png',fullPage:true});
    await page.context().setOffline(true);
    const second = await run();
    await page.context().setOffline(false);
    check(JSON.stringify(first.samples)!==JSON.stringify(second.samples), '重复运行生成不同样本，资源加载后离线可计算');
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:output+'/random-mobile.png',fullPage:true});
    check(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth), '手机布局无横向溢出');
    await run();
    await page.reload();
    await page.locator('#run').click();
    await page.locator('#stop').click();
    check(await page.locator('#status-panel').getAttribute('data-state') === 'cancelled', '停止清除本次结果');
    await run();
    await page.reload();
    await page.route('**/matlab/untitled.m', route => route.fulfill({status:503,body:'unavailable'}));
    await page.locator('#run').click();
    await page.waitForFunction(() => document.querySelector('#status-panel').dataset.state === 'error', null, {timeout:180000});
    check(await page.locator('#sample-mean').innerText() === '—', '源码加载失败有提示且无旧结果');
    await page.unroute('**/matlab/untitled.m');
    await run();
    check(errors.length===0, '无未处理页面错误');
    check(requests.every(url => url.startsWith(base)), '只请求本站资源');
    report.passed = true;
  } catch (error) { report.failure=error.message; }
  finally { await page.context().setOffline(false); await page.evaluate(r => { window.__qaReport=r; },report); }
}
