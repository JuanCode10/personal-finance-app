import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTaxCredits,
  calculateIncomeTax,
  calculateMandatoryContributions,
  calculateOptionalDeductions,
  calculateSalary,
} from '../src/calculations/salary.js';

test('calculates the reference salary', () => {
  const result = calculateSalary({ grossSalaryCRC: 1000000 });
  assert.deepEqual(result.mandatoryContributions, {
    semCRC: 55000,
    ivmCRC: 43300,
    bancoPopularCRC: 10000,
    totalCRC: 108300,
  });
  assert.equal(result.incomeTax.beforeCreditsCRC, 8200);
  assert.equal(result.totalDeductionsCRC, 116500);
  assert.equal(result.netSalaryCRC, 883500);
});

test('zero salary has no payroll deductions', () => {
  const result = calculateSalary({ grossSalaryCRC: 0 });
  assert.equal(result.mandatoryContributions.totalCRC, 0);
  assert.equal(result.incomeTax.beforeCreditsCRC, 0);
  assert.equal(result.totalDeductionsCRC, 0);
  assert.equal(result.netSalaryCRC, 0);
  assert.ok(result.incomeTax.brackets.every((bracket) => bracket.taxableIncomeCRC === 0));
});

test('income below the exemption is not taxed', () => {
  const result = calculateIncomeTax(500000);
  assert.equal(result.beforeCreditsCRC, 0);
  assert.deepEqual(result.brackets.map((bracket) => bracket.taxableIncomeCRC), [500000, 0, 0, 0, 0]);
});

test('calculates tax at each bracket boundary', () => {
  const examples = [
    [918000, 0],
    [1347000, 42900],
    [2364000, 195450],
    [4727000, 668050],
  ];
  for (const [salary, expectedTax] of examples) {
    assert.equal(calculateIncomeTax(salary).beforeCreditsCRC, expectedTax, `salary ${salary}`);
  }
});

test('calculates each marginal bracket independently', () => {
  const examples = [
    [1000000, 8200],
    [1500000, 65850],
    [3000000, 322650],
    [5000000, 736300],
  ];
  for (const [salary, expectedTax] of examples) {
    assert.equal(calculateIncomeTax(salary).beforeCreditsCRC, expectedTax, `salary ${salary}`);
  }
  const result = calculateIncomeTax(5000000);
  assert.deepEqual(result.brackets.map((bracket) => bracket.taxableIncomeCRC),
    [918000, 429000, 1017000, 2363000, 273000]);
  assert.deepEqual(result.brackets.map((bracket) => bracket.taxCRC),
    [0, 42900, 152550, 472600, 68250]);
  assert.deepEqual(result.brackets.map((bracket) => bracket.rateBps), [0, 1000, 1500, 2000, 2500]);
  assert.equal(result.brackets.at(-1).upperLimitCRC, null);
});

test('calculates the individual mandatory contributions', () => {
  assert.deepEqual(calculateMandatoryContributions(2000000), {
    semCRC: 110000,
    ivmCRC: 86600,
    bancoPopularCRC: 20000,
    totalCRC: 216600,
  });
});

test('applies eligible child and spouse credits against income tax', () => {
  assert.deepEqual(applyTaxCredits(10000, 2, true), {
    childrenCRC: 3420,
    spouseCRC: 2590,
    totalCRC: 6010,
    afterCreditsCRC: 3990,
  });
  const result = calculateSalary({ grossSalaryCRC: 1000000, eligibleChildren: 2, spouseTaxCredit: true });
  assert.equal(result.incomeTax.afterCreditsCRC, 2190);
  assert.equal(result.incomeTax.credits.totalCRC, 6010);
});

test('caps applied credits at the tax due, allocating children first', () => {
  assert.deepEqual(applyTaxCredits(3700, 1, true), {
    childrenCRC: 1710,
    spouseCRC: 1990,
    totalCRC: 3700,
    afterCreditsCRC: 0,
  });
  assert.deepEqual(applyTaxCredits(1200, 2, true), {
    childrenCRC: 1200,
    spouseCRC: 0,
    totalCRC: 1200,
    afterCreditsCRC: 0,
  });
  assert.equal(calculateSalary({ grossSalaryCRC: 500000, eligibleChildren: 1, spouseTaxCredit: true }).incomeTax.credits.totalCRC, 0);
  assert.equal(applyTaxCredits(8200, Number.MAX_SAFE_INTEGER).afterCreditsCRC, 0);
});

