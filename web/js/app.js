import { DEFAULTS, SOURCE_FILES, validateParameters, validateResult } from './model.js';
import { drawHeatmap, drawTrend } from './charts.js';

const get = (id) => document.getElementById(id);
const inputs = Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, get(key)]));
let worker;
let runId = 0;
let timer;
let busy = false;
let sourceToken = 0;
let displayedResult;

function status(state, title, detail) {
  get('status-panel').dataset.state = state;
  get('status-title').textContent = title;
  get('status-detail').textContent = detail;
}

function setBusy(value) {
  busy = value;
  get('parameter-fields').disabled = value;
  get('run').disabled = value;
  get('reset').disabled = value;
  get('stop').hidden = !value;
  if (!value) { clearTimeout(timer); get('load-progress').hidden = true; }
}

function clearResult() {
  displayedResult = undefined;
  get('result-body').dataset.ready = 'false';
  for (const id of ['initial-peak', 'final-peak', 'energy']) get(id).textContent = '—';
  get('result-summary').textContent = '等待计算';
  get('run-time').textContent = '';
  get('final-step').textContent = '第 — 步';
  get('color-max').textContent = '峰值温度';
  get('cooling-note').textContent = '相对环境温度的峰值降低一半所需步数，将在计算后显示。';
  for (const id of ['initial-map', 'final-map']) {
    const canvas = get(id);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    canvas.setAttribute('aria-label', '等待本次模拟的温度热力图');
  }
  get('trend').replaceChildren();
  get('trend').setAttribute('aria-label', '等待本次模拟的温度变化曲线');
}

function terminate() {
  worker?.terminate();
  worker = undefined;
  runId++;
  setBusy(false);
}

function fail(message) {
  terminate();
  clearResult();
  status('error', '本次运行未完成', message);
  get('run-label').textContent = '重试模拟';
}

function armTimeout(ms, message) {
  clearTimeout(timer);
  timer = setTimeout(() => fail(message), ms);
}

function showResult(values, durationMs) {
  displayedResult = values;
  get('initial-peak').textContent = values.initialPeak.toFixed(3);
  get('final-peak').textContent = values.finalPeak.toFixed(3);
  get('energy').textContent = values.energyRetainedPercent.toFixed(2);
  get('result-summary').textContent = `${values.gridSize} × ${values.gridSize} 网格 · r = ${values.ratio}`;
  get('final-step').textContent = `第 ${values.numSteps} 步`;
  get('color-max').textContent = `${values.initialPeak.toFixed(1)}°C`;
  drawHeatmap(get('initial-map'), values.initial, values.ambient, values.initialPeak);
  drawHeatmap(get('final-map'), values.final, values.ambient, values.initialPeak);
  get('initial-map').setAttribute('aria-label', `初始温度热力图，峰值 ${values.initialPeak.toFixed(3)} 摄氏度。`);
  get('final-map').setAttribute('aria-label', `最终温度热力图，峰值 ${values.finalPeak.toFixed(3)} 摄氏度。`);
  drawTrend(get('trend'), values);
  get('cooling-note').textContent = values.halfCoolingStep < 0
    ? '当前步数内，峰值相对环境温度尚未降低一半。'
    : `第 ${values.halfCoolingStep} 步，峰值相对环境温度已降低一半。`;
  get('result-body').dataset.ready = 'true';
  get('run-time').textContent = `${(durationMs / 1000).toFixed(2)} s`;
  status('complete', '计算完成', `${values.numSteps} 步模拟已在你的浏览器中完成。右侧为纯计算耗时。`);
  get('run-label').textContent = '再次运行';
}

get('simulation-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (busy) return;
  get('validation-error').hidden = true;
  clearResult();
  let params;
  try { params = validateParameters(Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]))); }
  catch (error) { get('validation-error').textContent = error.message; get('validation-error').hidden = false; status('idle', '请检查参数', '修正参数后即可重新运行。'); return; }
  if (!window.Worker || !window.WebAssembly) { fail('当前浏览器不支持本地计算，请使用新版 Chrome 或 Safari。'); return; }
  setBusy(true);
  get('run-label').textContent = '正在运行';
  status('loading', '正在准备计算', '首次运行需要自动加载计算资源，请稍候。');
  armTimeout(180000, '资源加载超时。请检查网络，点击重试。');
  const id = ++runId;
  try {
    worker ??= new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onerror = (error) => { error.preventDefault(); if (id === runId) fail('计算组件发生错误：' + (error.message || '请重试。')); };
    worker.onmessage = ({ data }) => {
      if (data.id !== runId || !busy) return;
      if (data.type === 'progress') {
        get('load-progress').hidden = false;
        if (data.percent === null) get('load-progress').removeAttribute('value');
        else get('load-progress').value = data.percent;
        status('loading', '正在加载计算资源', data.percent === null ? `已加载 ${(data.loaded / 1e6).toFixed(1)} MB` : `${data.percent}% · 文件加载完成后将自动开始计算。`);
      } else if (data.type === 'computing') {
        get('load-progress').hidden = true;
        status('computing', '正在模拟热扩散', `正在推进 ${params.numSteps} 个时间步，可随时停止。`);
        armTimeout(60000, '本次计算超时。请减少网格或步数后重试。');
      } else if (data.type === 'result') {
        try { showResult(validateResult(data.values, params), data.durationMs); setBusy(false); }
        catch (error) { fail(error.message); }
      } else if (data.type === 'error') fail(data.message);
    };
    worker.postMessage({ type: 'run', id, params });
  } catch (error) { fail(error.message); }
});

get('stop').addEventListener('click', () => {
  terminate(); clearResult();
  status('cancelled', '已停止', '本次计算已取消，你可以调整参数后重新运行。');
  get('run-label').textContent = '重新运行';
});

function parametersChanged() {
  get('grid-repeat').textContent = inputs.gridSize.value || '—';
  get('validation-error').hidden = true;
  clearResult();
  status('idle', '准备就绪', '参数已更新，点击「运行模拟」生成新的结果。');
  get('run-label').textContent = '运行模拟';
}
for (const input of Object.values(inputs)) input.addEventListener('input', parametersChanged);
get('reset').addEventListener('click', () => {
  for (const [key, value] of Object.entries(DEFAULTS)) inputs[key].value = value;
  parametersChanged();
});

async function loadSource() {
  const token = ++sourceToken;
  const name = get('source-file').value;
  if (!SOURCE_FILES.includes(name)) return;
  get('source-code').textContent = '正在加载源码…';
  try {
    const response = await fetch(new URL(`../matlab/${name}`, import.meta.url));
    if (!response.ok) throw new Error(`源码加载失败（${response.status}）。请刷新页面重试。`);
    const source = await response.text();
    if (token === sourceToken) get('source-code').textContent = source;
  } catch (error) { if (token === sourceToken) get('source-code').textContent = error.message; }
}
get('source-file').addEventListener('change', loadSource);
window.addEventListener('pagehide', terminate);
window.addEventListener('resize', () => {
  if (displayedResult) drawTrend(get('trend'), displayedResult);
});
loadSource();
