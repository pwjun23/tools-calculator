export type LatLng = { lat: number; lng: number };
export type CommuteEstimate = {
  km: number;
  transit: [number, number];
  car: [number, number];
};
/** 단지 → 장소 이동 수단. 배열 순서가 카드·설정의 표시 순서다. */
export type TripMode = "walk" | "shuttle" | "car" | "transit";
export const TRIP_MODES: TripMode[] = ["walk", "shuttle", "car", "transit"];
export const TRIP_ICON: Record<TripMode, string> = {
  walk: "🚶",
  shuttle: "🚌",
  car: "🚗",
  transit: "🚇",
};
export type Trip = {
  km: number;
  times: Partial<Record<TripMode, [number, number]>>;
};
/** 직장·학교·자주 가는 곳. id 는 직장 `w`, 학교 `s0`~`s3`, 자주 가는 곳 `p0`~`p3`. */
export type Place = LatLng & {
  id: string;
  kind: "work" | "school" | "place";
  label: string;
  modes: TripMode[];
};

/** 어림값 가정. 바꾸면 ⓘ 설명 문구도 같이 바뀐다. */
export const COMMUTE_ASSUMPTIONS = {
  roadFactor: 1.3,
  car: { kmh: [25, 40], extraMin: 5 },
  transit: { kmh: [15, 25], extraMin: [10, 20] },
  /** 아이 걸음. */
  walk: { kmh: [3, 4] },
  /** 통학차량: 노선·타는 곳을 몰라 자가용 범위에 곱한다(여러 곳을 들름). */
  shuttle: { factor: [1.5, 2] },
} as const;

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** 두 좌표 사이 직선(대원) 거리, km. */
export function straightKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
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
    car: [
      round5(mins(A.car.kmh[1], A.car.extraMin)),
      round5(mins(A.car.kmh[0], A.car.extraMin)),
    ],
    transit: [
      round5(mins(A.transit.kmh[1], A.transit.extraMin[0])),
      round5(mins(A.transit.kmh[0], A.transit.extraMin[1])),
    ],
  };
}

/** 고른 수단마다 어림 시간 범위(분). 5분 단위, 최솟값 최소 5분. car·transit 은 estimateCommute 와 같다. */
export function estimateModes(km: number, modes: TripMode[]): Trip {
  const A = COMMUTE_ASSUMPTIONS;
  const e = estimateCommute(km);
  const road = km * A.roadFactor;
  const at5 = (m: number) => Math.max(5, round5(m));
  const all: Record<TripMode, [number, number]> = {
    walk: [at5((road / A.walk.kmh[1]) * 60), at5((road / A.walk.kmh[0]) * 60)],
    shuttle: [
      at5(e.car[0] * A.shuttle.factor[0]),
      at5(e.car[1] * A.shuttle.factor[1]),
    ],
    car: e.car,
    transit: e.transit,
  };
  const times: Trip["times"] = {};
  for (const m of TRIP_MODES) if (modes.includes(m)) times[m] = all[m];
  return { km: e.km, times };
}

export function kmLabel(km: number): string {
  // 학교는 대개 1km 안이라 소수 한 자리로 서로 구분되게 한다.
  if (km < 0.05) return "0.1km 미만";
  return km < 10 ? `${Math.round(km * 10) / 10}km` : `${Math.round(km)}km`;
}

