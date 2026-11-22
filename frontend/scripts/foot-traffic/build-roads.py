"""OSM 도로망을 서울 공식 250m 격자로 잘라 격자 ID를 붙인다.

    pip install osmium shapely pyproj
    python3 scripts/foot-traffic/build-roads.py <Seoul.osm.pbf> <grid-250m-wgs84.geojson> [public/data/foot-traffic/roads]

출력: <out>/index.json, <out>/<tx>_<ty>.json (1km 타일)
  index.json   {"tile": 1000, "tiles": ["955_1952", ...], "classes": [...], "source": ...}
  타일 파일     [[격자ID, 도로등급, [위도, 경도, 위도, 경도, ...]], ...]

도로: © OpenStreetMap contributors (ODbL)
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

import osmium
from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, box
from shapely.strtree import STRtree

PBF, GRID = sys.argv[1], sys.argv[2]
OUT = Path(sys.argv[3] if len(sys.argv) > 3 else "public/data/foot-traffic/roads")
TILE = 1000

# 보행 동선과 관련된 도로만 (고속도로·도시고속도로·램프 제외)
# rank: 0 간선, 1 보조간선, 2 집산, 3 이면도로, 4 보행 전용
RANK = {
    "primary": 0,
    "secondary": 1,
    "tertiary": 2,
    "pedestrian": 2,
    "residential": 3,
    "unclassified": 3,
    "living_street": 3,
    "footway": 4,
}

to_utmk = Transformer.from_crs(4326, 5179, always_xy=True)
to_wgs = Transformer.from_crs(5179, 4326, always_xy=True)


class Ways(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ways = []

    def way(self, w):
        hw = w.tags.get("highway")
        if hw not in RANK:
            return
        # 보도·횡단보도로 따로 그려진 선은 차도와 겹치므로 제외
        if hw == "footway" and w.tags.get("footway") in ("sidewalk", "crossing"):
            return
        if w.tags.get("area") == "yes" or w.tags.get("tunnel") in ("yes", "building_passage"):
            return
        try:
            coords = [(n.lon, n.lat) for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        if len(coords) >= 2:
            self.ways.append((RANK[hw], coords))


h = Ways()
h.apply_file(PBF, locations=True)
print(f"OSM 도로 {len(h.ways):,}개")

# 공식 격자: CELL_X/CELL_Y(EPSG:5179 중심)로 250m 정사각형
grid = json.load(open(GRID, encoding="utf-8"))
cell_ids, cell_boxes = [], []
for f in grid["features"]:
    p = f["properties"]
    cell_ids.append(p["CELL_ID"])
    cell_boxes.append(box(p["CELL_X"] - 125, p["CELL_Y"] - 125, p["CELL_X"] + 125, p["CELL_Y"] + 125))
tree = STRtree(cell_boxes)
print(f"격자 {len(cell_ids):,}개")

tiles = defaultdict(list)
pieces = 0
for rank, coords in h.ways:
    xs, ys = to_utmk.transform(*zip(*coords))
    line = LineString(zip(xs, ys))
    for i in tree.query(line):
        part = line.intersection(cell_boxes[i])
        if part.is_empty:
            continue
        geoms = part.geoms if hasattr(part, "geoms") else [part]
        for g in geoms:
            if g.geom_type != "LineString" or g.length < 3:
                continue
            g = g.simplify(1.5)
            mx, my = g.interpolate(0.5, normalized=True).coords[0]
            lon, lat = to_wgs.transform(*zip(*g.coords))
            flat = [v for pair in zip(lat, lon) for v in (round(pair[0], 6), round(pair[1], 6))]
            tiles[f"{int(mx // TILE)}_{int(my // TILE)}"].append([cell_ids[i], rank, flat])
            pieces += 1

OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("*.json"):
    old.unlink()
for key, items in tiles.items():
    (OUT / f"{key}.json").write_text(json.dumps(items, separators=(",", ":")), encoding="utf-8")
(OUT / "index.json").write_text(
    json.dumps(
        {
            "tile": TILE,
            "tiles": sorted(tiles),
            "ranks": {k: v for k, v in RANK.items()},
            "source": Path(PBF).name,
            "pieces": pieces,
        },
        ensure_ascii=False,
    ),
    encoding="utf-8",
)
print(f"→ {OUT}: 타일 {len(tiles)}개, 도로 조각 {pieces:,}개")
