import { contributionRatesBps, incomeTaxBrackets, taxCreditsCRC } from '../rules/payroll-2026.js';

const MAX_AMOUNT_CRC = 1_000_000_000_000;
const BASIS_POINTS = 10_000n;

/**
 * Convert colones to cents.
 * 1 colon = 100 cents
 * 
 * @param {number} value
 * @param {string} name
 * @returns {number}
 */
function toCents(value, name) { //? Who is calling this function? Analyze the context
  // Ensure value definition is appropriate
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  // Check value is withing appropriate range and appropriate rounding
  if (value < 0 || value > MAX_AMOUNT_CRC || Number(value.toFixed(2)) !== value) {
    throw new RangeError(`${name} must be between 0 and ${MAX_AMOUNT_CRC} CRC with at most two decimal places`);
  }
  return Math.round(value * 100);
}

/**
 * Convert cents to colones.
 * 
 * @param {number} cents 
 * @returns {number}
 */
function toCRC(cents) {
  return cents / 100;
}

/**
 * Validate rate value is adequate.
 * 
 * @param {number} rate 
 * @param {string} name 
 */
function validateRate(rate, name) {
  if (!Number.isInteger(rate) || rate < 0 || rate > 10000) {
    throw new RangeError(`${name} must be an integer between 0 and 10000 basis points`);
  }
}

/**
 * Calculates a percentage of a monetary amount using exact
 * integer arithmetic.
 *
 * The amount is expressed in céntimos (1 colon = 100 cents),
 * and the rate is expressed in basis points (100 bps = 1%).
 *
 * BigInt prevents precision loss during multiplication.
 * Adding half the divisor before integer division implements
 * round-half-up to the nearest céntimo for nonnegative inputs.
 *
 * @param {number} amountCents - Nonnegative monetary amount in céntimos.
 * @param {number} rateBps - Nonnegative percentage rate in basis points.
 * @returns {number} Calculated percentage, rounded to whole céntimos.
 */
function percentageCents(amountCents, rateBps) {
  return Number((BigInt(amountCents) * BigInt(rateBps) + BASIS_POINTS / 2n) / BASIS_POINTS);
}

/**
 * Calculates the mandatory employee payroll contributions
 * for a given gross monthly salary in Costa Rica.
 *
 * The function applies the configured contribution rates for:
 * - SEM: Seguro de Enfermedad y Maternidad.
 * - IVM: Invalidez, Vejez y Muerte.
 * - Banco Popular: Mandatory employee contribution.
 *
 * Each contribution is calculated independently using basis points
 * (bps) and integer arithmetic in céntimos to preserve precision.
 * Individual contributions are rounded to the nearest céntimo
 * before calculating the total.
 *
 * @param {number} grossSalaryCRC
 *     Gross monthly salary expressed in Costa Rican colones.
 *
 * @returns {{
 *     semCRC: number,
 *     ivmCRC: number,
 *     bancoPopularCRC: number,
 *     totalCRC: number
 * }}
 *     Object containing the individual mandatory contributions
 *     and their combined total, expressed in CRC.
 *
 * @throws {TypeError}
 *     If the salary or a configured contribution rate has an invalid type.
 *
 * @throws {RangeError}
 *     If the salary or a configured contribution rate is outside its allowed range.
 *
 * @example
 * const result = calculateMandatoryContributions(1_000_000);
 *
 * console.log(result.semCRC);          // 55000
 * console.log(result.ivmCRC);          // 43300
 * console.log(result.bancoPopularCRC); // 10000
 * console.log(result.totalCRC);        // 108300
 */
export function calculateMandatoryContributions(grossSalaryCRC) {
  const salaryCents = toCents(grossSalaryCRC, 'grossSalaryCRC');
  const amounts = Object.fromEntries(Object.entries(contributionRatesBps).map(([name, rate]) => {
    validateRate(rate, name);
    return [name, percentageCents(salaryCents, rate)];
  }));
  return {
    semCRC: toCRC(amounts.sem),
    ivmCRC: toCRC(amounts.ivm),
    bancoPopularCRC: toCRC(amounts.bancoPopular),
    totalCRC: toCRC(amounts.sem + amounts.ivm + amounts.bancoPopular),
  };
}

