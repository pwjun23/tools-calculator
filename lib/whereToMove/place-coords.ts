import type { LatLng } from "./commute";
import type { Settings } from "./settings";

type Located = { address: string; lat?: number; lng?: number };

/**
 * 좌표 없이 주소만 저장된 직장·학교·자주 가는 곳에 좌표를 채운다(임시 카카오 모드 때 저장된 설정용).
 * 못 찾거나 조회 오류가 나면 그대로 두고 missed 로 센다.
 */
export async function fillPlaceCoords(s: Settings, locate: (address: string) => Promise<LatLng | null>) {
  let filled = 0, missed = 0;
  const fill = async <T extends Located>(xs: T[]): Promise<T[]> => {
    const out: T[] = [];
    for (const x of xs) {
      if (x.lat !== undefined && x.lng !== undefined) { out.push(x); continue; }
      const p = await locate(x.address).catch(() => null);
      if (p) { filled++; out.push({ ...x, lat: p.lat, lng: p.lng }); } else { missed++; out.push(x); }
    }
    return out;
  };
  const workplaces = await fill(s.workplaces);
  const schools = await fill(s.schools);
  const places = await fill(s.places);
  return { settings: { ...s, workplaces, schools, places }, filled, missed };
}
