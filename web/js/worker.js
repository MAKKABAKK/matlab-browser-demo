import { SOURCE_FILES, validateParameters, executionSource, validateResult } from './model.js';

let runtime;
const sourceCache = new Map();
let busy = false;
let wasm;

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

self.onmessage = async ({ data }) => {
  if (data.type !== 'run' || busy) return;
  busy = true;
  let session;
  const send = (type, extra = {}) => self.postMessage({ type, id: data.id, ...extra });
  try {
    const random = data.program === 'random';
    const params = random ? null : validateParameters(data.params);
    send('loading');
    runtime ??= await import('../vendor/runmat/index.js');
    wasm ??= await loadWasm(send);
    const files = random ? ['untitled.m'] : SOURCE_FILES;
    let sources = sourceCache.get(random ? 'random' : 'heat');
    sources ??= await Promise.all(files.map(async (name) => {
      const response = await fetch(new URL(`../matlab/${name}`, self.location.href));
      if (!response.ok) throw new Error(`无法加载 ${name}（${response.status}）`);
      return [name, new Uint8Array(await response.arrayBuffer())];
    }));
    sourceCache.set(random ? 'random' : 'heat', sources);
    const fsProvider = runtime.createInMemoryFsProvider();
    for (const [name, contents] of sources) await fsProvider.writeFile(`/${name}`, contents);
    session = await runtime.initRunMat({ wasmModule: wasm, fsProvider, enableGpu: false, enableJit: false, telemetryConsent: false, language: { compat: 'runmat' } });
    send('computing');
    const start = performance.now();
    const result = await session.executeRequest({ source: { kind: 'text', name: 'browser_entry.m', text: random ? new TextDecoder().decode(sources[0][1]) + "\nbrowser_result = struct('samples', X, 'mean', mean(X)); disp(jsonencode(browser_result));" : executionSource(params) } });
    if (result.error) throw new Error(result.error.message || 'MATLAB 脚本运行失败');
    const output = result.stdout.filter((entry) => entry.stream !== 'stderr').map((entry) => entry.text).join('').trim();
    const parsed = JSON.parse(random ? output.slice(output.lastIndexOf('\n') + 1) : output);
    const values = random ? parsed : validateResult(parsed, params);
    if (random && (!Array.isArray(values.samples) || values.samples.length !== 100 || !values.samples.every(Number.isFinite) || !Number.isFinite(values.mean))) throw new Error('随机数计算结果不完整。');
    send('result', { values, durationMs: performance.now() - start });
  } catch (error) {
    send('error', { message: error.message || String(error) });
  } finally {
    session?.dispose();
    busy = false;
  }
};
