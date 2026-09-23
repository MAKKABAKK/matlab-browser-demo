import { validateMarginalParameters } from './marginal-model.js';

// Normal: Box–Muller. Gamma: Marsaglia–Tsang, with shape lifting below 1.
// Injectable draws allow a path-by-path comparison with the original MATLAB loops.
export function createMarginalSampler(uniform = Math.random) {
  const openUniform = () => { let u; do { u=uniform(); } while (u<=0 || u>=1); return u; };
  const normal = (mean=0,sd=1) => mean + sd*Math.sqrt(-2*Math.log(openUniform()))*Math.cos(2*Math.PI*openUniform());
  function gamma(shape,scale) {
    if (shape<1) return gamma(shape+1,scale)*Math.pow(openUniform(),1/shape);
    const d=shape-1/3, c=1/Math.sqrt(9*d);
    for (;;) {
      const x=normal(), v0=1+c*x;
      if(v0<=0) continue;
      const v=v0*v0*v0, u=openUniform();
      if(u<1-0.0331*x*x*x*x || Math.log(u)<0.5*x*x+d*(1-v+Math.log(v))) return scale*d*v;
    }
  }
  return { uniform:openUniform, normal, gamma };
}

export function runMarginal(input, random=createMarginalSampler(), onProgress=()=>{}) {
  const {N,ChainLength,sigmaX2,A2}=validateMarginalParameters(input);
  let alpha=Number(input.alpha);
  const truth=[-5,0,5];
  const X=Array.from({length:N},()=>random.normal(truth[Math.min(2,Math.floor(3*random.uniform()))],1)).sort((a,b)=>a-b);
  const Table=Array(N).fill(0), counts=[], sums=[];
  const AlphaS=[], ClusterS=[];
  for(let iter=0;iter<ChainLength;iter++) {
    for(let n=0;n<N;n++) {
      const old=Table[n]-1, xn=X[n];
      Table[n]=0;
      if(old>=0) {
        counts[old]--; sums[old]-=xn;
        if(counts[old]===0) {
          counts.splice(old,1); sums.splice(old,1);
          for(let i=0;i<N;i++) if(Table[i]>old+1) Table[i]--;
        }
      }
      const K=counts.length, logProb=[];
      for(let k=0;k<K;k++) {
        const count=counts[k], sumX=sums[k];
        const Mk=A2*(xn+sumX)/((count+1)*A2+sigmaX2);
        const Sk2=sigmaX2*A2/((count+1)*A2+sigmaX2);
        const Uk=A2*sumX/(count*A2+sigmaX2);
        const Vk2=sigmaX2*A2/(count*A2+sigmaX2);
        const logLike=-0.5*Math.log(2*Math.PI*sigmaX2)-xn*xn/(2*sigmaX2)
          +0.5*Math.log(2*Math.PI*Sk2)+Mk*Mk/(2*Sk2)
          -0.5*Math.log(2*Math.PI*Vk2)-Uk*Uk/(2*Vk2);
        logProb.push(Math.log(count)-Math.log(N-1+alpha)+logLike);
      }
      logProb.push(Math.log(alpha)-Math.log(N-1+alpha)-0.5*Math.log(2*Math.PI*(sigmaX2+A2))-xn*xn/(2*(sigmaX2+A2)));
      let best=-Infinity, index=0;
      for(let k=0;k<=K;k++) {
        const score=-Math.log(-Math.log(random.uniform()))+logProb[k];
        if(score>best) {best=score; index=k;}
      }
      if(index===K) {counts.push(0); sums.push(0);}
      Table[n]=index+1; counts[index]++; sums[index]+=xn;
    }
    const K=counts.length, AA=0.001, BB=0.001;
    const ga=random.gamma(alpha+1,1), gb=random.gamma(N,1);
    const phiE=ga/(ga+gb), piE1=alpha+K-1, piE2=N*(BB-Math.log(phiE));
    // Keep the user's piE formula exactly, including alpha in piE1.
    const shape=random.uniform()<piE1/(piE1+piE2) ? AA+K : AA+K-1;
    alpha=random.gamma(shape,1/(BB-Math.log(phiE)));
    if(!Number.isFinite(alpha)||alpha<0) throw new Error('抽样出现非有限数值，请调整参数后重试。');
    AlphaS.push(alpha); ClusterS.push(K);
    if(iter===0 || (iter+1)%10===0 || iter+1===ChainLength) onProgress(iter+1,ChainLength);
  }
  const Means=counts.map((count,k)=>random.normal(A2*sums[k]/(sigmaX2+A2*count),Math.sqrt(A2*sigmaX2/(sigmaX2+A2*count))));
  const expectedGroups=a=>{let sum=0;for(let i=0;i<N;i++)sum+=a/(a+i);return sum;};
  let lo=0,hi=1;
  while(expectedGroups(hi)<3) hi*=2;
  for(let i=0;i<80;i++) {const mid=(lo+hi)/2;if(expectedGroups(mid)<3)lo=mid;else hi=mid;}
  return {N,ChainLength,sigmaX2,A2,X,Table,AlphaS,ClusterS,Means,counts,XMeans:Table.map(k=>Means[k-1]),K:counts.length,hyperp:(lo+hi)/2,alpha};
}
