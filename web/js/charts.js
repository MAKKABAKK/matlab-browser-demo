const COLORS = [[23, 40, 56], [40, 116, 122], [136, 185, 166], [244, 209, 124], [225, 119, 62], [174, 62, 44]];

export function temperatureColor(value, low, high) {
  const position = Math.max(0, Math.min(1, (value - low) / Math.max(high - low, 1e-12))) * (COLORS.length - 1);
  const left = Math.min(COLORS.length - 2, Math.floor(position));
  return COLORS[left].map((channel, index) => Math.round(channel + (COLORS[left + 1][index] - channel) * (position - left)));
}

export function drawHeatmap(canvas, matrix, low, high) {
  const n = matrix.length;
  canvas.width = n;
  canvas.height = n;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(n, n);
  // MATLAB 网格的 y 轴向上，浏览器像素坐标向下。
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const offset = ((n - 1 - row) * n + col) * 4;
      pixels.data.set([...temperatureColor(matrix[row][col], low, high), 255], offset);
    }
  }
  context.putImageData(pixels, 0, 0);
}

function svgElement(tag, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

export function drawTrend(svg, values) {
  svg.replaceChildren();
  const width = Math.max(280, Math.round(svg.clientWidth || 720));
  svg.setAttribute('viewBox', `0 0 ${width} 230`);
  const left = 43, right = width - 18, top = 25, bottom = 191;
  const low = values.ambient;
  const high = Math.ceil(values.initialPeak / 10) * 10;
  const x = (step) => left + step / values.numSteps * (right - left);
  const y = (temperature) => bottom - (temperature - low) / (high - low) * (bottom - top);
  const label = (px, py, text, anchor = 'end') => svg.append(svgElement('text', { x: px, y: py, fill: '#7d8875', 'font-size': 11, 'text-anchor': anchor }, text));
  label(left, 12, '温度 / °C', 'start');
  for (let i = 0; i <= 4; i++) {
    const temperature = low + (high - low) * i / 4;
    svg.append(svgElement('line', { x1: left, x2: right, y1: y(temperature), y2: y(temperature), stroke: '#e6ebe1', 'stroke-dasharray': '3 5' }));
    label(left - 9, y(temperature) + 4, String(Math.round(temperature)));
  }
  const ticks = [...new Set([0, Math.round(values.numSteps / 4), Math.round(values.numSteps / 2), Math.round(3 * values.numSteps / 4), values.numSteps])];
  for (const step of ticks) label(x(step), bottom + 19, String(step), 'middle');
  label(right, 227, '模拟步数');
  for (const [key, color] of [['peak', '#d86737'], ['mean', '#247d76']]) {
    const points = values.steps.map((step, i) => `${i ? 'L' : 'M'}${x(step).toFixed(2)},${y(values[key][i]).toFixed(2)}`).join(' ');
    svg.append(svgElement('path', { d: points, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-series': key }));
  }
  svg.setAttribute('aria-label', `温度变化曲线：${values.numSteps} 步后峰值从 ${values.initialPeak.toFixed(3)} 降至 ${values.finalPeak.toFixed(3)} 摄氏度。`);
}
