import { describe, expect, it } from "vitest";
import { buildRegionTree, type StanRow } from "./regions-build";

const row = (cd: string, addr: string): StanRow => ({
  region_cd: cd, sido_cd: cd.slice(0, 2), sgg_cd: cd.slice(2, 5), umd_cd: cd.slice(5, 8), ri_cd: cd.slice(8, 10),
  locatadd_nm: addr, locallow_nm: addr.split(" ").at(-1)!,
});

const rows = [
  row("4100000000", "경기도"),
  row("4157000000", "경기도 김포시"),
  row("4157010200", "경기도 김포시 사우동"),
  row("4157010100", "경기도 김포시 가현동"),
  row("4157025300", "경기도 김포시 양촌읍"),
  row("4157025321", "경기도 김포시 양촌읍 가상리"),
  row("4111000000", "경기도 수원시"),
  row("4111100000", "경기도 수원시 장안구"),
  row("4111112900", "경기도 수원시 장안구 파장동"),
  row("2800000000", "인천광역시"),
  row("2826000000", "인천광역시 서구"),
  row("2826010100", "인천광역시 서구 가상동"),
  row("3611000000", "세종특별자치시"),
  row("3611011000", "세종특별자치시 가상동"),
  row("1200000000", "전남광주통합특별시"),
  row("1278000000", "전남광주통합특별시 강진군"),
  row("1278025000", "전남광주통합특별시 강진군 가상읍"),
];

describe("buildRegionTree", () => {
  const tree = buildRegionTree(rows);
  const sgg = (cd: string) => tree.sidos.flatMap((s) => s.sggs).find((g) => g.cd === cd);

  it("읍·면·동만 가나다순으로 담고 리는 뺀다", () => {
    expect(sgg("41570")?.dongs).toEqual(["가현동", "사우동", "양촌읍"]);
  });
  it("label 은 시·도 약칭 + 시·군·구 이름", () => {
    expect(sgg("41570")?.label).toBe("경기 김포시");
    expect(sgg("28260")?.label).toBe("인천 서구");
    expect(sgg("41111")?.label).toBe("경기 수원시 장안구");
    expect(sgg("12780")?.label).toBe("전남광주 강진군");
  });
  it("동이 없는 시(구가 있는 시 자체)는 뺀다", () => {
    expect(sgg("41110")).toBeUndefined();
  });
  it("시·도와 시·군·구가 같은 세종은 시·도 이름을 쓴다", () => {
    expect(sgg("36110")).toMatchObject({ name: "세종특별자치시", label: "세종", dongs: ["가상동"] });
  });
  it("시·도는 코드순, 시·군·구는 이름순", () => {
    expect(tree.sidos.map((s) => s.cd)).toEqual(["12", "28", "36", "41"]);
    expect(tree.sidos.find((s) => s.cd === "41")?.sggs.map((g) => g.cd)).toEqual(["41570", "41111"]);
  });
});
