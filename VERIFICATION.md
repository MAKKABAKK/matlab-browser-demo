# 验证记录

验证日期：2026-09-22。运行器：RunMat 0.6.2；数值参考：本机 MATLAB R2026a。

## 已完成

- MATLAB 生成四组数值基准，全部 `.m` 文件通过 `checkcode`。
- `npm test`：5 项测试通过，覆盖参数边界、调用参数校验、结果形状、稳定扩散约束和热力图方向。
- `npm run build` 与 `node scripts/check-build.mjs`：通过。验证了源码复制、模块引用、WebAssembly 可执行性、相对路径及第三方声明。
- Chrome 和 Playwright WebKit：各 28 项浏览器验收通过，没有未处理页面错误。
- macOS Safari：通过原生界面实际运行默认案例，显示初始峰值 97.685°C、最终峰值 34.011°C、剩余热能 88.95%，并生成两幅热力图及曲线。
- 桌面 1440×900 和手机 390×844 布局已检查，无横向溢出；手机曲线坐标文字保持可读尺寸。
- 加载阶段停止、计算阶段停止、HTTP 503 后重试、MATLAB 脚本错误后重试均通过。新运行和参数更改不会保留旧结果。
- 网络验收确认首屏没有运行器请求，运行时仅请求同源资源，没有远端计算请求。
- 原有 `matlab-web-demo` 仓库无 tracked 文件差异；原先存在的 `matlab/untitled.m` 未修改。

## 完整数值对照

每个浏览器均逐项检查初始/最终温度矩阵、全部曲线和标量结果。容差：`1e-8 + 1e-8 × abs(参考值)`。

| 网格 / 步数 / 系数 | 比较数值数量 | 最大绝对误差 |
| --- | ---: | ---: |
| 61 / 300 / 0.20 | 8,654 | 7.28 × 10⁻¹¹ |
| 11 / 1 / 0.01 | 258 | 1.14 × 10⁻¹³ |
| 81 / 500 / 0.25 | 15,134 | 1.78 × 10⁻¹⁰ |
| 31 / 100 / 0.10 | 2,334 | 7.28 × 10⁻¹² |

每个浏览器共比较 26,380 个数值，全部通过。

原始报告和截图位于本机 `output/playwright/chrome/` 与 `output/playwright/webkit/`，可按照 README 中的命令重新生成。

## 验证边界

