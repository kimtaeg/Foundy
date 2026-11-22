import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "docs/qa-component-inventory.md");
const relative = (file) => path.relative(root, file).split(path.sep).join("/");
const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const files = new Map(program.getSourceFiles().map((file) => [relative(file.fileName), file]));
const inventory = new Map();
const byDeclaration = new Map();
const dependencies = new Map();
const parentReferences = new Map();

const componentFiles = (await readdir(path.join(root, "src/components"), { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
  .map((entry) => relative(path.join(entry.parentPath, entry.name))).sort();
const entryFiles = (await readdir(path.join(root, "src/app"), { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^(page|layout|loading|error|not-found|global-error)\.tsx$/.test(entry.name))
  .map((entry) => relative(path.join(entry.parentPath, entry.name))).sort();

const routeOf = (file) => `/${file.slice("src/app/".length, file.lastIndexOf("/") + 1).replace(/\/$/, "")}`;
const fileKind = (file) => path.basename(file, ".tsx");
const inline = (value) => `\`${String(value).replaceAll("`", "'")}\``;
const linkedFile = (name, file) => `[${name}](../${file})`;
const unique = (items) => [...new Set(items)];
const orDash = (items) => items.length ? items.join(" · ") : "—";
const compact = (text, max = 65) => {
  const value = text.replace(/\s+/g, " ").trim();
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
};
const hasModifier = (node, kind) => node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;

function visit(node, inspect) {
  inspect(node);
  ts.forEachChild(node, (child) => visit(child, inspect));
}

function componentIn(node) {
  let jsx = false;
  visit(node, (child) => { if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) jsx = true; });
  return jsx;
}

function propsFor(parameter) {
  if (!parameter) return "—";
  const type = checker.getTypeAtLocation(parameter);
  const definedType = parameter.type?.getText();
  if (definedType && /(?:HTMLAttributes|ComponentProps|HTMLProps|ElementProps)/.test(definedType)) return inline(definedType);
  if (/^(InputProps|SelectProps|TextareaProps)$/.test(definedType ?? "")) return `${inline(definedType)} (표준 HTML 속성)`;
  const props = type.getProperties().map((property) => {
    const propertyType = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(property, parameter));
    const optional = property.flags & ts.SymbolFlags.Optional ? "?" : "";
    return `${inline(`${property.name}${optional}`)}${propertyType.getCallSignatures().length ? "↗" : ""}`;
  });
  if (props.length > 24 && definedType) return `${inline(definedType)} (${props.length}개 속성)`;
  return `${definedType && /^[\w]+$/.test(definedType) ? `${inline(definedType)} · ` : ""}${orDash(props)}`;
}

for (const source of componentFiles) {
  const file = files.get(source);
  if (!file) throw new Error(`TypeScript project omits ${source}`);
  const components = [];
  const add = (node, name, parameter, exported) => {
    if (!/^[A-Z]/.test(name) || (!exported && !componentIn(node))) return;
    const record = { source, name, node, parameter, exported, uses: new Set(), tags: new Set(), ids: new Set(), copy: new Set() };
    byDeclaration.set(node, record);
    components.push(record);
  };
  for (const statement of file.statements) {
    const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    if (ts.isFunctionDeclaration(statement) && statement.name) add(statement, statement.name.text, statement.parameters[0], exported);
    if (ts.isClassDeclaration(statement) && statement.name) add(statement, statement.name.text, statement.heritageClauses?.[0]?.types[0]?.typeArguments?.[0], exported);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
          add(declaration, declaration.name.text, declaration.initializer.parameters[0], exported);
        }
      }
    }
  }
  if (!components.length) throw new Error(`No component was recognized in ${source}`);
  inventory.set(source, components);
}

function sourceSymbol(node) {
  const original = checker.getSymbolAtLocation(node);
  if (!original) return undefined;
  return original.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(original) : original;
}

function sourceTargets(node) {
  return (sourceSymbol(node)?.declarations ?? []).map((declaration) => relative(declaration.getSourceFile().fileName));
}

