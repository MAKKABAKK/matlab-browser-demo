# MATLAB 浏览器热扩散 Demo

独立静态测试网站。用户调整参数后，浏览器通过 RunMat 执行本项目中的 `.m` 文件，显示温度分布、冷却曲线和数值结果。无需安装 MATLAB、登录账户或使用计算服务器。

本项目没有接入或修改旁边的 `matlab-web-demo` 网站。

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

所有运行资源都随网站一起发布，没有 CDN 或远端计算请求。构建和部署不需要 MATLAB。当前交付只提供项目和发布配置，尚未创建或发布远端仓库。

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
