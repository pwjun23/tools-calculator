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
  /** 전월세 계약 기간(국토부 contractTerm, 예: "26.11~28.11"). 매매·미신고는 "". */
  term?: string;
  /** 국토부 단지 일련번호(예: 41570-998). 수집 때만 있고 DB 거래 표에는 없다. */
  aptSeq?: string;
  /** 시·도부터 쓴 도로명 주소. 없으면 "". */
  roadAddr?: string;
  /** 시·도부터 쓴 지번 주소. 없으면 "". */
  jibunAddr?: string;
}

/** DB에 저장된 거래 */
export interface StoredDeal extends MolitDeal {
  firstSeenAt: Date;
}
