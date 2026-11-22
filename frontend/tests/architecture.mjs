import assert from "node:assert/strict";
import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const source = path.join(project, "src");
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : path.join(directory, entry.name),
      ),
    )
  ).flat();
}
const config = ts.readConfigFile(
  path.join(project, "tsconfig.json"),
  ts.sys.readFile,
);
const { options } = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  project,
);
const errors = [];
const graph = new Map();
let components = 0;
for (const file of await files(source)) {
  if (!/\.tsx?$/.test(file)) continue;
  const relative = path.relative(source, file);
  const text = await readFile(file, "utf8");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (/(^|\/)(models|controllers|features|application)\//.test(relative))
    errors.push(`${relative}: use the conventional source directories`);
  if (
    /DOMParser|dangerouslySetInnerHTML|\.innerHTML\s*=|html-react-parser/.test(
      text,
    )
  )
    errors.push(
      `${relative}: screen rendering must use native React components`,
    );
  if (relative.startsWith("components/") && file.endsWith(".tsx")) {
    components++;
    const exported = ast.statements.filter(
      (node) =>
        node.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        ) &&
        (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)),
    );
    if (exported.length !== 1)
      errors.push(`${relative}: expected exactly one exported component`);
    try {
      await access(path.join(path.dirname(file), "index.ts"));
    } catch {
      errors.push(`${relative}: missing component index.ts entrypoint`);
    }
  }
  const dependencies = [];
  for (const node of ast.statements) {
    if (
      (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) ||
      !node.moduleSpecifier ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const from = node.moduleSpecifier.text;
    if (relative.startsWith("components/") && from === "@/components")
      errors.push(
        `${relative}: internal components must not import their root barrel`,
      );
    const resolved = ts.resolveModuleName(from, file, options, ts.sys)
      .resolvedModule?.resolvedFileName;
    if (resolved?.startsWith(source)) dependencies.push(resolved);
    if (
      /^(lib|data|types)\//.test(relative) &&
      resolved &&
      /^(components|hooks|providers|app)\//.test(
        path.relative(source, resolved),
      )
    )
      errors.push(`${relative}: lower-level code depends on UI (${from})`);
  }
  graph.set(file, dependencies);
}
// Inspect transitive imports as well: an indirect helper must not hide a store dependency.
for (const file of graph.keys()) {
  if (
    !/^components\/(ui|navigation|common)\//.test(path.relative(source, file))
  )
    continue;
  const seen = new Set();
  const visit = (current) => {
    if (seen.has(current)) return;
    seen.add(current);
    const relative = path.relative(source, current);
    if (
      /^(providers|lib\/store)\/|^hooks\/use(Foundy|FeatureData)/.test(relative)
    )
      errors.push(
        `${path.relative(source, file)}: reusable UI depends on application state (${relative})`,
      );
    for (const dependency of graph.get(current) ?? []) visit(dependency);
  };
  visit(file);
}
const visited = new Set();
const stack = new Set();
function checkCycle(file) {
  if (stack.has(file)) {
    errors.push(`Circular dependency: ${path.relative(source, file)}`);
    return;
  }
  if (visited.has(file)) return;
  visited.add(file);
  stack.add(file);
  for (const dependency of graph.get(file) ?? []) checkCycle(dependency);
  stack.delete(file);
}
for (const file of graph.keys()) checkCycle(file);
const packageJson = JSON.parse(
  await readFile(path.join(project, "package.json"), "utf8"),
);
assert.equal(
  packageJson.dependencies["html-react-parser"],
  undefined,
  "Retired HTML parser dependency remains",
);
assert.deepEqual(errors, [], errors.join("\n"));
console.log(
  `Architecture checks passed: ${components} component files, conventional directories, no cycles, independent reusable UI.`,
);