/**
 * Calculates the monthly income tax for a given gross salary
 * according to Costa Rica's progressive income tax brackets.
 *
 * The function iterates through each tax bracket, calculating
 * the taxable portion of the salary and applying the corresponding
 * marginal tax rate.
 *
 * All monetary calculations are performed internally in céntimos
 * to preserve precision, using basis points (bps) for tax rates.
 *
 * @param {number} grossSalaryCRC
 *     Gross monthly salary expressed in Costa Rican colones.
 *
 * @returns {{
 *     beforeCreditsCRC: number,
 *     brackets: Array<{
 *         lowerLimitCRC: number,
 *         upperLimitCRC: number|null,
 *         rateBps: number,
 *         taxableIncomeCRC: number,
 *         taxCRC: number
 *     }>
 * }}
 *     Object containing the total income tax before tax credits
 *     and a detailed breakdown of each tax bracket.
 *
 * @throws {TypeError}
 *     If the salary or a configured rate has an invalid type.
 *
 * @throws {RangeError}
 *     If the salary or a configured rate is outside its allowed range.
 *
 * @example
 * const result = calculateIncomeTax(1_000_000);
 * console.log(result.beforeCreditsCRC); // 8200
 */
export function calculateIncomeTax(grossSalaryCRC) {
  const salaryCents = toCents(grossSalaryCRC, 'grossSalaryCRC');
  let lowerLimitCents = 0;
  let totalTaxCents = 0;
  const brackets = incomeTaxBrackets.map(({ upperLimitCRC, rateBps }) => {
    validateRate(rateBps, 'income tax rate');
    const upperLimitCents = upperLimitCRC === null ? salaryCents : upperLimitCRC * 100;
    const taxableCents = Math.max(0, Math.min(salaryCents, upperLimitCents) - lowerLimitCents);
    const taxCents = percentageCents(taxableCents, rateBps);
    const result = {
      lowerLimitCRC: toCRC(lowerLimitCents),
      upperLimitCRC,
      rateBps,
      taxableIncomeCRC: toCRC(taxableCents),
      taxCRC: toCRC(taxCents),
    };
    totalTaxCents += taxCents;
    if (upperLimitCRC !== null) lowerLimitCents = upperLimitCents;
    return result;
  });
  return { beforeCreditsCRC: toCRC(totalTaxCents), brackets };
}

/**
 * Applies eligible monthly income tax credits to the calculated
 * income tax according to Costa Rican tax regulations.
 *
 * The function calculates available credits based on the number
 * of eligible children and spouse eligibility.
 *
 * Credits are applied in the following order:
 * 1. Eligible children.
 * 2. Eligible spouse.
 *
 * Each credit is limited to the remaining income tax liability,
 * ensuring that the final tax amount never becomes negative.
 *
 * All monetary calculations are performed internally in céntimos
 * to preserve precision.
 *
 * @param {number} incomeTaxCRC
 *     Monthly income tax before applying credits, expressed in CRC.
 *
 * @param {number} [eligibleChildren=0]
 *     Number of children eligible for the monthly tax credit.
 *     Must be a non-negative safe integer.
 *
 * @param {boolean} [spouseTaxCredit=false]
 *     Indicates whether the taxpayer qualifies for the spouse
 *     tax credit.
 *
 * @returns {{
 *     childrenCRC: number,
 *     spouseCRC: number,
 *     totalCRC: number,
 *     afterCreditsCRC: number
 * }}
 *     Object containing the applied tax credits and the remaining
 *     income tax after credits, expressed in CRC.
 *
 * @throws {TypeError}
 *     If the income tax or spouse eligibility has an invalid type.
 *
 * @throws {RangeError}
 *     If the income tax is outside its allowed range or the number
 *     of eligible children is not a non-negative safe integer.
 *
 * @example
 * const result = applyTaxCredits(8200, 2, true);
 *
 * console.log(result.childrenCRC);    // 3420
 * console.log(result.spouseCRC);      // 2590
 * console.log(result.totalCRC);       // 6010
 * console.log(result.afterCreditsCRC); // 2190
 */
