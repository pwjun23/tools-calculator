import proj4 from "proj4";

/** 도로명주소 좌표 API가 주는 UTM-K(GRS80, EPSG:5179). */
const UTMK = "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs";
const WGS84 = "EPSG:4326";

export function utmkToWgs84(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4(UTMK, WGS84, [x, y]);
  return { lat, lng };
}

export function wgs84ToUtmk(lat: number, lng: number): { x: number; y: number } {
  const [x, y] = proj4(WGS84, UTMK, [lng, lat]);
  return { x, y };
}
