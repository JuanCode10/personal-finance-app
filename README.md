# Costa Rica salary calculation engine

Dependency-free JavaScript modules for estimating a salaried employee's monthly take-home pay in Costa Rica using the 2026 parameters. This is an estimate, not legal, tax, or payroll advice.

## Structure

- `src/rules/payroll-2026.js`: year, source URLs, contribution rates, tax brackets, and tax credits.
- `src/calculations/salary.js`: independent calculations and the `calculateSalary` orchestration function.
- `tests/salary.test.js`: tests using Node's built-in test runner.
- `package.json`: ES module configuration and test command.

## Running tests

Use Node.js 18 or newer:

```sh
npm test
```

No package installation is required.

## Usage

```js
import { calculateSalary } from './src/calculations/salary.js';

const salary = calculateSalary({
  grossSalaryCRC: 1000000,
  associationContributionBps: 500,
  otherDeductionsCRC: 25000,
  eligibleChildren: 1,
  spouseTaxCredit: false,
});

console.log(salary.netSalaryCRC);
```

Only `grossSalaryCRC` is required. Optional deductions and the eligible child count default to zero; the spouse credit defaults to false. Amounts are numbers in CRC, with at most two decimal places. Monetary inputs must be between 0 and 1,000,000,000,000 CRC. Rates are integer basis points from 0 to 10,000 (500 means 5%). The child count must be a non-negative safe integer, and `spouseTaxCredit` must be a boolean. Invalid inputs throw an error.

The result contains `grossSalaryCRC`, `mandatoryContributions` (individual amounts and total), `incomeTax` (before and after credits, applied credits, and bracket breakdown), `optionalDeductions` (association, other, and total), `totalDeductionsCRC`, and `netSalaryCRC`. Each bracket reports its limits, rate, taxable income, and tax; a null upper limit means no upper limit.

The exported functions can also be used independently:

- `calculateMandatoryContributions(grossSalaryCRC)` calculates SEM, IVM, and Banco Popular contributions and their sum.
- `calculateIncomeTax(grossSalaryCRC)` calculates marginal tax and returns all bracket details before credits.
- `applyTaxCredits(incomeTaxCRC, eligibleChildren, spouseTaxCredit)` returns the actual applied child and spouse credits and tax remaining.
- `calculateOptionalDeductions(grossSalaryCRC, associationContributionBps, otherDeductionsCRC)` calculates the association and fixed deductions.
- `calculateSalary(options)` validates and combines these calculations into the complete monthly estimate.

## Method and assumptions

- Apply the configured employee contribution rates to gross salary. Calculate income tax progressively on gross salary, without subtracting social security contributions first.
- The caller is responsible for verifying and declaring eligibility for every child and the spouse. Credits cannot reduce tax below zero. For reporting purposes, child credits are allocated first, then the spouse credit; unused credits are not returned or carried forward. This allocation order is a modeling choice, not a legal priority.
- The association percentage applies to gross salary. Other deductions are a fixed monthly amount; neither optional deduction reduces the tax base. The model does not enforce employer-specific association rules or legal limits on deductions.
- Inputs and outputs are in CRC to the nearest cent. Convert inputs to integer cents; multiply each individual contribution, each tax bracket, and the association deduction using integer basis-point arithmetic. Round each result to the nearest cent, with exact half cents rounded up. Sum the rounded components, not unrounded rates. Fixed deductions and credits are exact cents. This is a modeling convention and may differ from an employer's payroll rounding.
- If deductions exceed gross salary, the result reports a negative net salary instead of capping deductions or inventing a payroll priority. Review how a real employer handles this case.
- Gross salary is assumed to be fully taxable and subject to the stated contribution rates. The model does not handle exceptional payroll arrangements, employer contributions, bonuses, overtime, annual reconciliation, or multiple employment income.

## References

- [Ministerio de Hacienda: 2026 income tax brackets](https://www.hacienda.go.cr/docs/TramosRenta2026.pdf)
- [BDO: 2026 salary tax brackets and credits](https://www.bdo.cr/es-cr/publicaciones/2025/nuevos-tramos-de-renta-para-el-2026)
- [BDO: 2026 employee contribution rates](https://www.bdo.cr/es-cr/publicaciones/2025/costa-rica-ajuste-en-cuotas-obrero-patronales-de-la-ccss-a-partir-del-1-de-enero-de-2026)
