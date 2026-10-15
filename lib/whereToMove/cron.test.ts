import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron";

describe("isCronAuthorized", () => {
  it("Bearer 비밀값이 맞을 때만 true", () => {
    expect(isCronAuthorized("Bearer s3", "s3")).toBe(true);
    expect(isCronAuthorized("Bearer nope", "s3")).toBe(false);
    expect(isCronAuthorized(null, "s3")).toBe(false);
  });
  it("비밀값이 설정되지 않았으면 항상 false", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
  });
});
