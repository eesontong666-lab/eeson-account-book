export const GOAL = {
  monthlyDesiredIncome: 30000,
  monthlyOptionReturn: 0.02,
  initialCapital: 100000,
  monthlySavings: 1000,
  annualReturn: 0.2,
};

export const yearlySavings = GOAL.monthlySavings * 12;
export const totalCapitalNeeded = GOAL.monthlyDesiredIncome / GOAL.monthlyOptionReturn;

export type ProjectionPoint = { year: number; balance: number };

/** 从某个起始本金开始，套用同样的年化回报 + 每年存款假设，算要几年才能达到目标金额 */
export function estimateYearsToFI(startingCapital: number = GOAL.initialCapital): number {
  let balance = startingCapital;
  let year = 0;
  while (balance < totalCapitalNeeded && year < 100) {
    balance = balance * (1 + GOAL.annualReturn) + yearlySavings;
    year++;
  }
  return year;
}

/** 按每年底结算：balance = balance*(1+年化回报) + 当年存进去的钱，逐年累积 */
export function buildProjection(startingCapital: number = GOAL.initialCapital, forYears?: number): ProjectionPoint[] {
  const years = forYears ?? estimateYearsToFI(startingCapital);
  const points: ProjectionPoint[] = [{ year: 0, balance: startingCapital }];
  let balance = startingCapital;
  for (let year = 1; year <= years; year++) {
    balance = balance * (1 + GOAL.annualReturn) + yearlySavings;
    points.push({ year, balance });
  }
  return points;
}