function resolveImport(file, module) {
  const match = ts.resolveModuleName(module, file.fileName, parsed.options, ts.sys).resolvedModule;
  return match && relative(match.resolvedFileName);
}

function dynamicExports(file, call) {
  const target = resolveImport(file, call.arguments[0].text);
  if (!target?.endsWith("/index.ts")) return target ? [target] : [];
  const then = call.parent.parent;
  const handler = ts.isCallExpression(then) ? then.arguments[0] : undefined;
  if (handler && ts.isArrowFunction(handler) && ts.isPropertyAccessExpression(handler.body)) {
    return sourceTargets(handler.body.name);
  }
  return [target];
}

for (const [source, file] of files) {
  if (!source.startsWith("src/")) continue;
  const moduleTargets = new Set();
  const local = new Map();
  const addTargets = (node) => {
    const targets = sourceTargets(node).filter((target) => target.startsWith("src/") && target !== source);
    for (const target of targets) moduleTargets.add(target);
    if (targets.length) local.set(node.text, targets);
  };
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause && !statement.importClause.isTypeOnly) {
      const { name, namedBindings } = statement.importClause;
      if (name) addTargets(name);
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const item of namedBindings.elements) {
          if (!item.isTypeOnly && (sourceSymbol(item.name)?.flags & ts.SymbolFlags.Value)) addTargets(item.name);
        }
      } else if (namedBindings && ts.isNamespaceImport(namedBindings)) addTargets(namedBindings.name);
    }
    if (entryFiles.includes(source) && ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const item of statement.exportClause.elements) addTargets(item.name);
    }
  }

  visit(file, (node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const targets = dynamicExports(file, node);
      for (const target of targets) if (target.startsWith("src/")) moduleTargets.add(target);
      let enclosing = node.parent;
      while (enclosing && !ts.isVariableDeclaration(enclosing)) enclosing = enclosing.parent;
      if (enclosing && ts.isIdentifier(enclosing.name)) local.set(enclosing.name.text, targets);
    }
  });
  dependencies.set(source, moduleTargets);
  for (const target of moduleTargets) {
    if (!inventory.has(target)) continue;
    const parents = parentReferences.get(target) ?? new Set();
    parents.add(source);
    parentReferences.set(target, parents);
  }

  for (const record of inventory.get(source) ?? []) {
    visit(record.node, (node) => {
      if (ts.isIdentifier(node) && local.has(node.text)) {
        for (const target of local.get(node.text)) record.uses.add(target);
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(file);
        if (/^[A-Z]/.test(tag)) {
          const symbol = sourceSymbol(node.tagName);
          for (const declaration of symbol?.declarations ?? []) {
            const nested = byDeclaration.get(declaration);
            if (nested && nested.source === source && nested.name !== record.name) record.tags.add(nested.name);
          }
        } else if (/^(a|button|dialog|form|input|meter|nav|select|svg|table|textarea)$/.test(tag)) record.tags.add(`<${tag}>`);
      }
      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(file);
        if (ts.isStringLiteral(node.initializer ?? node) && /^(data-nx(?:-form)?|data-testid)$/.test(name)) {
          record.ids.add(`${name}=${node.initializer.text}`);
        }
        if (ts.isStringLiteral(node.initializer ?? node) && /^(aria-label|title|label)$/.test(name) && /[가-힣]/.test(node.initializer.text)) {
          record.copy.add(compact(node.initializer.text));
        }
      }
      if (ts.isJsxText(node) && /[가-힣]/.test(node.text)) record.copy.add(compact(node.text));
    });
  }
}

function trace(entry) {
  const reached = new Set();
  const remaining = [entry];
  while (remaining.length) {
    const file = remaining.pop();
    if (reached.has(file)) continue;
    reached.add(file);
    for (const target of dependencies.get(file) ?? []) remaining.push(target);
  }
  return reached;
}

