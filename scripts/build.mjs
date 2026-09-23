import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'dist');
const runtime = path.join(root, 'node_modules/runmat');
const manifest = JSON.parse(await readFile(path.join(runtime, 'package.json'), 'utf8'));
if (manifest.version !== '0.6.2') throw new Error('Expected RunMat 0.6.2');
await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
await mkdir(target, { recursive: true });
await cp(path.join(root, 'web'), target, { recursive: true });
await cp(path.join(root, 'matlab'), path.join(target, 'matlab'), { recursive: true });
// 保留原生模块相对路径，不发布编辑器语言服务和类型声明。
await cp(path.join(runtime, 'dist'), path.join(target, 'vendor/runmat'), {
  recursive: true,
  filter: (source) => !source.split(path.sep).includes('lsp')
    && !source.endsWith('.d.ts') && !source.endsWith('.map'),
});
await writeFile(path.join(target, '.nojekyll'), '');
console.log('Built static website: dist/');
