// 서울 생활인구(250m) 원본 → 앱용 정적 데이터
//
//   node scripts/foot-traffic/build-grid.mjs csv --boundary <grid-250m-wgs84.geojson> \
//        --local <250_LOCAL_RESD_YYYYMMDD.zip|csv> \
//        [--forn-long <250_FORN_LONG_YYYYMMDD.zip|csv>] [--forn-temp <250_FORN_TEMP_YYYYMMDD.zip|csv>]
//
//   SEOUL_API_KEY=... node scripts/foot-traffic/build-grid.mjs api --boundary <geojson>   (서버/배치 전용, 키를 프런트에 넣지 않음)
//
// 출력 (public/data/)
//   pop-<type>.json   250m 격자 ID별 시간대 공개값 합계 + 비식별/관측 행수 (행정동 행은 덮어쓰지 않고 누적)
//   quality.json      행수·중복키·조인 누락·비식별·합계 검증 결과
//
// 출처: 서울특별시·KT, 서울시 통신데이터

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import iconv from "iconv-lite";


const OUT = path.resolve("public/data/foot-traffic");

const TYPES = {
  local: { label: "내국인", flag: "--local", service: "Se250MSpopLocalResd" },
  fornLong: { label: "장기외국인", flag: "--forn-long", service: "Se250MSpopFornLongResd" },
  fornTemp: { label: "단기외국인", flag: "--forn-temp", service: "Se250MSpopFornTempResd" },
};

/** 내국인 성별·연령 그룹 → 원본 헤더 (API 필드는 M00·F00 …) */
const AGE_BANDS = {
  a00: ["0~9세"],
  a10: ["10~14세", "15~19세"],
  a20: ["20~24세", "25~29세"],
  a30: ["30~34세", "35~39세"],
  a40: ["40~44세", "45~49세"],
  a50: ["50~54세", "55~59세"],
  a60: ["60~64세", "65~69세"],
  a70: ["70세 이상"],
};
const API_AGE = { "0~9세": "00", "10~14세": "10", "15~19세": "15", "20~24세": "20", "25~29세": "25", "30~34세": "30", "35~39세": "35", "40~44세": "40", "45~49세": "45", "50~54세": "50", "55~59세": "55", "60~64세": "60", "65~69세": "65", "70세 이상": "70" };
const ALL_AGES = Object.values(AGE_BANDS).flat();
const GROUPS = {
  male: ALL_AGES.map((a) => `남자 ${a}`),
  female: ALL_AGES.map((a) => `여자 ${a}`),
  ...Object.fromEntries(Object.entries(AGE_BANDS).map(([k, ages]) => [k, ages.flatMap((a) => [`남자 ${a}`, `여자 ${a}`])])),
};
const DETAIL_COLS = [...GROUPS.male, ...GROUPS.female];

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);

/* ================= 원본 행 읽기 ================= */

/** ZIP(첫 CSV) 또는 CSV → CP949 디코딩 텍스트 */
async function readCsvText(file) {
  let buf = await readFile(file);
  if (file.toLowerCase().endsWith(".zip")) {
    const entries = unzipSync(new Uint8Array(buf));
    const name = Object.keys(entries).find((n) => n.toLowerCase().endsWith(".csv"));
    if (!name) throw new Error(`${file}: ZIP 안에 CSV가 없습니다`);
    buf = Buffer.from(entries[name]);
  }
  // 원본은 CP949. UTF-8 BOM이 있으면 UTF-8로 처리
  return buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? buf.toString("utf8").slice(1) : iconv.decode(buf, "cp949");
}

