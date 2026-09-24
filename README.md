# MATLAB 浏览器数值实验室

独立静态数值实验网站。热扩散、正态随机数和 Collapsed MCMC 都使用 RunMat WebAssembly 执行 `.m` 文件。全部计算在用户浏览器完成，无需安装 MATLAB、登录账户或使用计算服务器。

本项目没有接入或修改旁边的 `matlab-web-demo` 网站。

## Marginal_FullCollapsed：可调参数的 MCMC

[打开 MCMC 网页](https://makkabakk.github.io/matlab-browser-demo/marginal.html)。可修改样本数 `N`、迭代次数 `ChainLength`、初始 `alpha`、观测方差 `sigmaX2`、均值先验方差 `A2`；原默认值分别为 600、1000、1、1、30。模拟数据仍来自均值 −5/0/5、标准差 1、等权重的三个正态分布。修改模型方差不会改变数据生成标准差。

本页现在直接执行 MATLAB 适配版 `matlab/Marginal_FullCollapsed_browser.m`。RunMat 0.6.2 在浏览器 Worker 内加载并执行该文件，所有随机抽样、分组概率、alpha 更新、均值计算和参考根求解均位于 `.m` 中。JavaScript 只负责参数校验、运行器加载、进度与绘图；不调用 Python 或远端计算服务。原始 `matlab/Marginal_FullCollapsed.m` 保留原字节，可在网页切换查看。

首次运行自动加载约 69 MB WASM 资源；正常完成后可复用已加载的运行器。MATLAB 每轮输出 `MARGINAL_PROGRESS`，Worker 订阅输出并回传进度及耗时估算。长链没有固定总时限；加载或单轮连续 3 分钟无进展会报错，可减少样本数重试。停止会终止 Worker，下一次需要重新准备运行器。

**速度限制：**本机 600 样本/10 轮实测约 26 秒，600/1000 可能需几十分钟，不能沿用此前 JavaScript 移植版约 0.1 秒的速度。保留原始默认参数；“填入小规模参数”按钮由用户主动改为 60/20。验收分别覆盖 600/10 的样本规模和 12/1000 的迭代长度，没有把这些测试声称为完成了整组默认 600/1000。

MATLAB 适配保留逐个分组更新、Gumbel-Max、alpha 更新和最终均值条件抽样，维护人数/总和减少重复扫描。RunMat 缺少 `mnrnd`、`betarnd`：等权分类抽样用 `rand`，Beta 用两个独立 `gamrnd` 的比值，全部写在 `.m` 中。使用 `gather` 和额外的数组预分配兼容运行器的驻留数组与标量索引。参考根在正数区间以二分法求解原方程，避免小 N 时原 `fzero(...,0.5)` 落入负值奇点。随机流与 MathWorks MATLAB 不同，不保证日常随机样本相同。

参考线不是收敛判据，最终均值不是全链后验平均；保留全部迭代，没有自动丢弃预热期。RunMat 是第三方运行器，不代表完整 MATLAB 工具箱支持。

验证命令：

```sh
npm test
node scripts/check-marginal-wasm.mjs
python3 scripts/check-browser.py --suite marginal --browser chrome
python3 scripts/check-browser.py --suite marginal --browser webkit
# 在线验收：为浏览器命令追加
# --url https://makkabakk.github.io/matlab-browser-demo/
```

`check-marginal-wasm.mjs` 使用与网页相同的 WASM，执行 MATLAB 适配代码。仅在测试内将随机输入替换为四组 MATLAB R2026a 记录，逐次核对抽样参数、完整结果及每轮进度。此检查也是发布 CI 必须通过的步骤。生产 `.m` 使用真实随机数，不包含回放数据。旧 JavaScript 实现仅作为测试参考保存在 `tests/marginal-js-reference.mjs`，不会发布到网站。

重新生成 MATLAB 基准和原算法对照：

```matlab
run('scripts/generate_marginal_reference.m')
run('tests/marginal/check_native.m')
```

## 正态随机数程序

`random.html` 执行 `matlab/untitled.m`：通过 `normrnd(0,3)` 生成 100 个样本并计算 `mean(X)`。`sigma2` 虽然是原变量名，但第二个参数表示标准差 3，不是方差 3。原始文件保留于 `matlab/untitled-original.m`；执行版本仅将 `plot(X)` 替换为注释，由网页按返回样本绘图。Worker 读取该脚本正文交给 RunMat 执行，附加 JSON 输出用于传递结果；不在 JavaScript 中重写采样算法。

点击重新生成会获得新样本；无需安装 MATLAB。运行器首次由浏览器自动下载，不等于零下载。随机数不做与 MATLAB 的逐项相等比较，验收独立重算样本均值、检查完整样本与绘图、重复运行、离线计算、停止和失败恢复。

```sh
python3 scripts/check-browser.py --suite random --browser chrome --url https://makkabakk.github.io/matlab-browser-demo/
python3 scripts/check-browser.py --suite random --browser webkit --url https://makkabakk.github.io/matlab-browser-demo/
```

## 本地运行

准备 Node.js 与 npm（CI 使用 Node.js 24），在本目录执行：

```sh
npm ci --ignore-scripts
npm test
npm run build
node scripts/check-build.mjs
npm run preview
```

打开 [本地预览](http://127.0.0.1:4173/matlab-browser-demo/)。预览特意放在子路径下，以检查 GitHub Pages 仓库路径兼容性。不要直接双击 HTML 文件；模块与 WebAssembly 需要通过 HTTP 加载。

点击“运行模拟”后才加载计算组件。停止按钮可以中止加载或计算。修改参数、失败和取消都会清除旧结果，防止把旧图表误当成本次结果。

## 发布到一个新的 GitHub Pages 网站

1. 新建 GitHub 仓库，把**本目录内的项目文件**放到仓库根目录，包括 `.github/`、`.npmrc` 和 `package-lock.json`。不要上传 `node_modules/`、`dist/` 或 `output/`。
2. 在仓库 Settings → Pages 中，将 Source 设置为 **GitHub Actions**。
3. 推送到 `main`，或手动运行 **Build and publish browser demo** 工作流。
4. 工作流安装固定版本依赖、测试、构建并部署 `dist/`。完成后使用 Pages 显示的网站地址。

所有运行资源都随网站一起发布，没有 CDN 或远端计算请求。构建和部署不需要 MATLAB。仓库：[MAKKABAKK/matlab-browser-demo](https://github.com/MAKKABAKK/matlab-browser-demo)。网站：[正态随机数](https://makkabakk.github.io/matlab-browser-demo/random.html) · [热扩散](https://makkabakk.github.io/matlab-browser-demo/)。

## 文件与数据流

```text
web/                  参数界面、Worker、绘图及只读源码浏览
matlab/               在浏览器中执行的 MATLAB 函数
scripts/              构建、预览、构建检查及 MATLAB 基准生成
tests/                参数/结果测试、浏览器验收、MATLAB 数值基准
dist/                 生成的网站，包含同站托管的 RunMat 资源
```

页面校验数字参数 → Worker 加载 `.m` 文件到内存文件系统 → RunMat 执行 `heat_demo` → MATLAB `jsonencode` 返回数值 → 网页验证形状并绘制 Canvas 热力图与 SVG 曲线。

Worker 与页面之间传递 `run` 请求和 `loading`、`progress`、`computing`、`result`、`error` 消息；每次请求携带编号。Worker 每次运行创建新会话，重复运行可复用已经编译的 WebAssembly。停止时直接终止 Worker。

## 参数与结果

| 参数 | 默认 | 范围 |
| --- | --- | --- |
| 每边网格节点数 | 61 | 整数 11–81 |
| 模拟步数 | 300 | 整数 1–500 |
| 扩散系数 / 无量纲步长比 | 0.20 | 0.01–0.25 |
| 边界与环境温度 | 20°C | 固定 |

两幅热力图共用色标，范围为 20°C 到初始峰值；y 方向与 MATLAB 网格一致。曲线显示每一步的峰值和平均温度。“剩余相对热能”为当前高于环境温度的温差总和与初始值之比。“半冷却”以相对环境温度的峰值降低一半为条件，未达到时明确显示未达到。

## 兼容性与资源大小

- 固定使用 RunMat **0.6.2**，计算采用 CPU 模式，关闭 JIT、GPU 加速和遥测；不要求 WebGPU。
- RunMat 是第三方 MATLAB 语法运行器，并非 MathWorks MATLAB。本 Demo 只验证这组代码，不提供任意 `.m` 上传或编辑，也不保证其他工具箱兼容。
- 计算模块约 **69.3 MB（未压缩）**。首屏不加载；首次运行显示进度。后续加载取决于浏览器缓存和主机配置。构建中省略了不需要的编辑器语言服务。
- 适配保留在 MATLAB 源码中：边界索引向量和结构字段下标使用显式索引；温差用逻辑索引截断负值；采用运行器默认 `runmat` 兼容模式，以支持其内部驻留数组读取。
- RunMat 在较大数组下可能复用输入存储，因此完成模拟后重新生成确定性的初始温度，用于初始图。该处理不改变扩散结果，并已与 MATLAB 的完整矩阵对照。
- 初始化超过 180 秒或计算超过 60 秒会终止，用户可减少参数或重试。

## 验证

基本检查：

```sh
npm test
npm run build
node scripts/check-build.mjs
```

真实浏览器验收（先保持 `npm run preview` 运行）：

```sh
python3 scripts/check-browser.py --browser chrome
# WebKit 首次使用前需安装测试浏览器：
npx --yes --package @playwright/cli playwright-cli install-browser webkit
python3 scripts/check-browser.py --browser webkit
```

脚本使用 Playwright CLI，不向网站引入测试框架。报告及截图在 `output/playwright/<browser>/`；测试基准通过拦截的本地测试请求提供，不会打包到网站。

浏览器验收覆盖首屏延迟加载、默认参数、参数边界、重复运行、加载/计算取消、HTTP 503 后重试、真实 MATLAB 脚本错误后重试、只读源码、手机布局，以及无远端请求和无未处理页面错误。

数值基准来自 MATLAB R2026a，覆盖 `(61,300,0.20)`、`(11,1,0.01)`、`(81,500,0.25)`、`(31,100,0.10)` 四组参数，对全部矩阵、曲线和指标逐项比较，容差为 `1e-8 + 1e-8 × abs(参考值)`。更新算法后，在安装 MATLAB 的机器中运行：

```matlab
run('scripts/generate_reference.m')
```

该步骤会重新生成基准并运行 MATLAB 代码分析。普通安装、测试和部署使用已提供的基准，无需 MATLAB。

RunMat 的许可和声明随网站提供于 `RUNMAT-LICENSE.txt` 与 `THIRD-PARTY-NOTICES.txt`。
