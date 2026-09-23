export const MARGINAL_DEFAULTS = Object.freeze({ N: 600, ChainLength: 1000, alpha: 1, sigmaX2: 1, A2: 30 });
export const MARGINAL_FIELDS = Object.freeze([
  { key: 'N', label: '样本数量', min: 4, max: 2000, integer: true, hint: '至少 4 个，才能求解原程序的三组参考线。' },
  { key: 'ChainLength', label: 'MCMC 迭代次数', min: 1, max: 5000, integer: true, hint: '更多迭代需要更长时间；不自动判定是否收敛。' },
  { key: 'alpha', label: '初始 alpha', min: 0.001, max: 100, hint: '仅设置初值；运行过程中会继续抽样更新。' },
  { key: 'sigmaX2', label: '观测方差 σ²', min: 0.01, max: 100, hint: '推断模型中的方差，不是标准差。' },
  { key: 'A2', label: '均值先验方差 A²', min: 0.01, max: 1000, hint: '各组均值使用零均值正态先验。' },
]);
export function validateMarginalParameters(input) {
  const p = {};
  for (const f of MARGINAL_FIELDS) {
    const v = Number(input?.[f.key]);
    if (!Number.isFinite(v) || v < f.min || v > f.max || (f.integer && !Number.isInteger(v))) throw new Error(`${f.label}须为 ${f.min}–${f.max} ${f.integer ? '之间的整数' : '之间的数值'}。`);
    p[f.key] = v;
  }
  return p;
}
export function validateMarginalResult(r,p) {
  if (!r || r.N !== p.N || r.ChainLength !== p.ChainLength || r.sigmaX2 !== p.sigmaX2 || r.A2 !== p.A2) throw new Error('结果与本次参数不匹配。');
  if (!Number.isInteger(r.K) || r.K < 1 || r.K > p.N) throw new Error('分组数无效。');
  for (const [key,length] of Object.entries({X:p.N,Table:p.N,XMeans:p.N,AlphaS:p.ChainLength,ClusterS:p.ChainLength,Means:r.K,counts:r.K})) {
    if (typeof r[key] === 'number' && length === 1) r[key] = [r[key]];
    if (!Array.isArray(r[key]) || r[key].length !== length || !r[key].every(Number.isFinite)) throw new Error(`${key} 数据不完整。`);
  }
  if (!Number.isFinite(r.alpha) || r.alpha < 0 || !Number.isFinite(r.hyperp) || r.hyperp <= 0 || r.AlphaS.some(v=>v<0)) throw new Error('alpha 结果无效。');
  if (r.counts.some(v=>!Number.isInteger(v)||v<1) || r.counts.reduce((a,b)=>a+b,0)!==p.N) throw new Error('分组人数不完整。');
  const counts=Array(r.K).fill(0);
  r.Table.forEach((k,i)=>{ if(!Number.isInteger(k)||k<1||k>r.K||r.XMeans[i]!==r.Means[k-1]) throw new Error('样本分组不一致。'); counts[k-1]++; });
  if (counts.some((v,i)=>v!==r.counts[i]) || r.ClusterS.some(k=>!Number.isInteger(k)||k<1||k>p.N)) throw new Error('分组统计不一致。');
  return r;
}