/** 헤더는 쉼표, 본문 구분자는 별도 판별(쉼표/세미콜론) */
function parseCsv(text, file, q) {
  const nl = text.indexOf("\n");
  const headerLine = text.slice(0, nl).replace(/\r$/, "");
  const body = text.slice(nl + 1);
  const header = parse(headerLine, { delimiter: ",", trim: true })[0].map((h) => h.trim());
  const firstBody = body.slice(0, body.indexOf("\n"));
  const delimiter = firstBody.split(";").length > firstBody.split(",").length ? ";" : ",";
  const rows = parse(body, { delimiter, relax_column_count: true, skip_empty_lines: true, trim: true });

  const idx = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`${file}: 헤더 '${name}' 없음 — ${header.slice(0, 6).join(" | ")}`);
    return i;
  };
  const col = { ymd: idx("일자"), tt: idx("시간"), dong: idx("행정동코드"), cell: idx("250M격자"), spop: idx("생활인구합계") };
  const detailIdx = DETAIL_COLS.every((c) => header.includes(c)) ? DETAIL_COLS.map((c) => header.indexOf(c)) : null;

  q.delimiter = delimiter;
  q.headerColumns = header.length;
  q.extraColumnsAllEmpty = 0;
  q.extraColumnsNonEmpty = 0;
  q.shortRows = 0;

  const out = [];
  for (const r of rows) {
    if (r.length > header.length) {
      // 초과 열은 실제로 모두 비어 있을 때만 버린다
      if (r.slice(header.length).every((v) => v.trim() === "")) q.extraColumnsAllEmpty++;
      else {
        q.extraColumnsNonEmpty++;
        continue; // 의미 미확인 값은 매핑하지 않고 제외 + 기록
      }
    } else if (r.length < header.length) {
      q.shortRows++;
      continue;
    }
    // 따옴표 안 공백(예: "11110515     ")은 csv-parse trim이 지우지 않으므로 직접 정리
    const v = (i) => (r[i] ?? "").trim();
    out.push({
      ymd: v(col.ymd),
      tt: v(col.tt),
      dong: v(col.dong),
      cell: v(col.cell),
      spop: v(col.spop),
      detail: detailIdx ? detailIdx.map(v) : null,
    });
  }
  return out;
}

/** Open API: 날짜 필터 없음, 1,000행 페이징, 스냅샷 일관성 확인 */
async function fetchApi(service) {
  const KEY = process.env.SEOUL_API_KEY;
  if (!KEY) throw new Error("SEOUL_API_KEY 환경변수가 필요합니다");
  const PAGE = 1000;
  const call = async (s, e) => {
    for (let i = 1; ; i++) {
      try {
        const url = `http://openapi.seoul.go.kr:8088/${KEY}/json/${service}/${s}/${e}/`;
        const body = await (await fetch(url, { signal: AbortSignal.timeout(60000) })).json();
        const p = body[service];
        const code = (p?.RESULT ?? body.RESULT)?.CODE;
        if (code !== "INFO-000") throw new Error(code ?? "응답 형식 오류");
        return p;
      } catch (err) {
        if (i >= 4 || /INFO-100|INFO-200|ERROR-33/.test(err.message)) throw err;
        await new Promise((r) => setTimeout(r, 1500 * i));
      }
    }
  };
  const first = await call(1, PAGE);
  const total = first.list_total_count;
  const rows = [...first.row];
  for (let s = PAGE + 1; s <= total; s += PAGE) {
    const p = await call(s, Math.min(s + PAGE - 1, total));
    if (p.list_total_count !== total) throw new Error(`${service}: 수집 중 전체 건수 변경 (${total}→${p.list_total_count}) — 다시 실행하세요`);
    rows.push(...p.row);
    process.stdout.write(`\r${service} ${rows.length}/${total}`);
  }
  console.log();
  const s = (v) => (v == null ? "" : String(v).trim());
  const apiDetail = DETAIL_COLS.map((c) => {
    const [sex, age] = c.split(" ");
    return (sex === "남자" ? "M" : "F") + API_AGE[age];
  });
  return rows.map((r) => ({
    ymd: s(r.YMD),
    tt: s(r.TT),
    dong: s(r.H_DNG_CD),
    cell: s(r.CELL_ID),
    spop: s(r.SPOP),
    detail: r[apiDetail[0]] !== undefined ? apiDetail.map((k) => s(r[k])) : null,
  }));
}

/* ================= 집계 ================= */

/**
 * 원본 키 = 인구종류 + 일자 + 시간 + 행정동 + 격자 (중복 검사).
 * 행정동별로 묶을 때 덮어쓰지 않고 공개값 합계·공개 행수·비식별 행수를 따로 누적한다.
 */