const traces = new Map(entryFiles.map((file) => [file, trace(file)]));
const terminalPages = entryFiles.filter((file) => fileKind(file) === "page");
const testTargets = {
  "/": ["첫 진입 주소 정규화, 인증 여부에 따른 홈·로그인·초기 등록 분기", "routing-smoke.mjs"],
  "/login": ["ID 로그인, 회원가입, 입력 검증, 비밀번호 보기, 재시도, 세션 유지·로그아웃", "login.mjs", "api-integration.mjs"],
  "/register": ["가게 정보와 주소, 일정, 영업 조건, 이전 단계, 재개, 분석 SSE와 대시보드 진입", "api-integration.mjs", "functional-parity.mjs"],
  "/dashboard": ["개업 D-day, 진행률, 임박 항목, 점검 바로가기, 생활인구 그래프, 날짜와 접근성", "dashboard-bento.mjs", "dashboard-greeting.mjs", "preparation-ring-motion.mjs", "dashboard-data.mjs", "dashboard-population.mjs"],
  "/report": ["시기와 위험도, 접기, 근거 모달, 선택, 완료·취소, 영향 항목과 채팅", "api-integration.mjs", "disclosure-motion.mjs", "chat-api-integration.mjs"],
  "/checklist": ["기간/카테고리/달력, 필터, 준비 정보, 서류 링크, 체크 변경, 날짜 재계산, 캘린더 내보내기", "checklist-redesign.mjs", "api-integration.mjs", "disclosure-motion.mjs"],
  "/docs": ["발급 안내, 필터, 항목 상태, 단일 토글, 링크, 서류 상태 저장", "api-integration.mjs", "disclosure-motion.mjs", "functional-parity.mjs"],
  "/grants": ["저장 공고, 자격·분야 필터, 텍스트형 새로 조회, 결과 유지, 오류·재시도, 상세·외부 링크", "grants-integration.mjs", "api-view-contracts.mjs"],
  "/sites": ["주소·좌표, SDK·정적 데이터, 반경, 시간·분류, 점포, 통계, 로딩·오류·재시도", "market-map.mjs", "market-loading.mjs", "population-age-map.mjs", "market-calculations.mjs"],
  "/mypage": ["초기 등록, 인라인 편집, 토글, 날짜, 주소, 계정, 저장 실패 복구", "api-integration.mjs", "functional-parity.mjs"],
};

