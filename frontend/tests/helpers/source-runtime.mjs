import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
const nodeRequire = createRequire(path.join(root, 'package.json'));

function resolveLocal(request, parent = path.join(root, 'entry.ts')) {
  const target = request.startsWith('@/')
    ? path.join(root, 'src', request.slice(2))
    : path.resolve(path.dirname(parent), request);
  for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}.js`, path.join(target, 'index.ts'), path.join(target, 'index.tsx')]) {
    if (existsSync(candidate) && /(?:\.[cm]?[jt]sx?|\.module\.css)$/.test(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve ${request} from ${parent}`);
}

function source(file) {
  const text = readFileSync(file, 'utf8');
  if (file.endsWith('.module.css')) {
    const classes = Array.from(text.matchAll(/\.([a-zA-Z_][\w-]*)/g), ([, name]) => [name, name]);
    return 'module.exports = ' + JSON.stringify(Object.fromEntries(classes)) + ';';
  }
  return /\.tsx?$/.test(file)
    ? ts.transpileModule(text, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
        fileName: file,
      }).outputText
    : text;
}

/** Run the actual TSX implementation with the installed React, without a provider. */
export function createSourceRuntime() {
  const cache = new Map();
  function load(request, parent) {
    if (!request.startsWith('@/') && !request.startsWith('.') && !path.isAbsolute(request))
      return nodeRequire(request);
    const file = resolveLocal(request, parent);
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const compiled = vm.runInThisContext(`(function(module,exports,require,__filename,__dirname){${source(file)}\n})`, { filename: file });
    compiled(loadedModule, loadedModule.exports, (next) => load(next, file), file, path.dirname(file));
    return loadedModule.exports;
  }
  return { load };
}

/** A small CommonJS test bundle; no dependencies or production test routes are added. */
export function browserBundle(entries) {
  const files = new Map();
  const collect = (request, parent = path.join(root, 'entry.ts')) => {
    const file = request.startsWith('@/') || request.startsWith('.') || path.isAbsolute(request)
      ? resolveLocal(request, parent)
      : createRequire(parent).resolve(request);
    if (files.has(file)) return file;
    const code = source(file);
    const entry = { code, dependencies: {} };
    files.set(file, entry);
    for (const [, dependency] of code.matchAll(/\brequire\(["']([^"']+)["']\)/g))
      entry.dependencies[dependency] = collect(dependency, file);
    return file;
  };
  const exports = Object.fromEntries(Object.entries(entries).map(([name, request]) => [name, collect(request)]));
  const modules = [...files].map(([file, entry]) => `${JSON.stringify(file)}:[function(module,exports,require){\n${entry.code}\n},${JSON.stringify(entry.dependencies)}]`).join(',\n');
  return `(() => {
    const process = { env: { NODE_ENV: 'development' } };
    const modules = {${modules}};
    const cache = {};
    const load = (id) => {
      if (cache[id]) return cache[id].exports;
      const module = cache[id] = { exports: {} };
      const [run, dependencies] = modules[id];
      run(module, module.exports, (request) => load(dependencies[request]));
      return module.exports;
    };
    window.contractModules = Object.fromEntries(Object.entries(${JSON.stringify(exports)}).map(([name,id]) => [name,load(id)]));
  })();`;
}
