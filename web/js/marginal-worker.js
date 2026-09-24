import { validateMarginalParameters, validateMarginalResult } from './marginal-model.js';

let runtime, wasm, source;
let busy = false;
async function loadWasm(send) {
  const response = await fetch(new URL('../vendor/runmat/pkg-web/runmat_wasm_web_bg.wasm', self.location.href));
  if (!response.ok) throw new Error(`计算资源加载失败（${response.status}），请检查网络后重试。`);
  const encoding = response.headers.get('Content-Encoding');
  const total = encoding && encoding !== 'identity' ? 0 : Number(response.headers.get('Content-Length')) || 0;
  if (!response.body || !WebAssembly.compileStreaming) return WebAssembly.compile(await response.arrayBuffer());
  const reader = response.body.getReader();
  let loaded = 0;
  let lastPercent = -1;
  let reportedBytes = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        loaded += value.byteLength;
        const percent = total ? Math.min(100, Math.floor(100 * loaded / total)) : null;
        if (percent !== lastPercent || (percent === null && loaded - reportedBytes >= 500000)) {
          send('progress', { percent, loaded }); lastPercent = percent; reportedBytes = loaded;
        }
        controller.enqueue(value);
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  return WebAssembly.compileStreaming(new Response(stream, { headers: { 'Content-Type': 'application/wasm' } }));
}

self.onmessage = async ({data}) => {
  if(data.type !== 'run' || busy) return;
  busy = true;
  const send = (type, extra={}) => self.postMessage({type,id:data.id,...extra});
  let session, subscription;
  try {
    const p = validateMarginalParameters(data.params);
    send('loading');
    runtime ??= await import('../vendor/runmat/index.js');
    wasm ??= await loadWasm((type,extra)=>send(type === 'progress' ? 'download' : type,extra));
    if(!source) {
      const response = await fetch(new URL('../matlab/Marginal_FullCollapsed_browser.m',self.location.href));
      if(!response.ok) throw new Error(`MATLAB 源码加载失败（${response.status}）。`);
      source = await response.text();
    }
    const fsProvider = runtime.createInMemoryFsProvider();
    await fsProvider.writeFile('/Marginal_FullCollapsed_browser.m',new TextEncoder().encode(source));
    session = await runtime.initRunMat({wasmModule:wasm,fsProvider,enableGpu:false,enableJit:false,telemetryConsent:false,language:{compat:'runmat'}});
    const start = performance.now();
    let pending = '';
    subscription = await runtime.subscribeStdout(entry => {
      if(entry.stream !== 'stdout') return;
      pending += entry.text;
      const lines = pending.split('\n'); pending = lines.pop();
      for(const line of lines) {
        const match = /^MARGINAL_PROGRESS:(\d+)$/.exec(line.trim());
        if(match) send('progress',{iteration:Number(match[1]),total:p.ChainLength,elapsedMs:performance.now()-start});
      }
    });
    send('computing');
    const execution = await session.executeRequest({source:{kind:'text',name:'browser_entry.m',text:
      `addpath('/'); browser_result=Marginal_FullCollapsed_browser(${p.N},${p.ChainLength},${p.alpha},${p.sigmaX2},${p.A2}); disp(jsonencode(browser_result));`}});
    if(execution.error) throw new Error(execution.error.message || 'MATLAB 程序运行失败。');
    const lines = execution.stdout.filter(e=>e.stream === 'stdout').map(e=>e.text).join('').trim().split('\n');
    const values = validateMarginalResult(JSON.parse(lines.at(-1)),p);
    send('result',{values,durationMs:performance.now()-start});
  } catch(error) { send('error',{message:error.message || String(error)}); }
  finally {
    if(subscription !== undefined) await runtime.unsubscribeStdout(subscription);
    session?.dispose(); busy=false;
  }
};
