# 생활인구·도로 데이터 갱신

현재 화면은 전달받은 `foot-traffic-map/public/data`의 정적 스냅샷을 사용한다.

- 생활인구 기준일: **2026-11-15** (`quality.json.ymd`)
- 도로: 제공 프로젝트 README 기준 OSM 2026-11-14, © OpenStreetMap contributors (ODbL)
- 출처: 서울특별시·KT, 서울시 통신데이터
- 원본 JSON 662개를 내용 변경 없이 `public/data/foot-traffic`으로 복사했다.
- 클라이언트에는 API 비밀키가 필요하지 않다. 카카오 지도용 공개 JavaScript 키는 별도 설정이다.

## 갱신

아래 코드는 배치 작업용이다. 인구 변환에는 Node 패키지 `csv-parse`, `fflate`, `iconv-lite`, 도로 변환에는 Python 패키지 `osmium`, `shapely`, `pyproj`가 필요하다. 앱 실행 의존성과 분리해 준비한다.

```sh
node scripts/foot-traffic/build-grid.mjs csv --boundary <grid-250m-wgs84.geojson> \
  --local <250_LOCAL_RESD_YYYYMMDD.zip> \
  --forn-long <250_FORN_LONG_YYYYMMDD.zip> \
  --forn-temp <250_FORN_TEMP_YYYYMMDD.zip>

python3 scripts/foot-traffic/build-roads.py <Seoul.osm.pbf> <grid-250m-wgs84.geojson> public/data/foot-traffic/roads
```

Open API 배치 모드는 `SEOUL_API_KEY`를 서버 환경변수로 전달하고 `node scripts/foot-traffic/build-grid.mjs api --boundary <geojson>`로 실행한다. 날짜 필터가 없는 API이므로 CSV와 동일 기준일을 보장하지 않는다.

## 값 해석

- `null`: 원본 행 없음. `"*"`: 공개값 없이 비식별된 값. 숫자 `0`: 실제 공개된 0. 서로 바꾸지 않는다.
- `[sum, publicRows, suppressedRows]`: 공개 부분합 및 관측·비식별 행 개수.
- 일평균은 **공개값이 존재하는 시간대의 부분합 평균**이다. `observedHours`/`presentHours`를 함께 전달하며, 비식별만 존재하는 시간은 분모에서 제외한다. 24시간 전체 인구 평균이나 순방문자 수가 아니다.
- 반경 집계는 중심점이 반경 안에 있는 250m 격자를 사용한다. 도로는 조각의 중간점 기준으로 표시 범위를 선택한다.
- 도로 색상은 해당 격자의 생활인구 수준을 옮긴 것으로 도로별 실측 보행량이 아니다. 단계는 동일 시간·집단의 서울 공개 격자값 50/75/90 백분위다.
- `quality.json`의 내국인 격자 `다사47256125`는 경계 조인이 누락됐고 전부 비식별이다. 누락을 0으로 보완하지 않는다.

갱신 후 기준일 일치, 경계 조인 누락, 비식별 비율, 공개 부분합 검증을 확인하고 화면의 출처·기준일과 함께 배포한다.
