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
