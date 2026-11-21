import proj4 from "proj4";
import type { LatLng } from "@/types/foot-traffic";

proj4.defs(
  "EPSG:5179",
  "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
);
const toUtmk = proj4("WGS84", "EPSG:5179");

export const utmk = (point: LatLng) =>
  toUtmk.forward([point.lng, point.lat]) as [number, number];

const LETTERS = "가나다라마바사아자차카타파하";

/** National grid ID → EPSG:5179 center of its 250 m cell. */
export function cellCenter(id: string): [number, number] | null {
  const match = /^(.)(.)(\d{4})(\d{4})$/.exec(id);
  if (!match) return null;
  const x = LETTERS.indexOf(match[1]);
  const y = LETTERS.indexOf(match[2]);
  if (x < 0 || y < 0) return null;
  return [
    (7 + x) * 100000 + Number(match[3]) * 10 + 125,
    (13 + y) * 100000 + Number(match[4]) * 10 + 125,
  ];
}
