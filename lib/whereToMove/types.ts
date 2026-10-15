export type DealType = "매매" | "전세" | "월세";

/** 국토부 API 응답 한 건을 정규화한 거래. 금액·월세는 만원. */
export interface MolitDeal {
  key: string;
  type: DealType;
  sggCd: string;
  dong: string;
  apt: string;
  /** 전용면적 반올림(㎡) */
  area: number;
  /** 전용면적 원래 값(㎡) */
  areaRaw: number;
  floor: string;
  /** 계약일 YYYY-MM-DD */
  date: string;
  amount: number;
  rent: number;
  renewal: boolean;
  cancelled: boolean;
}

/** DB에 저장된 거래 */
export interface StoredDeal extends MolitDeal {
  firstSeenAt: Date;
}