export function applyTaxCredits(incomeTaxCRC, eligibleChildren = 0, spouseTaxCredit = false) {
  const taxCents = toCents(incomeTaxCRC, 'incomeTaxCRC');
  if (!Number.isSafeInteger(eligibleChildren) || eligibleChildren < 0) {
    throw new RangeError('eligibleChildren must be a non-negative safe integer');
  }
  if (typeof spouseTaxCredit !== 'boolean') {
    throw new TypeError('spouseTaxCredit must be a boolean');
  }
  const availableChildCents = BigInt(eligibleChildren) * BigInt(taxCreditsCRC.perEligibleChild * 100);
  const childCents = Number(availableChildCents < BigInt(taxCents) ? availableChildCents : BigInt(taxCents));
  const spouseCents = spouseTaxCredit ? Math.min(taxCents - childCents, taxCreditsCRC.eligibleSpouse * 100) : 0;
  return {
    childrenCRC: toCRC(childCents),
    spouseCRC: toCRC(spouseCents),
    totalCRC: toCRC(childCents + spouseCents),
    afterCreditsCRC: toCRC(taxCents - childCents - spouseCents),
  };
}

/**
 * Calculates optional employee payroll deductions for a given
 * gross monthly salary in Costa Rica.
 *
 * The function supports:
 * - Asociación solidarista contributions, calculated as a
 *   percentage of the gross monthly salary.
 * - Additional fixed deductions, expressed directly in CRC.
 *
 * Asociación contributions are calculated using basis points
 * (bps) and integer arithmetic in céntimos to preserve precision.
 *
 * The calculated association contribution is rounded to the
 * nearest céntimo before being added to other deductions.
 *
 * These deductions are independent of mandatory social security
 * contributions and income tax calculations.
 *
 * @param {number} grossSalaryCRC
 *     Gross monthly salary expressed in Costa Rican colones.
 *
 * @param {number} [associationContributionBps=0]
 *     Employee association contribution rate expressed in
 *     basis points (100 bps = 1%).
 *
 * @param {number} [otherDeductionsCRC=0]
 *     Total amount of additional fixed payroll deductions,
 *     expressed in CRC.
 *
 * @returns {{
 *     associationCRC: number,
 *     otherCRC: number,
 *     totalCRC: number
 * }}
 *     Object containing the association contribution,
 *     additional deductions, and their combined total in CRC.
 *
 * @throws {TypeError}
 *     If a monetary input or contribution rate has an invalid type.
 *
 * @throws {RangeError}
 *     If a monetary input or contribution rate is outside
 *     its allowed range.
 *
 * @example
 * const result = calculateOptionalDeductions(1_000_000, 500, 10000);
 *
 * console.log(result.associationCRC); // 50000
 * console.log(result.otherCRC);       // 10000
 * console.log(result.totalCRC);       // 60000
 */
export function calculateOptionalDeductions(grossSalaryCRC, associationContributionBps = 0, otherDeductionsCRC = 0) {
  const salaryCents = toCents(grossSalaryCRC, 'grossSalaryCRC');
  validateRate(associationContributionBps, 'associationContributionBps');
  const otherCents = toCents(otherDeductionsCRC, 'otherDeductionsCRC');
  const associationCents = percentageCents(salaryCents, associationContributionBps);
  return {
    associationCRC: toCRC(associationCents),
    otherCRC: toCRC(otherCents),
    totalCRC: toCRC(associationCents + otherCents),
  };
}