const apiInventory = [
  ["POST /api/auth/signup", "회원가입", "lib/api/auth.ts", "422 입력·409 아이디 중복과 폼 값 보존"],
  ["POST /api/auth/login", "아이디 로그인", "lib/api/auth.ts", "401 계정 정보 오류·429 제한·재시도"],
  ["POST /api/auth/logout", "공통 로그아웃", "lib/api/auth.ts", "실패해도 브라우저 세션·화면 정리"],
  ["POST /api/demo", "예시 계정 로그인 분기", "lib/auth/server-sign-in.ts", "오류 통지·세션 변경 여부"],
  ["GET /api/me", "세션 복구·초기 등록 판단", "hooks/useApiBridge.ts", "401 정리·500 시작 화면 재시도"],
  ["PATCH /api/me", "마이페이지 계정 이름", "lib/profile/save-server-profile.ts", "거절 시 이름 및 입력 복구"],
  ["POST /api/stores", "최초 가게 등록", "lib/onboarding/server-onboarding.ts", "주소 오류·중복 등록·스텝 유지"],
  ["GET /api/stores/{store_id}", "마이페이지·상권 위치·진행 중인 등록 복구", "lib/api/foundy-api.ts", "오류 표시·스켈레톤 종료·재조회"],
  ["PATCH /api/stores/{store_id}", "가게 정보·영업 조건·개업일 수정", "lib/profile/save-server-profile.ts", "충돌·유효성 오류·회귀 복구"],
  ["POST /api/stores/{store_id}/answers", "등록 중 영업 조건 저장", "lib/onboarding/server-onboarding.ts", "서버 거부·질문 값 유지"],
  ["POST /api/stores/{store_id}/analyze", "분석 시작", "lib/onboarding/server-onboarding.ts", "미입력·이미 실행 중·실패의 다음 행동"],
  ["GET /api/runs/{run_id}/stream", "등록·프로필·리포트 분석 진행 SSE", "lib/api/run-stream.ts", "error, 중단, 재개 및 완료 이벤트"],
  ["GET /api/runs/{run_id}", "분석 SSE 중단 시 폴링", "lib/api/run-stream.ts", "상태값과 실패 사유·시간 초과"],
  ["GET /api/stores/{store_id}/dashboard", "홈 통계·다음 할 일", "hooks/useDashboard.ts", "조회 실패·재시도·이전 데이터"],
  ["GET /api/stores/{store_id}/report", "판정·근거·선택지·다음 할 일", "hooks/useReport.ts", "조회 실패·재시도·빈 항목"],
  ["POST /api/stores/{store_id}/report/items/{item_id}/choose", "리포트 선택 확정", "hooks/useReportApiActions.ts", "충돌·재점검 실패·중복 저장"],
  ["POST /api/stores/{store_id}/report/items/{item_id}/action", "완료·완료 취소·메모", "hooks/useReportApiActions.ts", "거절 시 모달·완료 상태"],
  ["GET /api/stores/{store_id}/checklist", "체크리스트·캘린더", "hooks/useChecklist.ts", "조회 오류·현재 선택 필터"],
  ["PATCH /api/stores/{store_id}/checklist/{item_id}", "체크·해제", "hooks/useChecklistAlertActions.ts", "실패 복구·동시 저장·진행률 동기화"],
  ["GET /api/stores/{store_id}/documents", "서류함 목록과 상세 토글에 필요한 데이터", "hooks/useDocs.ts", "조회 오류·빈 상태·재시도"],
  ["PATCH /api/stores/{store_id}/documents/{doc_key}", "서류 상태 변경", "hooks/useChecklistAlertActions.ts", "실패 복구·상태 유지·변경된 목록 확인"],
  ["GET /api/stores/{store_id}/alerts", "상단 알림 목록", "hooks/useApiBridge.ts", "조회 실패 안내·알림 복구"],
  ["PATCH /api/stores/{store_id}/alerts/{alert_id}", "상단 알림 읽음", "hooks/useChecklistAlertActions.ts", "읽음 표시와 카운트 실패 복구"],
  ["GET /api/stores/{store_id}/grants", "지원사업 저장 결과", "hooks/useGrants.ts", "조회 실패·미조회·조건이 없는 상태"],
  ["POST /api/stores/{store_id}/grants/refresh", "지원사업 실시간 조회", "hooks/useGrants.ts", "HTTP 오류와 성공 응답 내 오류·이전 목록 보존"],
  ["GET /api/chat/sessions", "최신 상담 세션 및 대화 이력", "hooks/useServerChat.ts", "404·401·500·재시도"],
  ["GET /api/chat/sessions/{session_id}/messages", "이전 상담 응답 계약 호환", "hooks/useServerChat.ts", "실패 시 오작동 없는 복구"],
  ["POST /api/chat/sessions", "세션 생성", "lib/chat/run-turn.ts", "생성 실패 및 원래 질문 재전송"],
  ["POST /api/chat/sessions/{session_id}/messages", "AI 상담 SSE", "lib/chat/run-turn.ts", "HTTP 오류와 SSE 오류, 연결 중단, 취소 후 복구"],
  ["/data/foot-traffic/*", "격자·도로·시간별 통계 정적 파일", "lib/foot-traffic/data-loader.ts", "404·파싱·빈 데이터·재시도"],
  ["Kakao 지도 SDK·주소 검색", "상권 지도와 주소 입력", "lib/kakao-postcode.ts", "스크립트 로드 실패·주소 미선택"],
];

