export type LatLng = { lat: number; lng: number };
export type CommuteEstimate = { km: number; transit: [number, number]; car: [number, number] };
export type CommuteMode = "off" | "transit" | "car";

/** 어림값 가정. 바꾸면 ⓘ 설명 문구도 같이 바뀐다. */
export const COMMUTE_ASSUMPTIONS = {
  roadFactor: 1.3,
  car: { kmh: [25, 40], extraMin: 5 },
  transit: { kmh: [15, 25], extraMin: [10, 20] },
} as const;

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** 두 좌표 사이 직선(대원) 거리, km. */
export function straightKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const round5 = (m: number) => Math.round(m / 5) * 5;

/** 직선거리로 추정한 통근 시간 범위(분). 길찾기 결과가 아니다. */
export function estimateCommute(km: number): CommuteEstimate {
  const A = COMMUTE_ASSUMPTIONS;
  const road = km * A.roadFactor;
  const mins = (kmh: number, extra: number) => (road / kmh) * 60 + extra;
  return {
    km: Math.round(km * 10) / 10,
    car: [round5(mins(A.car.kmh[1], A.car.extraMin)), round5(mins(A.car.kmh[0], A.car.extraMin))],
    transit: [round5(mins(A.transit.kmh[1], A.transit.extraMin[0])), round5(mins(A.transit.kmh[0], A.transit.extraMin[1]))],
  };
}

export function kmLabel(km: number): string {
  if (km < 1) return "1km 미만";
  return km < 10 ? `${Math.round(km * 10) / 10}km` : `${Math.round(km)}km`;
}

/** ⓘ 설명 문구. 상수에서 만든다. */
export function commuteHelp(): string[] {
  const A = COMMUTE_ASSUMPTIONS;
  return [
    "이 시간은 길찾기 결과가 아닙니다. 단지와 직장 사이의 직선거리로 추정한 어림값입니다.",
    `계산: 실제 길은 직선보다 길어서 직선거리 × ${A.roadFactor}을 도로 거리로 봅니다. 자가용은 시속 ${A.car.kmh[0]}~${A.car.kmh[1]}km에 ${A.car.extraMin}분, 대중교통은 시속 ${A.transit.kmh[0]}~${A.transit.kmh[1]}km에 걷기·기다리기 ${A.transit.extraMin[0]}~${A.transit.extraMin[1]}분을 더했습니다.`,
    "반영 안 된 것: 실제 노선과 환승, 배차 간격, 출퇴근 혼잡(예: 김포골드라인), 신호·정체, 주차.",
    "강·바다·철길을 돌아가야 하거나 다리·IC가 먼 곳은 실제와 크게 다를 수 있습니다.",
    "정확한 시간·경로·요금은 길찾기 버튼으로 카카오맵에서 확인하세요.",
  ];
}

const placeName = (s: string) => encodeURIComponent(s.replace(/[,/]/g, " ").replace(/\s+/g, " ").trim());

/** 카카오맵 URL 길찾기(https://apis.map.kakao.com/web/guide/#routeurl). traffic=대중교통. */
export function kakaoRouteUrl(by: "traffic" | "car", from: LatLng & { name: string }, to: LatLng & { name: string }): string {
  return `https://map.kakao.com/link/by/${by}/${placeName(from.name)},${from.lat},${from.lng}/${placeName(to.name)},${to.lat},${to.lng}`;
}

/** 통근 필터. 어림 범위의 최솟값 기준이고, 어림값이 없으면 숨기지 않는다. */
/** 통근 필터 한 칸: 수단과 시간을 함께 고른다. 김포→서울처럼 먼 곳도 고를 수 있게 120분까지 둔다. */
const LIMITS = [30, 45, 60, 90, 120];
export const COMMUTE_CHOICES: { value: string; label: string }[] = [
  { value: "off", label: "전체" },
  ...LIMITS.map((m) => ({ value: `transit:${m}`, label: `🚇 ${m}분 이내` })),
  ...LIMITS.map((m) => ({ value: `car:${m}`, label: `🚗 ${m}분 이내` })),
];

export function parseCommuteChoice(v: string): { mode: CommuteMode; max: number } {
  const [mode, max] = v.split(":");
  return (mode === "transit" || mode === "car") && Number(max) > 0 ? { mode, max: Number(max) } : { mode: "off", max: 0 };
}

export function passesCommute(c: CommuteEstimate | null, mode: CommuteMode, maxMin: number): boolean {
  if (mode === "off" || !c) return true;
  return c[mode][0] <= maxMin;
}
