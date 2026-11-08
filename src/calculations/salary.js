import { contributionRatesBps, incomeTaxBrackets, taxCreditsCRC } from '../rules/payroll-2026.js';

const MAX_AMOUNT_CRC = 1_000_000_000_000;
const BASIS_POINTS = 10_000n;

function toCents(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  if (value < 0 || value > MAX_AMOUNT_CRC || Number(value.toFixed(2)) !== value) {
    throw new RangeError(`${name} must be between 0 and ${MAX_AMOUNT_CRC} CRC with at most two decimal places`);
  }
  return Math.round(value * 100);
}

function toCRC(cents) {
  return cents / 100;
}

function validateRate(rate, name) {
  if (!Number.isInteger(rate) || rate < 0 || rate > 10000) {
    throw new RangeError(`${name} must be an integer between 0 and 10000 basis points`);
  }
}

function percentageCents(amountCents, rateBps) {
  return Number((BigInt(amountCents) * BigInt(rateBps) + BASIS_POINTS / 2n) / BASIS_POINTS);
}

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

export function calculateSalary(options) {
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