export const DEFAULTS = Object.freeze({ gridSize: 61, numSteps: 300, ratio: 0.2 });
export const SOURCE_FILES = Object.freeze(['heat_demo.m', 'initial_temperature_demo.m', 'simulate_heat_diffusion_demo.m']);

export function validateParameters(input) {
  const p = { gridSize: Number(input.gridSize), numSteps: Number(input.numSteps), ratio: Number(input.ratio) };
  if (!Number.isInteger(p.gridSize) || p.gridSize < 11 || p.gridSize > 81) throw new Error('网格大小须为 11–81 的整数。');
  if (!Number.isInteger(p.numSteps) || p.numSteps < 1 || p.numSteps > 500) throw new Error('模拟步数须为 1–500 的整数。');
  if (!Number.isFinite(p.ratio) || p.ratio < 0.01 || p.ratio > 0.25) throw new Error('扩散系数须在 0.01–0.25 之间。');
  return p;
}

export function executionSource(input) {
  const p = validateParameters(input);
  return `addpath('/'); browser_result = heat_demo(${p.gridSize}, ${p.numSteps}, ${p.ratio}); disp(jsonencode(browser_result));`;
}

export function validateResult(value, params) {
  if (!value || value.gridSize !== params.gridSize || value.numSteps !== params.numSteps || value.ratio !== params.ratio) throw new Error('计算结果与本次参数不匹配。');
  const vector = (v, length) => Array.isArray(v) && v.length === length && v.every(Number.isFinite);
  for (const key of ['initial', 'final']) {
    if (!Array.isArray(value[key]) || value[key].length !== params.gridSize || !value[key].every((row) => vector(row, params.gridSize))) throw new Error('计算返回的温度矩阵不完整。');
  }
  for (const key of ['steps', 'peak', 'mean', 'energy']) {
    if (!vector(value[key], params.numSteps + 1)) throw new Error('计算返回的温度曲线不完整。');
  }
  for (const key of ['initialPeak', 'finalPeak', 'energyRetainedPercent', 'ambient', 'halfCoolingStep']) {
    if (!Number.isFinite(value[key])) throw new Error('计算返回了无效的数值。');
  }
  return value;
}
