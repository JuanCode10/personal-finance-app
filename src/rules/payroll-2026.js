export const payrollYear = 2026;

export const sources = {
  incomeTax: 'https://www.hacienda.go.cr/docs/TramosRenta2026.pdf',
  contributions: 'https://www.bdo.cr/es-cr/publicaciones/2025/costa-rica-ajuste-en-cuotas-obrero-patronales-de-la-ccss-a-partir-del-1-de-enero-de-2026',
};

export const contributionRatesBps = {
  sem: 550,
  ivm: 433,
  bancoPopular: 100,
};

export const incomeTaxBrackets = [
  { upperLimitCRC: 918000, rateBps: 0 },
  { upperLimitCRC: 1347000, rateBps: 1000 },
  { upperLimitCRC: 2364000, rateBps: 1500 },
  { upperLimitCRC: 4727000, rateBps: 2000 },
  { upperLimitCRC: null, rateBps: 2500 },
];

export const taxCreditsCRC = {
  perEligibleChild: 1710,
  eligibleSpouse: 2590,
};