test('calculates association and fixed optional deductions', () => {
  assert.deepEqual(calculateOptionalDeductions(1000000, 500, 25000), {
    associationCRC: 50000,
    otherCRC: 25000,
    totalCRC: 75000,
  });
  const result = calculateSalary({ grossSalaryCRC: 1000000, associationContributionBps: 500, otherDeductionsCRC: 25000 });
  assert.equal(result.totalDeductionsCRC, 191500);
  assert.equal(result.netSalaryCRC, 808500);
});

test('rounds each percentage calculation to the nearest cent, with half cents rounded up', () => {
  assert.deepEqual(calculateMandatoryContributions(0.10), {
    semCRC: 0.01,
    ivmCRC: 0,
    bancoPopularCRC: 0,
    totalCRC: 0.01,
  });
  assert.equal(calculateOptionalDeductions(0.10, 500).associationCRC, 0.01);
  assert.equal(calculateIncomeTax(918000.04).beforeCreditsCRC, 0);
  assert.equal(calculateIncomeTax(918000.05).beforeCreditsCRC, 0.01);
  assert.equal(calculateIncomeTax(1347000.10).beforeCreditsCRC, 42900.02);
});

test('keeps individual deductions, totals, and net salary consistent in cents', () => {
  const result = calculateSalary({
    grossSalaryCRC: 1500000.17,
    associationContributionBps: 347,
    otherDeductionsCRC: 12345.67,
    eligibleChildren: 1,
    spouseTaxCredit: true,
  });
  const cents = (amount) => Math.round(amount * 100);
  const mandatory = result.mandatoryContributions;
  assert.equal(cents(mandatory.totalCRC), cents(mandatory.semCRC) + cents(mandatory.ivmCRC) + cents(mandatory.bancoPopularCRC));
  assert.equal(cents(result.incomeTax.beforeCreditsCRC), result.incomeTax.brackets.reduce((total, bracket) => total + cents(bracket.taxCRC), 0));
  assert.equal(cents(result.incomeTax.afterCreditsCRC), cents(result.incomeTax.beforeCreditsCRC) - cents(result.incomeTax.credits.totalCRC));
  assert.equal(cents(result.optionalDeductions.totalCRC), cents(result.optionalDeductions.associationCRC) + cents(result.optionalDeductions.otherCRC));
  assert.equal(cents(result.totalDeductionsCRC), cents(mandatory.totalCRC) + cents(result.incomeTax.afterCreditsCRC) + cents(result.optionalDeductions.totalCRC));
  assert.equal(cents(result.netSalaryCRC), cents(result.grossSalaryCRC) - cents(result.totalDeductionsCRC));
});

test('reports negative net salary when deductions exceed gross salary', () => {
  const result = calculateSalary({ grossSalaryCRC: 100, otherDeductionsCRC: 200 });
  assert.equal(result.totalDeductionsCRC, 210.83);
  assert.equal(result.netSalaryCRC, -110.83);
});

test('rejects invalid input and unsupported precision', () => {
  for (const options of [undefined, null, [], 'salary', {}]) {
    assert.throws(() => calculateSalary(options), /options object|grossSalaryCRC/);
  }
  for (const value of [-1, NaN, Infinity, '100', null, 1.001, 1000000000000.01]) {
    assert.throws(() => calculateSalary({ grossSalaryCRC: value }), /grossSalaryCRC/);
    assert.throws(() => calculateSalary({ grossSalaryCRC: 100, otherDeductionsCRC: value }), /otherDeductionsCRC/);
  }
  for (const value of [-1, 10001, 1.5, NaN, Infinity, '500', null]) {
    assert.throws(() => calculateSalary({ grossSalaryCRC: 100, associationContributionBps: value }), /associationContributionBps/);
  }
  for (const value of [-1, 1.5, NaN, Infinity, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateSalary({ grossSalaryCRC: 100, eligibleChildren: value }), /eligibleChildren/);
  }
  for (const value of [0, 1, 'true', null]) {
    assert.throws(() => calculateSalary({ grossSalaryCRC: 100, spouseTaxCredit: value }), /spouseTaxCredit/);
  }
  assert.throws(() => calculateIncomeTax(-1), /grossSalaryCRC/);
  assert.throws(() => calculateMandatoryContributions(NaN), /grossSalaryCRC/);
  assert.throws(() => applyTaxCredits(-1), /incomeTaxCRC/);
  assert.throws(() => calculateOptionalDeductions(100, 10001), /associationContributionBps/);
});