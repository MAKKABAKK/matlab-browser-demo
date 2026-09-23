const get = (id) => document.getElementById(id);
let worker, timer, values;
let runId = 0;
function status(state, title, detail) {
  get('status-panel').dataset.state = state;
  get('status-title').textContent = title;
  get('status-detail').textContent = detail;
}
function finish() {
  clearTimeout(timer);
  get('run').disabled = false;
  get('stop').hidden = true;
  get('load-progress').hidden = true;
}
function terminate() { worker?.terminate(); worker = undefined; runId++; finish(); }
function clear() { values = undefined; get('sample-mean').textContent = '—'; get('random-chart').replaceChildren(); }
function fail(message) { terminate(); clear(); status('error', '本次运行未完成', message); }
function draw() {
  if (!values) return;
  const svg = get('random-chart');
  const width = Math.max(280, svg.clientWidth), height = 300;
  const left = 42, right = width - 16, top = 20, bottom = 260;
  const limit = Math.max(3, Math.ceil(Math.max(...values.samples.map(Math.abs))));
  const x = (i) => left + i / 99 * (right - left);
  const y = (v) => bottom - (v + limit) / (2 * limit) * (bottom - top);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.replaceChildren();
  const add = (tag, attrs, text) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    svg.append(node);
  };
  for (const v of [-limit, 0, limit]) {
    add('line', { x1: left, x2: right, y1: y(v), y2: y(v), stroke: '#d8dfd9', 'stroke-dasharray': '4 4' });
    add('text', { x: left - 8, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#526b57' }, v);
  }
  for (const i of [0, 24, 49, 74, 99]) add('text', { x: x(i), y: bottom + 24, 'text-anchor': 'middle', 'font-size': 11, fill: '#526b57' }, i + 1);
  add('polyline', { points: values.samples.map((v, i) => `${x(i)},${y(v)}`).join(' '), fill: 'none', stroke: '#ca4d29', 'stroke-width': 1.6 });
  svg.setAttribute('aria-label', `100 个正态随机数，样本均值 ${values.mean.toFixed(6)}`);
}
get('run').addEventListener('click', () => {
  clear();
  get('run').disabled = true; get('stop').hidden = false;
  status('loading', '正在准备计算', '首次运行需要加载计算资源，请稍候。');
  timer = setTimeout(() => fail('加载或计算超时，请检查网络后重试。'), 180000);
  const id = ++runId;
  try {
    worker ??= new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onerror = (event) => { event.preventDefault(); if (id === runId) fail(event.message || '计算组件出错，请重试。'); };
    worker.onmessage = ({ data }) => {
      if (data.id !== runId) return;
      if (data.type === 'progress') {
        get('load-progress').hidden = false;
        if (data.percent === null) get('load-progress').removeAttribute('value');
        else get('load-progress').value = data.percent;
        status('loading', '正在加载计算资源', `已加载 ${(data.loaded / 1e6).toFixed(1)} MB`);
      } else if (data.type === 'computing') status('computing', '正在生成随机数', '在浏览器里运行 untitled.m。');
      else if (data.type === 'error') fail(data.message);
      else if (data.type === 'result') {
        values = data.values;
        get('sample-mean').textContent = values.mean.toFixed(6);
        draw(); finish(); get('run').textContent = '重新生成';
        status('complete', '计算完成', `已生成 100 个随机数，耗时 ${(data.durationMs / 1000).toFixed(2)} 秒。`);
      }
    };
    worker.postMessage({ type: 'run', program: 'random', id });
  } catch (error) { fail(error.message); }
});
get('stop').addEventListener('click', () => { terminate(); clear(); status('cancelled', '已停止', '可重新生成随机数。'); });
window.addEventListener('pagehide', terminate);
window.addEventListener('resize', draw);
fetch(new URL('../matlab/untitled.m', import.meta.url)).then((r) => { if (!r.ok) throw new Error('源码加载失败，请刷新重试。'); return r.text(); }).then((s) => { get('source-code').textContent = s; }).catch((e) => { get('source-code').textContent = e.message; });