function routeLine(file) {
  const route = routeOf(file);
  const tests = testTargets[route];
  const loading = file.replace(/page\.tsx$/, "loading.tsx");
  return `- [ ] ${linkedFile(inline(route), file)} ${tests?.[0] ?? "페이지별 시나리오를 추가하세요."} · ${traces.get(file).size - 1}개 코드 모듈 참조 · ${entryFiles.includes(loading) ? linkedFile("로딩", loading) : "공통 로딩"}${tests ? ` · ${tests.slice(1).map((test) => linkedFile(test, `tests/${test}`)).join(", ")}` : ""}`;
}

function intent(record) {
  const role = [
    [/Skeleton|Placeholder/, "로딩 자리 표시"], [/Boundary/, "화면 경계"], [/Dialog|Modal|Popover/, "팝업과 열림 상태"],
    [/Filter|Tabs/, "필터 또는 보기 전환"], [/Button|Control/, "사용자 동작"], [/Badge|Legend|Tooltip/, "상태·기준 표시"],
    [/Page/, "페이지 데이터 연결"], [/View|Workspace|Panel/, "화면과 하위 영역 조합"], [/Form|Field|Select|Picker/, "입력과 검증 상태"],
    [/Chart|Ring|Bar|Progress/, "수치와 그래프 표시"], [/Header|Heading|Brand/, "제목과 안내"], [/List|Row|Item|Card/, "목록 또는 항목 표시"],
  ].find(([pattern]) => pattern.test(record.name))?.[1] ?? "하위 UI 또는 상태 표현";
  const keys = [...record.ids].slice(0, 4).map(inline);
  const copy = [...record.copy].slice(0, 2).map(inline);
  const tags = [...record.tags].slice(0, 5).map(inline);
  return [role, ...copy, ...tags, ...keys].join(" · ");
}

const groups = new Map();
const unused = [];
let declarationCount = 0;
for (const [source, records] of inventory) {
  const group = source.split("/")[2];
  const groupLines = groups.get(group) ?? [];
  const roots = [...traces].filter(([, reach]) => reach.has(source)).map(([entry]) => entry);
  const routeNames = unique(roots.filter((entry) => fileKind(entry) === "page").map(routeOf));
  const refs = [...(parentReferences.get(source) ?? [])].filter((file) => inventory.has(file) || file.startsWith("src/app/"));
  const context = [...routeNames.map(inline), ...(roots.some((entry) => fileKind(entry) === "layout") ? ["공통 레이아웃"] : []), ...roots.filter((entry) => fileKind(entry) === "loading").map((entry) => `${inline(routeOf(entry))} 로딩`)];
  if (!roots.length) unused.push(source);

  for (const record of records) {
    declarationCount++;
    const location = `${source}#L${files.get(source).getLineAndCharacterOfPosition(record.node.getStart()).line + 1}`;
    const direct = [...record.uses].sort().filter((target) => !target.startsWith("src/data/") || !target.endsWith(".json"));
    const children = direct.filter((target) => inventory.has(target));
    const data = direct.filter((target) => !inventory.has(target));
    const link = (file) => linkedFile(inline(path.basename(file, path.extname(file))), file);
    groupLines.push(
      `- [x] ${linkedFile(record.name, location)}${record.exported ? "" : " (파일 내부)"} · ${intent(record)}`,
      `  - Props ${propsFor(record.parameter)}`,
      `  - 연결 ${orDash(data.map(link))} / 하위 ${orDash(children.map(link))}`,
      `  - 참조 ${context.length ? context.join(", ") : "페이지 연결 없음 · 보관/미사용 후보"} / 상위 ${orDash(refs.sort().map(link))}`,
    );
  }
  groups.set(group, groupLines);
}

const unknownRoutes = terminalPages.map(routeOf).filter((route) => !(route in testTargets));
if (unknownRoutes.length) throw new Error(`Missing QA scenarios for ${unknownRoutes.join(", ")}`);