已创建独立仓库 [MAKKABAKK/matlab-browser-demo](https://github.com/MAKKABAKK/matlab-browser-demo)，并通过 GitHub Actions 发布到 GitHub Pages。验证结论只针对本 Demo 的热扩散和正态随机数代码，不代表任意 MATLAB 程序都兼容。

## 2026-09-23：正态随机数接入与线上部署

- 新仓库：https://github.com/MAKKABAKK/matlab-browser-demo
- 正态随机数页面：https://makkabakk.github.io/matlab-browser-demo/random.html
- 网站通过 GitHub Actions 构建和部署；原有网站未改动。
- 本地 Chrome、WebKit 正态随机数各 16 项验收通过：100 个有限样本、均值独立重算、100 个图表数据点、重新生成不同样本、资源加载后离线运行、停止、源码 HTTP 503 后恢复、手机布局、同源请求和无未处理页面错误。
- GitHub Pages 上 WebKit 正态随机数完整 16 项通过。Chrome 在线正常运行、独立均值校验、绘图、离线重新生成、手机布局和停止通过；最后一次下载遇到 `Failed to fetch`，页面显示错误。随后单独点击重试恢复成功，返回 100 个样本，记录于 `output/playwright/chrome-random-remote/recovery.json`。不将首次网络失败的整轮报告记为全通过。
- 热扩散本地 Chrome 28 项回归重新通过；GitHub Pages 上 WebKit 的四组完整数值共 26,380 个值全部与 MATLAB R2026a 基准一致。线上额外的重复下载压力检查也遇到网络失败，未宣称该整轮通过。
- 发布代码修复了 GitHub 压缩响应下下载进度提前达到 100% 的问题；压缩传输显示实际已加载数据量。测试等待时间与页面的 180 秒初始化时限保持一致。
- 线上首次下载在本次网络环境约需 1–2 分钟；运行器仍须自动下载，用户无需手动安装。连续重新生成可复用内存中的运行器。
- 线上报告目录带 `-remote` 后缀，与本地报告分开。测试脚本同样隔离本地和线上会话；建议依次运行，避免同时下载多份运行器影响加载时间。

本案例保留 `normrnd(0, sigma2)`、循环 100 次和 `mean(X)`，其中 `sigma2=3` 表示标准差。执行版本只将 `plot(X)` 改为网页绘图；原始文件另存。随机样本不与 MATLAB 的随机序列逐项比较。

## 2026-09-23：Marginal_FullCollapsed 可调参数网页

- 网址：https://makkabakk.github.io/matlab-browser-demo/marginal.html
- 原始文件 `matlab/Marginal_FullCollapsed.m` 与用户下载目录中的原文件逐字节一致。发布后的 HTML、计算 JavaScript 和原始 MATLAB 文件与本地构建逐字节一致；首页已经提供入口。
- 可编辑 N、ChainLength、初始 alpha、sigmaX2、A2，保留原始默认 600 / 1000 / 1 / 1 / 30。页面显示完整 alpha 轨迹、三组参考线以及最后分组的人数和抽样均值。
- 本页使用 JavaScript 等价算法在 Web Worker 中计算，不调用 Python、不提交远端计算请求、不加载 RunMat。原有热扩散和正态随机数仍使用 RunMat。
- `npm test` 共 12 项通过：新增四组 MATLAB R2026a 原始全扫描算法记录回放、参数与结果完整性、正态/Gamma/Beta 抽样矩、默认规模和参数边界；保留原热扩散五项检查。
- 回放基准的 N / 迭代次数分别为 12/8、40/10、4/1、20/5。逐次检查随机抽样类型、Gamma/Normal 参数及输出状态（分组、完整 alpha 轨迹、均值、人数、参考根），使用容差 `1e-8 + 1e-8*abs(reference)`。它验证同一随机输入下的算法对应关系，不声称 JavaScript 与 MATLAB 日常生成相同的随机序列。
- MATLAB 内另外对比原全扫描与维护统计量版本，12/8、40/10、600/20 三组通过。随机抽样矩检查每个分布使用 120,000 个样本。
- 本地 Chrome、WebKit 各 30 项浏览器验收通过；GitHub Pages 上两者也各 30 项通过。覆盖默认完整规模、修改参数、再次生成、非法参数、恢复默认、真实后台计算停止、单次迭代、小样本正参考根、手机布局、加载失败后重试、请求同源与无未处理错误。
- 线上 chrome 在本机执行默认 600 个样本 / 1000 次迭代，纯计算耗时 0.110 秒；耗时不代表所有设备。
- 线上 webkit 在本机执行默认 600 个样本 / 1000 次迭代，纯计算耗时 0.197 秒；耗时不代表所有设备。
- 新报告位于 `output/playwright/chrome-marginal-remote/` 与 `output/playwright/webkit-marginal-remote/`。截图已检查桌面和 390px 手机布局。
- 兼容性差异明确写在网页和 README：分类抽样用均匀随机数、Beta 用 Gamma 比值，参考根用正数区间二分求解。原 `fzero(...,0.5)` 在 N=4 的测试中返回了负值奇点附近的结果，因此 MATLAB 对照参考同样用正数括区间，原始用户文件未改动。
- RunMat 可行性测试缺少 mnrnd、betarnd，适配后的 600 样本/2 次迭代约 4.25 秒，因而本页采用轻量 JavaScript 移植。未将该页描述为直接执行 `.m`。

## 2026-09-24: RunMat MATLAB execution

This supersedes the earlier JavaScript MCMC implementation and its timing measurements.

- Production executes `matlab/Marginal_FullCollapsed_browser.m` in RunMat 0.6.2 WebAssembly. The original MATLAB file is retained unchanged. The JavaScript numerical reference is now test-only and excluded from the website.
- Four MATLAB R2026a random-stream replay fixtures pass against the actual WASM, checking sampler parameters, complete results, and iteration progress. This check runs in deployment CI.
- Native MATLAB comparisons passed for sample/iteration counts 12/8, 40/10 and 600/20.
- Local Chrome and WebKit each passed all 34 browser checks, including actual MATLAB execution, parameter changes, runtime reuse, cancellation, mobile layout, and recovery from an injected MATLAB error.
- Completed browser runs include 60/20, 600/10 and 12/1000. The default 600/1000 was checked for startup, progress and cancellation, not completion.
- Chrome computation times for those completed runs were approximately 4.96, 38.98 and 86.31 seconds. The full default may take tens of minutes or longer. A user-selected small preset is available; original defaults are preserved.
- Published commit `905385d`: GitHub Actions run `35955390607` passed all test, WASM reference, build and deployment steps. Online Chrome passed all 34 checks at https://makkabakk.github.io/matlab-browser-demo/; completed 60/20, 600/10 and 12/1000 in approximately 5.11, 40.56 and 92.09 seconds. WebKit verification above was local.
- Downloaded production worker and adapted MATLAB source match the tested files byte-for-byte. Original source matches the supplied file. The old published `js/marginal-compute.js` returns HTTP 404.
