# 공용 API 예시 JSON

기준: dev `af4b151`의 `API 명세서.md` §2·§6·§7. 이 폴더는 프론트·서버가 독립 개발할 때 쓰는 **합성 데이터**다. 실제 주소·API 조회·법률 판정·기관 확인의 증거가 아니다.

| 파일 | 표현하는 경로 | 스키마 |
| --- | --- | --- |
| report-normal.json | 정상 조회 경로의 모양을 가정한 결과 카드 | ../report-schema.json |
| report-unknown.json | 근거 미확보, unknown, 빈 evidence | ../report-schema.json |
| report-mock.json | mock 근거, from_mock=true, unknown | ../report-schema.json |
| checklist-timeline.json | 시기별 체크리스트 | ../checklist-schema.json |
| checklist-category.json | 같은 항목을 카테고리로 묶은 체크리스트 | ../checklist-schema.json |

모든 예시는 is_example=true다. normal의 from_mock=false도 정상 경로의 직렬화 형태를 테스트하기 위한 값이며, 실제 공급자 응답이라는 뜻이 아니다. 모르는 기관 번호는 null·verified=false로 두었다. 날짜 구간은 예시이며 group_label 경계를 확정하지 않는다.

## 기존 형식에서 바뀐 점

- 리포트 루트는 input/items/schedule이 아닌 store_id/run_id/generated_at/summary/groups/disclaimer다.
- 점검 항목은 item_id/check_id/reason, 판정은 high/low/unknown/ok를 쓴다.
- 근거는 type=data/law/notice와 source, 원문·링크·조회 시각·캐시/mock 플래그를 쓴다.
- options.apply는 update_store/none과 adds_checklist다. site_id/set_main_site는 외부 계약에서 제외했다.
- 연락처, 카드 실행 상태·메모·변경 요약, 체크리스트 연결·auto_checked를 표현한다.
- 체크리스트는 별도 응답이다. timeline/category가 같은 항목 스키마를 공유한다. 문서의 report_item_id 예시와 report_item_ids 설명은 함께 표현하되, 둘을 동시에 보낼 때의 일관성 검사는 서버 연결 시 확인한다.

스키마는 문서에 나타난 필드의 허용 구조를 고정하는 **리뷰용 계약 정리안**이다. required/additionalProperties 정책은 프론트·백엔드 담당의 PR 확인이 필요하다. 예시의 is_example/example_notice는 기존 예시 표시 원칙을 적용했다. 알 수 없는 필드를 조용히 받아 이름 오타를 놓치지 않도록 명시하지 않은 필드는 검사에서 거부한다.

## 생성·소비 경계와 남은 작업

현재 REST 라우터와 프론트 앱은 아직 없다. AI의 ReportItem/ChecklistItem과 저장된 mocks/demo/seoyeon.json은 **내부 형식**이며 이 REST 응답으로 그대로 노출하면 안 된다. 기존 데모를 조용히 새 형식으로 바꾸거나 후보 자리 선택을 임의 변환하지 않았다.

서버 생성 측(#64/#65/#67/#69)은 stage/group_label/category로 묶고, 서버의 실행 상태·기관 연락처·연결 정보를 합친 뒤 이 스키마로 응답을 검사한다. 프론트 소비 측은 이 폴더의 JSON으로 화면을 만들고 새 필드를 읽는다. #80은 JSON 계약·공용 fixture 단계까지만 반영한 상태이며 AI 모델 전환·실제 응답 생성·프론트 소비 검증은 남아 있다.

검증에 포함된 규칙: AI의 high 금지, unknown 이외 판정의 빈 근거 금지, 근거 없는 기간·금액 금지, 날짜/시각 형식, 옛 이름과 후보 자리 필드 거부. 추천 option_id 존재·summary 집계·자동 체크 관계·판정과 근거의 사실적 연결은 JSON Schema만으로 보장하지 않으며 서버·AI 검증이 필요하다.

## 실행

backend에서 개발 환경을 설치하고 실행한다:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q tests/test_public_contracts.py
python -m pytest -q
```

report-schema.json과 checklist-schema.json의 $id는 로컬 참조를 구분하는 논리 식별자이며 배포 URL이 아니다. 테스트는 두 스키마를 로컬 Registry에 등록하며 외부 네트워크를 사용하지 않는다.

미확정 계약: 직원 유무 변경 영향, 업종 변경 market 처리, group_label 경계, .ics 우선순위. 이 스키마 변경으로 해당 결정을 확정하지 않는다 (#51).
