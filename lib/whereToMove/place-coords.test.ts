import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { fillPlaceCoords } from "./place-coords";

const base: Settings = {
  ...DEFAULT_SETTINGS,
  workplaces: [{ label: "회사", address: "가상시 회사로 1" }],
  schools: [{ label: "학교", address: "가상시 학교로 2", modes: ["walk"] }, { label: "있음", address: "가상시 있음로 3", lat: 37.5, lng: 126.5, modes: ["car"] }],
  places: [{ label: "교회", address: "가상시 없는로 4", modes: ["car"] }],
} as Settings;

describe("fillPlaceCoords", () => {
  it("좌표 없는 직장·학교·자주 가는 곳만 찾아 채우고, 못 찾은 곳은 그대로 둔다", async () => {
    const asked: string[] = [];
    const r = await fillPlaceCoords(base, async (a) => {
      asked.push(a);
      return a.includes("없는로") ? null : { lat: 37.6, lng: 126.7 };
    });
    expect(asked).toEqual(["가상시 회사로 1", "가상시 학교로 2", "가상시 없는로 4"]);
    expect(r.filled).toBe(2);
    expect(r.missed).toBe(1);
    expect(r.settings.workplaces[0]).toMatchObject({ lat: 37.6, lng: 126.7 });
    expect(r.settings.schools[0]).toMatchObject({ lat: 37.6, lng: 126.7, modes: ["walk"] });
    expect(r.settings.schools[1]).toMatchObject({ lat: 37.5, lng: 126.5 });
    expect(r.settings.places[0].lat).toBeUndefined();
  });

  it("조회 오류는 못 찾은 곳으로 센다", async () => {
    const r = await fillPlaceCoords(base, async () => { throw new Error("E0007"); });
    expect(r).toMatchObject({ filled: 0, missed: 3 });
  });
});