/**
 * @typedef {Object} SalaryOptions
 *
 * @property {number} grossSalaryCRC
 *     Gross monthly salary expressed in Costa Rican colones.
 *
 * @property {number} [associationContributionBps=0]
 *     Optional association contribution rate in basis points.
 *
 * @property {number} [otherDeductionsCRC=0]
 *     Additional fixed payroll deductions expressed in CRC.
 *
 * @property {number} [eligibleChildren=0]
 *     Number of children eligible for income tax credits.
 *
 * @property {boolean} [spouseTaxCredit=false]
 *     Whether the employee qualifies for the spouse tax credit.
 */

/**
 * Calculates the estimated monthly net salary for a Costa Rican
 * salaried employee using the configured payroll regulations.
 *
 * This function acts as the main orchestration layer of the
 * salary calculation engine, combining the results of:
 *
 * 1. Mandatory employee social security contributions.
 * 2. Progressive monthly income tax calculations.
 * 3. Applicable income tax credits.
 * 4. Optional employee payroll deductions.
 *
 * Each calculation is delegated to its corresponding function
 * to maintain separation of concerns.
 *
 * All monetary deductions are calculated with céntimo-level
 * precision and combined to determine the total deductions
 * and estimated net monthly salary.
 *
 * Formula:
 * Net Salary = Gross Salary - Total Deductions
 *
 * Total deductions include mandatory contributions, income
 * tax after credits, and optional payroll deductions.
 *
 * @param {SalaryOptions} options
 *     Configuration object containing the employee's gross
 *     salary and applicable deduction parameters.
 *
 * @returns {{
 *     grossSalaryCRC: number,
 *     mandatoryContributions: Object,
 *     incomeTax: Object,
 *     optionalDeductions: Object,
 *     totalDeductionsCRC: number,
 *     netSalaryCRC: number
 * }}
 *     Structured salary calculation result containing individual
 *     deduction breakdowns, total deductions, and estimated
 *     net monthly salary expressed in CRC.
 *
 * @throws {TypeError}
 *     If the options argument is not a valid object or an input
 *     contains an invalid type.
 *
 * @throws {RangeError}
 *     If any monetary amount, contribution rate, or eligible
 *     children count is outside its allowed range.
 *
 * @example
 * const result = calculateSalary({
 *     grossSalaryCRC: 1_000_000,
 *     associationContributionBps: 500,
 *     otherDeductionsCRC: 0,
 *     eligibleChildren: 0,
 *     spouseTaxCredit: false
 * });
 *
 * console.log(result.netSalaryCRC); // 833500
 */
export function calculateSalary(options) {
  //todo: appropriate structure of the options object?
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('calculateSalary requires an options object');
  }

  const {
    grossSalaryCRC,
    associationContributionBps = 0,
    otherDeductionsCRC = 0,
    eligibleChildren = 0,
    spouseTaxCredit = false,
  } = options;

  const salaryCents = toCents(grossSalaryCRC, 'grossSalaryCRC');
  const mandatoryContributions = calculateMandatoryContributions(grossSalaryCRC);
  const incomeTax = calculateIncomeTax(grossSalaryCRC);
  const taxCredits = applyTaxCredits(incomeTax.beforeCreditsCRC, eligibleChildren, spouseTaxCredit);
  const optionalDeductions = calculateOptionalDeductions(grossSalaryCRC, associationContributionBps, otherDeductionsCRC);
  const totalDeductionsCents = Math.round(mandatoryContributions.totalCRC * 100)
    + Math.round(taxCredits.afterCreditsCRC * 100)
    + Math.round(optionalDeductions.totalCRC * 100);
  
    return {
    grossSalaryCRC,
    mandatoryContributions,
    incomeTax: { ...incomeTax, credits: taxCredits, afterCreditsCRC: taxCredits.afterCreditsCRC },
    optionalDeductions,
    totalDeductionsCRC: toCRC(totalDeductionsCents),
    netSalaryCRC: toCRC(salaryCents - totalDeductionsCents),
  };
}