function aggregateType(type, rows, cellIds, q) {
  const keys = new Set();
  const byCell = new Map(); // cell → { sum[24], obs[24], sup[24] }
  const groupIdx = Object.fromEntries(Object.entries(GROUPS).map(([g, cols]) => [g, cols.map((c) => DETAIL_COLS.indexOf(c))]));
  const byGroup = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, new Map()])); // g → cell → acc
  const newAcc = () => ({ sum: new Array(24).fill(0), obs: new Array(24).fill(0), sup: new Array(24).fill(0) });
  let hasDetail = false;
  q.detailCheck = { fullyPublicRows: 0, sumMatchesSpop: 0 };
  const dongsSeen = new Set();
  const dates = new Set();
  const hoursSeen = new Set();
  const cellsSeen = new Set();
  let rawPublicSum = 0;
  q.rows = rows.length;
  q.duplicateKeys = 0;
  q.suppressedRows = 0;
  q.zeroRows = 0;
  q.badValues = 0;
  q.badHours = 0;

  for (const r of rows) {
    const key = [type, r.ymd, r.tt, r.dong, r.cell].join("|");
    if (keys.has(key)) q.duplicateKeys++;
    keys.add(key);
    cellsSeen.add(r.cell);
    dongsSeen.add(r.dong);

    const h = Number.parseInt(r.tt, 10); // "0"/"00" 모두 정수로
    if (!(h >= 0 && h < 24)) {
      q.badHours++;
      continue;
    }
    dates.add(r.ymd);
    hoursSeen.add(h);

    let d = byCell.get(r.cell);
    if (!d) byCell.set(r.cell, (d = { sum: new Array(24).fill(0), obs: new Array(24).fill(0), sup: new Array(24).fill(0) }));

    if (r.detail) {
      hasDetail = true;
      // 성별·연령 열: 열 단위로 공개값·비식별 수를 누적 (숨김값 역산 안 함)
      for (const [g, idxs] of Object.entries(groupIdx)) {
        let a = byGroup[g].get(r.cell);
        if (!a) byGroup[g].set(r.cell, (a = newAcc()));
        for (const i of idxs) {
          const raw = r.detail[i];
          if (raw === "*") a.sup[h]++;
          else if (raw !== "" && Number.isFinite(Number(raw))) {
            a.sum[h] += Number(raw);
            a.obs[h]++;
          }
        }
      }
      if (r.spop !== "*" && r.detail.every((x) => x !== "*")) {
        q.detailCheck.fullyPublicRows++;
        if (Math.abs(r.detail.reduce((t, x) => t + Number(x), 0) - Number(r.spop)) < 0.05) q.detailCheck.sumMatchesSpop++;
      }
    }

    if (r.spop === "*") {
      d.sup[h]++;
      q.suppressedRows++;
    } else {
      const v = Number(r.spop);
      if (r.spop === "" || !Number.isFinite(v)) {
        q.badValues++;
        continue;
      }
      if (v === 0) q.zeroRows++;
      d.sum[h] += v;
      d.obs[h]++;
      rawPublicSum += v;
    }
  }

  // 출력 값 (시간별)
  //   number            → 공개값 합계 (해당 시각 모든 행 공개)
  //   [sum, obs, sup]   → 일부 비식별 (sum은 공개값 합계, 완전한 인구 아님)
  //   "*"               → 전부 비식별
  //   null              → 원본 행 없음
  const encode = (d) =>
    d.sum.map((sum, h) => {
      const obs = d.obs[h];
      const sup = d.sup[h];
      if (obs === 0 && sup === 0) return null;
      if (obs === 0) return "*";
      const rounded = round2(sum);
      return sup ? [rounded, obs, sup] : rounded;
    });
  const groups = {};
  if (hasDetail) {
    for (const [g, m] of Object.entries(byGroup)) {
      groups[g] = {};
      for (const [cell, a] of m) if (cellIds.has(cell)) groups[g][cell] = encode(a);
    }
  } else delete q.detailCheck;
  const values = {};
  const joinMissing = [];
  let joinedPublicSum = 0;
  let unjoinedPublicSum = 0;
  for (const [cell, d] of byCell) {
    const s = d.sum.reduce((a, b) => a + b, 0);
    if (!cellIds.has(cell)) {
      joinMissing.push({ cell, allSuppressed: d.obs.every((n) => n === 0) });
      unjoinedPublicSum += s;
      continue;
    }
    joinedPublicSum += s;
    values[cell] = encode(d);
  }

  q.uniqueCells = cellsSeen.size;
  q.uniqueDongs = dongsSeen.size;
  q.dates = [...dates].sort();
  q.hours = hoursSeen.size;
  q.publicSumRaw = round2(rawPublicSum);
  q.publicSumJoined = round2(joinedPublicSum);
  q.publicSumUnjoined = round2(unjoinedPublicSum);
  q.publicSumCheck = Math.abs(rawPublicSum - joinedPublicSum - unjoinedPublicSum) < 0.01 ? "일치" : "불일치";
  q.joinMissing = joinMissing;
  return { values, groups, ymd: q.dates[0] };
}