/** ⓘ 설명 문구. 상수에서 만든다. */
export function commuteHelp(): string[] {
  const A = COMMUTE_ASSUMPTIONS;
  return [
    "이 시간은 길찾기 결과가 아닙니다. 단지와 직장·학교·자주 가는 곳 사이의 직선거리로 추정한 어림값입니다.",
    `계산: 실제 길은 직선보다 길어서 직선거리 × ${A.roadFactor}을 도로 거리로 봅니다. 자가용은 시속 ${A.car.kmh[0]}~${A.car.kmh[1]}km에 ${A.car.extraMin}분, 대중교통은 시속 ${A.transit.kmh[0]}~${A.transit.kmh[1]}km에 걷기·기다리기 ${A.transit.extraMin[0]}~${A.transit.extraMin[1]}분을 더했습니다.`,
    `도보는 아이 걸음으로(자주 가는 곳도 같은 기준) 시속 ${A.walk.kmh[0]}~${A.walk.kmh[1]}km로 봤습니다. 횡단보도·육교는 반영하지 않았습니다.`,
    `통학차량은 노선과 타는 곳을 알 수 없어 자가용 시간의 ${A.shuttle.factor[0]}~${A.shuttle.factor[1]}배로 잡았습니다. 타는 곳까지 걷는 시간은 빠져 있습니다.`,
    "반영 안 된 것: 실제 노선과 환승, 배차 간격, 출퇴근 혼잡(예: 김포골드라인), 신호·정체, 주차.",
    "강·바다·철길을 돌아가야 하거나 다리·IC가 먼 곳은 실제와 크게 다를 수 있습니다.",
    "정확한 시간·경로·요금은 길찾기 버튼으로 카카오맵에서 확인하세요.",
  ];
}

const placeName = (s: string) =>
  encodeURIComponent(s.replace(/[,/]/g, " ").replace(/\s+/g, " ").trim());

/** 카카오맵 URL 길찾기(https://apis.map.kakao.com/web/guide/#routeurl). traffic=대중교통. */
export function kakaoRouteUrl(
  by: "traffic" | "car" | "walk",
  from: LatLng & { name: string },
  to: LatLng & { name: string },
): string {
  return `https://map.kakao.com/link/by/${by}/${placeName(from.name)},${from.lat},${from.lng}/${placeName(to.name)},${to.lat},${to.lng}`;
}

/** 통근 필터 한 칸, 장소별 묶음. 직장은 김포→서울처럼 먼 곳도 고를 수 있게 120분까지, 학교는 30분까지, 자주 가는 곳(교회 등)은 60분까지. */
const LIMITS = {
  work: [30, 45, 60, 90, 120],
  school: [10, 15, 20, 30],
  place: [10, 20, 30, 45, 60],
} as const;

export function tripChoices(
  places: Place[],
): {
  id: string;
  label: string;
  options: { value: string; label: string }[];
}[] {
  const seen = new Map<string, number>();
  return places.map((p) => {
    // 같은 이름(예: 기본 이름 '학교' 두 곳)은 번호를 붙여 묶음을 구분한다.
    const n = (seen.get(p.label) ?? 0) + 1;
    seen.set(p.label, n);
    return {
      id: p.id,
      label: n > 1 ? `${p.label} (${n})` : p.label,
      options: TRIP_MODES.filter((m) => p.modes.includes(m)).flatMap((m) =>
        LIMITS[p.kind].map((min) => ({
          value: `${p.id}:${m}:${min}`,
          label: `${TRIP_ICON[m]} ${min}분 이내`,
        })),
      ),
    };
  });
}

/** 필터 값 해석. 전체·없는 장소·그 장소에 없는 수단·틀린 형식은 null(= 거르지 않음). */
export function parseTripChoice(
  v: string,
  places: Place[],
): { id: string; mode: TripMode; max: number } | null {
  const [id, mode, max] = v.split(":");
  const p = places.find((x) => x.id === id);
  const n = Number(max);
  return p && p.modes.includes(mode as TripMode) && Number.isFinite(n) && n > 0
    ? { id, mode: mode as TripMode, max: n }
    : null;
}

/** 어림 범위의 최솟값 기준. 어림값이 없으면 숨기지 않는다(추정이 틀려 괜찮은 집이 숨겨지지 않게). */
export function passesTrip(
  trips: (Trip & { id: string })[] | null,
  c: { id: string; mode: TripMode; max: number } | null,
): boolean {
  const t = c && trips?.find((x) => x.id === c.id)?.times[c.mode];
  return !t || t[0] <= c!.max;
}

/** 학교 수단 체크 토글. 마지막 하나는 끄지 않고, 표시 순서를 지킨다. */
export function toggleMode(modes: TripMode[], m: TripMode): TripMode[] {
  const next = modes.includes(m) ? modes.filter((x) => x !== m) : [...modes, m];
  return next.length ? TRIP_MODES.filter((x) => next.includes(x)) : modes;
}
