import type { ComplexSeed } from "./complexes";

type Point = { lat: number; lng: number };

export type GeocodeDeps = {
  pending(limit: number): Promise<ComplexSeed[]>;
  locate(address: string): Promise<Point | null>;
  save(c: ComplexSeed, p: Point | null): Promise<void>;
  /** 오류가 난 단지를 대기열 뒤로 보낸다. */
  defer?(c: ComplexSeed): Promise<void>;
};

/**
 * 좌표가 없는 단지를 도로명 → 지번 순서로 찾아 저장한다. 결과가 없으면 notfound(null),
 * 오류면 저장하지 않아 다음에 다시 한다. deadline(ms, now() 기준)이 지나면 멈춘다.
 */
export async function geocodePending(deps: GeocodeDeps, opts: { limit: number; deadline?: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const out = { ok: 0, notfound: 0, failed: 0 };
  for (const c of await deps.pending(opts.limit)) {
    if (opts.deadline !== undefined && now() > opts.deadline) break;
    try {
      let p: Point | null = null;
      for (const addr of [c.roadAddr, c.jibunAddr]) {
        if (!addr) continue;
        p = await deps.locate(addr);
        if (p) break;
      }
      await deps.save(c, p);
      if (p) out.ok++;
      else out.notfound++;
    } catch (e) {
      console.error("[whereToMove geocode]", c.sggCd, c.apt, e instanceof Error ? e.message : e);
      out.failed++;
      await deps.defer?.(c).catch(() => {});
    }
  }
  return out;
}