const round2 = (n) => Math.round(n * 100) / 100;

/* ================= 실행 ================= */

async function main() {
  const boundaryFile = opt("--boundary");
  if (!boundaryFile) throw new Error("--boundary <grid-250m-wgs84.geojson> 가 필요합니다");
  const geo = JSON.parse(await readFile(boundaryFile, "utf8"));
  const cellIds = new Set(geo.features.map((f) => f.properties.CELL_ID));

  const quality = {
    builtAt: new Date().toISOString(),
    boundary: { file: path.basename(boundaryFile), cells: cellIds.size },
    types: {},
  };

  const results = {};
  for (const [type, meta] of Object.entries(TYPES)) {
    const q = (quality.types[type] = { label: meta.label });
    let rows;
    if (mode === "api") {
      q.source = `Open API ${meta.service}`;
      rows = await fetchApi(meta.service);
    } else {
      const file = opt(meta.flag);
      if (!file) {
        delete quality.types[type];
        continue;
      }
      q.source = path.basename(file);
      rows = parseCsv(await readCsvText(file), file, q);
    }
    results[type] = aggregateType(type, rows, cellIds, q);
    console.log(
      `[${meta.label}] ${q.rows.toLocaleString()}행 · 격자 ${q.uniqueCells} · 행정동 ${q.uniqueDongs} · 비식별 ${q.suppressedRows} · 중복키 ${q.duplicateKeys} · 경계 조인 누락 ${q.joinMissing.length} · 합계 ${q.publicSumCheck}`,
    );
  }
  if (!Object.keys(results).length) throw new Error("인구 원본이 없습니다 (--local 등)");

  const ymds = [...new Set(Object.values(results).map((r) => r.ymd))];
  quality.ymd = ymds[0];
  quality.ymdConsistent = ymds.length === 1 && Object.values(quality.types).every((t) => t.dates.length === 1);
  if (!quality.ymdConsistent) console.warn(`경고: 인구종류별 기준일 불일치 ${ymds.join(", ")}`);

  await mkdir(OUT, { recursive: true });
  for (const [type, r] of Object.entries(results)) {
    await writeFile(path.join(OUT, `pop-${type}.json`), JSON.stringify({ type, ymd: r.ymd, values: r.values }));
    for (const [g, values] of Object.entries(r.groups)) {
      await writeFile(path.join(OUT, `pop-${type}-${g}.json`), JSON.stringify({ type, group: g, ymd: r.ymd, values }));
    }
    if (Object.keys(r.groups).length) quality.types[type].groups = Object.keys(r.groups);
  }
  await writeFile(path.join(OUT, "quality.json"), JSON.stringify(quality, null, 2));
  console.log(`→ ${OUT} (기준일 ${quality.ymd}, 경계 격자 ${cellIds.size}개)`);
}

if (mode !== "csv" && mode !== "api") {
  console.log("사용법: node scripts/build-grid.mjs <csv|api> --boundary <grid-250m-wgs84.geojson> [--local f] [--forn-long f] [--forn-temp f]");
  process.exit(1);
}
main().catch((e) => {
  console.error("실패:", e.message);
  process.exit(1);
});
