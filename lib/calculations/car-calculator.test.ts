import { describe, expect, it } from "vitest";
import {
  calculateAcquisitionTax,
  calculateCarCosts,
  calculateCarTax,
  calculateFuelCost,
  estimateInsurance,
  estimateMaintenance,
  type CarInput,
} from "./car-calculator";

describe("calculateCarTax (자동차세, 지방교육세 포함)", () => {
  it("1,600cc는 cc당 140원에 지방교육세 30%를 더한다", () => {
    expect(calculateCarTax(1600)).toEqual({
      ratePerCc: 140,
      baseTax: 224_000,
      educationTax: 67_200,
      total: 291_200,
    });
  });

  it.each([
    [0, 0],
    [1000, 104_000], // 1,000cc 이하: 80원
    [1001, 182_182], // 1,600cc 이하: 140원
    [1601, 416_260], // 1,600cc 초과: 200원
    [2000, 520_000],
  ])("배기량 %icc → 총 %i원", (cc, total) => {
    expect(calculateCarTax(cc).total).toBe(total);
  });
});

describe("calculateAcquisitionTax (취득세)", () => {
  it("부가세를 뺀 금액에 7%를 적용한다", () => {
    expect(calculateAcquisitionTax(27_500_000, 1600)).toEqual({
      taxBase: 25_000_000,
      rate: 0.07,
      tax: 1_750_000,
    });
  });

  it("1,000cc 미만은 경차로 보고 4%를 적용한다", () => {
    const r = calculateAcquisitionTax(27_500_000, 999);
    expect(r.rate).toBe(0.04);
    expect(r.tax).toBe(1_000_000);
  });

  it("정확히 1,000cc는 경차가 아니다", () => {
    expect(calculateAcquisitionTax(27_500_000, 1000).rate).toBe(0.07);
  });

  it("가격이 0이면 0원이다", () => {
    expect(calculateAcquisitionTax(0, 1600).tax).toBe(0);
  });
});

describe("calculateFuelCost (연료비)", () => {
  it("주행거리 ÷ 연비 × 휘발유 가격", () => {
    expect(calculateFuelCost(15_000, 12, 1650)).toBe(2_062_500);
  });

  it("연비가 0 이하이면 0원으로 처리한다", () => {
    expect(calculateFuelCost(15_000, 0, 1650)).toBe(0);
    expect(calculateFuelCost(15_000, -3, 1650)).toBe(0);
  });

  it("주행거리가 0이면 0원이다", () => {
    expect(calculateFuelCost(0, 12, 1650)).toBe(0);
  });
});

describe("estimateInsurance (보험료 추정)", () => {
  it.each([
    [0, 0],
    [10_000_000, 520_000],
    [30_000_000, 760_000],
    [100_000_000, 1_600_000],
  ])("차량 가격 %i원 → 연 %i원", (price, expected) => {
    expect(estimateInsurance(price)).toBe(expected);
  });

  it("만원 단위로 반올림한다", () => {
    expect(estimateInsurance(25_555_555)).toBe(710_000);
  });
});

describe("estimateMaintenance (정비비 추정)", () => {
  it("엔진오일 + 타이어 + 점검·소모품으로 나눈다 (중간 가격대)", () => {
    expect(estimateMaintenance(30_000_000, 15_000)).toEqual({
      engineOil: 150_000,
      tires: 240_000,
      service: 200_000,
      total: 590_000,
    });
  });

  it("2,000만원 미만은 경제형 요금을 적용한다", () => {
    expect(estimateMaintenance(15_000_000, 10_000)).toEqual({
      engineOil: 100_000,
      tires: 100_000,
      service: 150_000,
      total: 350_000,
    });
  });

  it("5,000만원 이상은 고급형 요금을 적용한다", () => {
    expect(estimateMaintenance(60_000_000, 25_000)).toEqual({
      engineOil: 250_000,
      tires: 700_000,
      service: 350_000,
      total: 1_300_000,
    });
  });

  it("가격대 경계값: 2,000만원과 5,000만원부터 다음 구간", () => {
    expect(estimateMaintenance(19_999_999, 0).service).toBe(150_000);
    expect(estimateMaintenance(20_000_000, 0).service).toBe(200_000);
    expect(estimateMaintenance(49_999_999, 0).service).toBe(200_000);
    expect(estimateMaintenance(50_000_000, 0).service).toBe(350_000);
  });

  it("가격이 0이면 모두 0원이다", () => {
    expect(estimateMaintenance(0, 15_000).total).toBe(0);
  });
});

