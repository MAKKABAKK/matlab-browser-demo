import assert from 'node:assert/strict';
import { readFile, access, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_FILES } from '../web/js/model.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
for (const directory of ['web/js', 'scripts']) {
  for (const file of await readdir(path.join(root, directory))) {
    if (/\.m?js$/.test(file)) execFileSync(process.execPath, ['--check', path.join(root, directory, file)]);
  }
}
for (const file of ['marginal.html', 'js/marginal.js', 'js/marginal-model.js', 'js/marginal-compute.js', 'js/marginal-worker.js', 'matlab/Marginal_FullCollapsed.m', 'random.html', 'js/random.js', 'matlab/untitled.m', 'matlab/untitled-original.m', 'index.html', 'style.css', 'favicon.svg', '.nojekyll', 'RUNMAT-LICENSE.txt', 'THIRD-PARTY-NOTICES.txt', 'js/app.js', 'js/model.js', 'js/worker.js', 'js/charts.js', 'vendor/runmat/index.js', 'vendor/runmat/pkg-web/runmat_wasm_web.js']) await access(path.join(dist,file));
for (const file of [...SOURCE_FILES, 'Marginal_FullCollapsed.m']) assert.deepEqual(await readFile(path.join(dist,'matlab',file)),await readFile(path.join(root,'matlab',file)));
const wasm = await readFile(path.join(dist,'vendor/runmat/pkg-web/runmat_wasm_web_bg.wasm'));
assert.ok(WebAssembly.validate(wasm), 'Published WASM must be executable');
assert.equal(wasm.length, 69266559);
await assert.rejects(access(path.join(dist,'vendor/runmat/lsp')));
const html = await readFile(path.join(dist,'index.html'),'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (match[1].startsWith('#') || match[1]==='./') continue;
  assert.ok(match[1].startsWith('./'), 'Page assets must use repository-relative paths');
  await access(path.resolve(dist,match[1]));
}
// 检查运行器保留的所有静态模块引用，防止删掉间接依赖。
async function checkImports(directory) {
  for (const name of await readdir(directory)) {
    const file=path.join(directory,name);
    if ((await stat(file)).isDirectory()) await checkImports(file);
    else if (name.endsWith('.js')) {
      const text=await readFile(file,'utf8');
      for (const match of text.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) await access(path.resolve(directory,match[1]));
    }
  }
}
await checkImports(path.join(dist,'vendor/runmat'));
console.log('Static build verified: relative URLs, MATLAB source, module dependencies, WASM and notices.');
