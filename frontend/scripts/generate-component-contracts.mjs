import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const entries = [];
const nativeInputs = new Set(['Input', 'Select', 'Textarea', 'Element']);

for (const file of program.getSourceFiles()) {
  const relative = path.relative(root, file.fileName);
  if (!relative.startsWith('src/components/') || !relative.endsWith('.tsx')) continue;
  for (const node of file.statements) {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const name = node.name.text;
    const parameter = node.parameters[0];
    const signature = parameter ? checker.getTypeAtLocation(parameter) : null;
    const moduleSymbol = checker.getSymbolAtLocation(file);
    const declaredProps = moduleSymbol && checker.getExportsOfModule(moduleSymbol)
      .some((item) => item.name === `${name}Props`);
    const props = nativeInputs.has(name) || !signature ? [] : signature.getProperties().map((property) => {
      const type = checker.getTypeOfSymbolAtLocation(property, parameter);
      return {
        name: property.name,
        optional: Boolean(property.flags & ts.SymbolFlags.Optional),
        type: checker.typeToString(type, parameter, ts.TypeFormatFlags.NoTruncation),
        callback: checker.getNonNullableType(type).getCallSignatures().length > 0,
      };
    });
    entries.push({
      component: name,
      source: relative,
      propsType: declaredProps ? `${name}Props` : parameter?.type?.getText(file) ?? null,
      exportedProps: Boolean(declaredProps) || !parameter,
      nativeHtmlProps: nativeInputs.has(name),
      connected: /from ["']@\/hooks\/use(?:Foundy|Dashboard|Checklist|Report|Docs|Grants|Profile|Onboarding|Chat|Sites)["']/.test(file.text),
      props,
    });
  }
}

entries.sort((a, b) => a.source.localeCompare(b.source));
const missing = entries.filter((entry) => !entry.exportedProps);
const lines = [
  '# 컴포넌트 Props 목록',
  '',
  '`npm run docs:props`로 실제 TypeScript 선언에서 생성합니다. 데이터와 이벤트 콜백은 별도 필드입니다.',
  '페이지 데이터 계약과 Promise/스켈레톤 사용법은 [API 연결 가이드](./api-props-and-loading.md)를 참고하세요.',
  '',
  `총 ${entries.length}개 컴포넌트. 상세 필드 타입: [component-props.json](./component-props.json).`,
  '',
  '| 컴포넌트 | 공개 Props 타입 | 입력 필드 | 상태 연결 |',
  '| --- | --- | --- | --- |',
  ...entries.map((entry) => {
    const fields = entry.nativeHtmlProps ? 'React HTML 속성' : entry.props.map((prop) => `${prop.name}${prop.optional ? '?' : ''}${prop.callback ? ' (콜백)' : ''}`).join(', ') || '없음';
    return `| [${entry.component}](../${entry.source}) | ${entry.propsType ? `\`${entry.propsType.replaceAll('|', '\\|')}\`` : '없음'} | ${fields.replaceAll('|', '\\|')} | ${entry.connected ? 'Page / Connected 어댑터' : 'props / UI 상태'} |`;
  }),
  '',
];

await fs.mkdir(path.join(root, 'docs'), { recursive: true });
await fs.writeFile(path.join(root, 'docs/component-props.json'), `${JSON.stringify(entries, null, 2)}\n`);
await fs.writeFile(path.join(root, 'docs/component-props.md'), lines.join('\n'));
console.log(JSON.stringify({ components: entries.length, missingPublicProps: missing.map((entry) => entry.source) }, null, 2));
if (missing.length) process.exitCode = 1;
