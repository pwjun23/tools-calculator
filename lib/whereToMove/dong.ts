/** 국토부 API 는 읍·면 거래에 리를 붙여 준다("양촌읍 양곡리"). 설정·필터는 읍·면·동 단위라 첫 단어만 쓴다. */
export const umdOf = (dong: string) => dong.trim().split(/\s+/)[0];
