// 마이페이지 가게 정보 수정 본문 규칙 (#124): 저장값으로 폼을 만들고, 바뀐 필드만 PATCH 본문에 담는다.
import assert from "node:assert/strict";
import { createSourceRuntime } from "./helpers/source-runtime.mjs";

const { load } = createSourceRuntime();
const { formFromStore, buildStorePatch, patchKey, effectiveNotes, previewLines } = load("@/lib/api/store-update");

// S1 상태: 저장값은 술 판매 '예', '술 빼고 휴게음식점' 선택으로 유효 값만 '아니요'
const store = {
  store_id: "s", name: "테스트카페", business_type_input: "카페", business_type: "일반음식점",
  address: "서울특별시 마포구 월드컵북로 21", address_detail: "1층", opening_date: "2027-02-01",
  owner_birth_year: null, region: null, is_demo: false,
  answers: { sells_alcohol: true, uses_terrace: false, has_employees: true, funds_krw: null, does_delivery: null, area_sqm: null },
  effective: { name: "테스트카페", business_type: "휴게음식점", answers: { sells_alcohol: false, has_employees: true } },
};
const base = formFromStore(store);
const results = [];
const check = (name, fn) => {
  fn();
  results.push(name);
  console.log(`PASS ${name}`);
};

check("폼 기준값은 유효 값이 아니라 저장값", () => {
  assert.equal(base.alcohol, true);
  assert.equal(base.delivery, null); // 미답변은 null 로 둔다
  assert.match(effectiveNotes(store).alcohol, /지금 적용 중인 값: 아니요/);
});

check("층만 바꾸면 층만 담고 주류 판매는 섞지 않는다", () => {
  const patch = buildStorePatch(base, { ...base, detail: "2층" });
  assert.deepEqual(patch, { address_detail: "2층" });
});

check("이름·개업일", () => {
  assert.deepEqual(buildStorePatch(base, { ...base, name: " 새이름 " }), { name: "새이름" });
  assert.deepEqual(buildStorePatch(base, { ...base, opening: "2027-03-01" }), { opening_date: "2027-03-01" });
});

check("직원 여부 false 는 false 로 보낸다", () => {
  assert.deepEqual(buildStorePatch(base, { ...base, employees: false }), { answers: { has_employees: false } });
});

check("미답변(null)은 null 을 보내지 않고, 답하면 그 값만", () => {
  assert.deepEqual(buildStorePatch(base, { ...base, delivery: null }), {});
  assert.deepEqual(buildStorePatch(base, { ...base, delivery: false }), { answers: { does_delivery: false } });
});

check("숫자 칸을 비우면 null, 같은 숫자면 생략", () => {
  const withBirth = formFromStore({ ...store, owner_birth_year: 1995, answers: { ...store.answers, area_sqm: 30, funds_krw: 1000 } });
  assert.deepEqual(buildStorePatch(withBirth, { ...withBirth, birth: "" }), { owner_birth_year: null });
  assert.deepEqual(buildStorePatch(withBirth, { ...withBirth, area: "" }), { area_sqm: null });
  assert.deepEqual(buildStorePatch(withBirth, { ...withBirth, funds: "" }), { answers: { funds_krw: null } });
  assert.deepEqual(buildStorePatch(withBirth, { ...withBirth, birth: "1995" }), {});
});

check("여러 필드 동시 변경", () => {
  const patch = buildStorePatch(base, { ...base, detail: "2층", name: "새이름", employees: false, alcohol: false });
  assert.deepEqual(patch, { name: "새이름", address_detail: "2층", answers: { sells_alcohol: false, has_employees: false } });
});

check("원복하면 빈 본문", () => {
  assert.deepEqual(buildStorePatch(base, { ...base, detail: "2층" }), { address_detail: "2층" });
  assert.deepEqual(buildStorePatch(base, { ...base, detail: "1층" }), {});
  assert.deepEqual(buildStorePatch(base, { ...base, alcohol: true }), {}); // 저장값과 같은 값으로 되돌림
});

check("본문 비교 키는 키 순서와 무관", () => {
  assert.equal(patchKey({ a: 1, answers: { y: 2, x: 1 } }), patchKey({ answers: { x: 1, y: 2 }, a: 1 }));
  assert.notEqual(patchKey({ a: 1 }), patchKey({ a: 2 }));
});

check("미리보기 요약은 서버 응답의 변경·초기화 카드로 만든다", () => {
  const lines = previewLines({
    changed: [{ field: "address_detail", from: "1층", to: "2층" }, { field: "answers.has_employees", from: true, to: false }],
    impacts: ["building", "law", "checklist"], needs_reanalyze: true, run_id: null,
    reset_items: [{ item_id: "r-01", title: "이 자리에서는 일반음식점 신고가 어려워요", chosen_label: "술 빼고 휴게음식점으로 시작" }],
  });
  assert.deepEqual(lines, [
    "층·호: 1층 → 2층",
    "직원 고용: 예 → 아니요",
    "“이 자리에서는 일반음식점 신고가 어려워요” 카드의 “술 빼고 휴게음식점으로 시작” 선택 초기화 (다시 결정 대기)",
  ]);
});

console.log(`${results.length} passed`);
