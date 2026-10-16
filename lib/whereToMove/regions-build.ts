export type StanRow = { region_cd: string; sido_cd: string; sgg_cd: string; umd_cd: string; ri_cd: string; locatadd_nm: string; locallow_nm: string };
export type SggEntry = { cd: string; name: string; label: string; dongs: string[] };
export type SidoEntry = { cd: string; name: string; sggs: SggEntry[] };
export type RegionTree = { sidos: SidoEntry[] };

const SIDO_SHORT: Record<string, string> = {
  "11": "서울", "12": "전남광주", "26": "부산", "27": "대구", "28": "인천", "29": "광주", "30": "대전", "31": "울산", "36": "세종",
  "41": "경기", "42": "강원", "51": "강원", "43": "충북", "44": "충남", "45": "전북", "52": "전북", "46": "전남",
  "47": "경북", "48": "경남", "50": "제주",
};

const ko = (a: string, b: string) => a.localeCompare(b, "ko");

/** 법정동코드(현존) 행을 시·도 → 시·군·구(5자리, 국토부 LAWD_CD) → 읍·면·동 이름 트리로 만든다. */
export function buildRegionTree(rows: StanRow[]): RegionTree {
  const sidoName = new Map<string, string>();
  const sggName = new Map<string, string>();
  const dongs = new Map<string, Set<string>>();
  for (const r of rows) {
    const cd5 = r.region_cd.slice(0, 5);
    if (r.sgg_cd === "000" && r.umd_cd === "000" && r.ri_cd === "00") sidoName.set(r.sido_cd, r.locatadd_nm);
    else if (r.umd_cd === "000" && r.ri_cd === "00") sggName.set(cd5, r.locatadd_nm);
    else if (r.ri_cd === "00") {
      if (!dongs.has(cd5)) dongs.set(cd5, new Set());
      dongs.get(cd5)!.add(r.locallow_nm);
    }
  }
  const sidos = new Map<string, SidoEntry>();
  for (const [cd5, set] of dongs) {
    const sidoCd = cd5.slice(0, 2);
    const full = sggName.get(cd5);
    // 세종처럼 시·도 행 없이 시·군·구 행만 있으면 그 이름이 곧 시·도 이름이다.
    const sido = sidoName.get(sidoCd) ?? full ?? "";
    const name = full && full !== sido ? full.slice(sido.length).trim() : sido;
    const short = SIDO_SHORT[sidoCd] ?? sido;
    const label = name === sido ? short : `${short} ${name}`;
    if (!sidos.has(sidoCd)) sidos.set(sidoCd, { cd: sidoCd, name: sido, sggs: [] });
    sidos.get(sidoCd)!.sggs.push({ cd: cd5, name, label, dongs: [...set].sort(ko) });
  }
  const out = [...sidos.values()].sort((a, b) => a.cd.localeCompare(b.cd));
  for (const s of out) s.sggs.sort((a, b) => ko(a.name, b.name));
  return { sidos: out };
}
