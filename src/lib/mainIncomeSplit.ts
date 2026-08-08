export const MAIN_INCOME_CATEGORY = "主收入";

export type MainIncomeBucket = { name: string; percent: number; icon: string };

/** 固定比例，不做 UI 可调（用户要求：越简单越好）。5 项 percent 之和须为 100。 */
export const MAIN_INCOME_BUCKETS: MainIncomeBucket[] = [
  { name: "投资", percent: 35, icon: "📈" },
  { name: "日常消费", percent: 25, icon: "🛒" },
  { name: "教育", percent: 15, icon: "📚" },
  { name: "长期储蓄", percent: 15, icon: "🐷" },
  { name: "娱乐", percent: 10, icon: "🎬" },
];

export const MAIN_INCOME_BUCKET_NAMES = MAIN_INCOME_BUCKETS.map((b) => b.name);

export const MIN_MAIN_INCOME_AMOUNT = 0.05;

export type MainIncomeSplitRow = { name: string; percent: number; amount: number };

/**
 * 把总金额按固定比例拆到 5 个桶，用「分」为单位做整数四舍五入，
 * 再把四舍五入产生的尾差吸收进第一个桶（投资），保证 5 笔加总严格等于原始金额。
 */
export function splitMainIncome(totalAmount: number): MainIncomeSplitRow[] {
  const totalCents = Math.round(totalAmount * 100);
  const rawCents = MAIN_INCOME_BUCKETS.map((b) => Math.round((totalCents * b.percent) / 100));
  const diff = totalCents - rawCents.reduce((s, v) => s + v, 0);
  rawCents[0] += diff;
  return MAIN_INCOME_BUCKETS.map((b, i) => ({ name: b.name, percent: b.percent, amount: rawCents[i] / 100 }));
}

/** entries.amount 有 CHECK(amount > 0)，金额太小时某个桶可能会被算成 RM0，提前挡掉。 */
export function isMainIncomeSplittable(totalAmount: number): boolean {
  if (!totalAmount || totalAmount <= 0) return false;
  return splitMainIncome(totalAmount).every((row) => row.amount > 0);
}