describe("calculateCarCosts (통합)", () => {
  const base: CarInput = {
    price: 30_000_000,
    displacement: 1600,
    annualKm: 15_000,
    fuelEfficiency: 12,
    fuelPrice: 1650,
    holdingYears: 5,
  };

  it("기본 입력의 항목별 연/월 금액", () => {
    const r = calculateCarCosts(base);
    const byKey = Object.fromEntries(r.items.map((i) => [i.key, i]));

    expect(byKey.fuel).toMatchObject({ annual: 2_062_500, monthly: 171_875 });
    expect(byKey.insurance).toMatchObject({ annual: 760_000, monthly: 63_333 });
    expect(byKey.maintenance).toMatchObject({ annual: 590_000, monthly: 49_167 });
    expect(byKey.carTax).toMatchObject({ annual: 291_200, monthly: 24_267 });
    expect(byKey.initial).toMatchObject({ annual: 419_818, monthly: 34_985 });
  });

  it("초기 비용은 취득세 + 등록 부대비용이다", () => {
    const r = calculateCarCosts(base);
    expect(r.initial.acquisitionTax).toBe(1_909_090);
    expect(r.initial.registrationCost).toBe(190_000);
    expect(r.initial.total).toBe(2_099_090);
    expect(r.initial.holdingYears).toBe(5);
  });

  it("총 유지비 = 반복 비용 + 초기 비용 분할분", () => {
    const r = calculateCarCosts(base);
    expect(r.recurringAnnual).toBe(3_703_700);
    expect(r.annualTotal).toBe(4_123_518);
    expect(r.monthlyTotal).toBe(343_627);
  });

  it("항목 비중의 합은 1이다", () => {
    const r = calculateCarCosts(base);
    const sum = r.items.reduce((acc, i) => acc + i.share, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("추정 항목에는 estimated 표시가 붙는다", () => {
    const r = calculateCarCosts(base);
    const est = Object.fromEntries(r.items.map((i) => [i.key, i.estimated]));
    expect(est).toEqual({
      fuel: false,
      insurance: true,
      maintenance: true,
      carTax: false,
      initial: true,
    });
  });

  it("보험료를 직접 입력하면 추정 대신 그 값을 쓴다", () => {
    const r = calculateCarCosts({ ...base, insuranceOverride: 1_000_000 });
    const ins = r.items.find((i) => i.key === "insurance")!;
    expect(ins.annual).toBe(1_000_000);
    expect(ins.estimated).toBe(false);
  });

  it("정비비를 직접 입력하면 추정 대신 그 값을 쓴다", () => {
    const r = calculateCarCosts({ ...base, maintenanceOverride: 500_000 });
    const m = r.items.find((i) => i.key === "maintenance")!;
    expect(m.annual).toBe(500_000);
    expect(m.estimated).toBe(false);
  });

  it("직접 입력이 0이면 입력하지 않은 것으로 보고 추정값을 쓴다", () => {
    const r = calculateCarCosts({
      ...base,
      insuranceOverride: 0,
      maintenanceOverride: 0,
    });
    expect(r.items.find((i) => i.key === "insurance")!.annual).toBe(760_000);
    expect(r.items.find((i) => i.key === "maintenance")!.annual).toBe(590_000);
  });

  it("보유 기간이 길수록 초기 비용의 연 분할분이 줄어든다", () => {
    const five = calculateCarCosts(base);
    const ten = calculateCarCosts({ ...base, holdingYears: 10 });
    expect(ten.initial.annualized).toBe(209_909);
    expect(ten.annualTotal).toBeLessThan(five.annualTotal);
  });

  it("보유 기간이 1년 미만이면 1년으로 본다", () => {
    const r = calculateCarCosts({ ...base, holdingYears: 0 });
    expect(r.initial.holdingYears).toBe(1);
    expect(r.initial.annualized).toBe(2_099_090);
  });

  it("차량 가격이 0이면 가격에 따른 비용은 모두 0원이다", () => {
    const r = calculateCarCosts({ ...base, price: 0 });
    expect(r.initial.total).toBe(0);
    expect(r.initial.registrationCost).toBe(0);
    expect(r.items.find((i) => i.key === "insurance")!.annual).toBe(0);
    expect(r.items.find((i) => i.key === "maintenance")!.annual).toBe(0);
  });

  it("모든 입력이 0이면 총액도 0이고 비중은 0이다", () => {
    const r = calculateCarCosts({
      price: 0,
      displacement: 0,
      annualKm: 0,
      fuelEfficiency: 0,
      fuelPrice: 0,
      holdingYears: 0,
    });
    expect(r.annualTotal).toBe(0);
    expect(r.monthlyTotal).toBe(0);
    expect(r.items.every((i) => i.share === 0)).toBe(true);
  });
});