const lines = [
  "# 페이지·컴포넌트 QA 체크리스트",
  "",
  `컴포넌트 파일 ${componentFiles.length}개, 컴포넌트 선언 ${declarationCount}개, 페이지 ${terminalPages.length}개, 앱 진입 파일 ${entryFiles.length}개를 읽었습니다. 페이지 진입점에서 참조되지 않은 컴포넌트 파일은 ${unused.length}개입니다.`,
  "",
  "체크된 컴포넌트는 소스, Props, 모듈 연결을 정적으로 대조한 항목입니다. 아래 페이지 체크박스는 실제 기능 검증 항목이며 테스트 링크는 실행 대상입니다. 브라우저 실행 결과와 개별 오류 재현 여부는 [QA 실행 보고서](./qa-execution.md)에서 확인합니다. 공통 레이아웃의 참조는 권한이나 화면 상태에 따라 조건부로 렌더링됩니다. `↗`는 콜백입니다.",
  "",
  "다시 만들려면 `node scripts/generate-qa-component-inventory.mjs`를 실행하세요. `--check`를 붙이면 같은 소스에서 체크리스트가 재현되는지 확인합니다. 동적 지도 import, barrel을 거치는 값 참조, 루트 페이지 재내보내기, 내부 JSX 선언을 포함합니다.",
  "",
  "## 페이지와 공통 흐름",
  "",
  ...terminalPages.map(routeLine),
  `- [ ] ${linkedFile("공통 셸", "src/app/layout.tsx")} 브레드크럼, 네비게이션·드롭다운, 알림 읽음, 모달 포커스, 토스트, 권한 복구 · ${linkedFile("네비게이션 테스트", "tests/navbar-regression.mjs")} · ${linkedFile("로딩 테스트", "tests/page-loading.mjs")}`,
  `- [ ] ${linkedFile("공통 상담", "src/components/chat/ConnectedChatWidget/ConnectedChatWidget.tsx")} 세션 복구·재시도, 첫 답변, 중단·재전송, 출처·추천 행동, POST JSON/SSE 오류 · ${linkedFile("API 브라우저 테스트", "tests/chat-api-integration.mjs")} · ${linkedFile("위젯 테스트", "tests/chat-widget.mjs")}`,
  "- [ ] 교차 상태 API 지연과 취소, 네트워크 끊김, 400·401·403·404·409·422·429·500, JSON이 없는 실패, 저장 중 이동과 로그아웃, 반응형과 reduced motion",
  "",
  "## API와 예외 화면 확인 대상",
  "",
  "동일한 앱 코드가 여러 화면을 갱신하는 경로도 호출 단위로 나열했습니다. 아래 예외 목록은 호출별 브라우저 검증을 위한 할 일입니다.",
  "",
  ...apiInventory.map(([endpoint, feature, source, scenarios]) => `- [ ] ${inline(endpoint)} · ${feature} · ${linkedFile("연결 코드", `src/${source}`)} · ${scenarios}`),
  "",
  "건강 상태, 소셜 로그인, 법령 검색/동기화, 법령 의무 목록, 변경 이력, 단일 서류 상세, 상담 세션 삭제는 브라우저 연결을 찾지 못한 백엔드 경로입니다. 체크리스트·서류함의 재검토 확인과 수정 영향 미리보기는 프론트 호출 헬퍼를 통해 활용할 수 있는 계약입니다. 현재 브라우저에서 각 기능을 실행하는 연결은 찾지 못했습니다.",
  "",
  "## 컴포넌트별 소스 점검",
  "",
  ...[...groups].flatMap(([name, rows]) => [`### ${name}`, "", ...rows, ""]),
];

const content = `${lines.join("\n").trimEnd()}\n`;
if (process.argv.includes("--check")) {
  if (await readFile(output, "utf8") !== content) throw new Error("QA inventory differs from the TypeScript sources");
} else {
  await writeFile(output, content);
}
console.log(`QA inventory verified: ${componentFiles.length} component files, ${declarationCount} component declarations, ${terminalPages.length} pages, ${entryFiles.length} entry files, ${unused.length} files without a route reference.`);
