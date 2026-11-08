export const payrollYear = 2026;

/**
 * Official sources for information regarding tax
 * calculations and salary deductions.
 */
export const sources = {
  incomeTax: 'https://www.hacienda.go.cr/docs/TramosRenta2026.pdf',
  contributions: 'https://www.bdo.cr/es-cr/publicaciones/2025/costa-rica-ajuste-en-cuotas-obrero-patronales-de-la-ccss-a-partir-del-1-de-enero-de-2026',
};

/**
 * Mandatory contributions from income
 * 
 * Each contribution is calculated from the 
 * base salary prior to any reduction.
 */
export const contributionRatesBps = {
  sem: 550,
  ivm: 433,
  bancoPopular: 100,
};

/**
 * Progressive monthly income tax brackets.
 *
 * Each tax rate applies ONLY to the salary portion
 * within the corresponding bracket.
 *
 * upperLimitCRC: Upper salary limit for the bracket.
 * rateBps: Marginal tax rate expressed in basis points.
 *
 * A null upper limit represents an unlimited bracket.
 */
export const incomeTaxBrackets = [
  { upperLimitCRC: 918000, rateBps: 0 },
  { upperLimitCRC: 1347000, rateBps: 1000 },
  { upperLimitCRC: 2364000, rateBps: 1500 },
  { upperLimitCRC: 4727000, rateBps: 2000 },
  { upperLimitCRC: null, rateBps: 2500 },
];

/**
 * Tax credits ammounts.
 * Not all cases are elegible.
 */
export const taxCreditsCRC = {
  perEligibleChild: 1710,
  eligibleSpouse: 2590,
};