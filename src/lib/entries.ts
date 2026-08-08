import { supabase } from "./supabase";
import { MAIN_INCOME_CATEGORY, isMainIncomeSplittable, splitMainIncome } from "./mainIncomeSplit";

export type EntryType = "收入" | "支出";

export type Entry = {
  id: string;
  type: EntryType;
  amount: number;
  category: string;
  note: string | null;
  account: string;
  occurred_at: string;
};

export const CATEGORIES: Record<EntryType, string[]> = {
  收入: ["利息收入", "收回本金", "佣金/手续费", "其他收入", MAIN_INCOME_CATEGORY],
  支出: ["放款", "员工工资", "营运开销", "其他支出"],
};

export const ALL_CATEGORIES = [...CATEGORIES.收入, ...CATEGORIES.支出];

export const ACCOUNT_NAMES = ["现金", "Maybank", "CIMB", "信用卡"];

export async function addEntry(input: {
  type: EntryType;
  amount: number;
  category: string;
  note: string;
  account?: string;
  occurred_at?: Date;
}) {
  const { error } = await supabase.from("entries").insert({
    type: input.type,
    amount: input.amount,
    category: input.category,
    note: input.note || null,
    account: input.account || "现金",
    occurred_at: (input.occurred_at ?? new Date()).toISOString(),
  });
  if (error) throw error;
}

/**
 * 主收入专用：一笔总额按固定比例拆成 5 笔，分别记到 5 个储蓄桶账户，
 * 不再额外记到银行/现金账户（避免重复记账），一次性批量写入。
 */
export async function addMainIncomeEntry(totalAmount: number, occurredAt: Date, note: string) {
  if (!isMainIncomeSplittable(totalAmount)) {
    throw new Error("金额太小，无法拆分到 5 个储蓄桶");
  }
  const rows = splitMainIncome(totalAmount).map((r) => ({
    type: "收入" as const,
    amount: r.amount,
    category: MAIN_INCOME_CATEGORY,
    note: note || null,
    account: r.name,
    occurred_at: occurredAt.toISOString(),
  }));
  const { error } = await supabase.from("entries").insert(rows);
  if (error) throw error;
}

export async function fetchEntriesForDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: false });

  if (error) throw error;
  return data as Entry[];
}

export async function fetchEntriesForRange(start: Date, end: Date) {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: false });

  if (error) throw error;
  return data as Entry[];
}

export async function fetchEntriesForMonth(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: false });

  if (error) throw error;
  return data as Entry[];
}

export async function fetchAvailableMonths() {
  const { data, error } = await supabase
    .from("entries")
    .select("occurred_at")
    .order("occurred_at", { ascending: false });

  if (error) throw error;

  const months = new Set<string>();
  for (const row of data as { occurred_at: string }[]) {
    const d = new Date(row.occurred_at);
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }
  return Array.from(months).map((key) => {
    const [y, m] = key.split("-").map(Number);
    return { year: y, month: m };
  });
}

export async function fetchRecentEntries(limit: number) {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Entry[];
}

export async function fetchAllEntries() {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (error) throw error;
  return data as Entry[];
}

export async function deleteEntry(id: string) {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}

export async function updateEntry(
  id: string,
  input: {
    type: EntryType;
    amount: number;
    category: string;
    note: string;
    account: string;
    occurred_at: Date;
  }
) {
  const { error } = await supabase
    .from("entries")
    .update({
      type: input.type,
      amount: input.amount,
      category: input.category,
      note: input.note || null,
      account: input.account,
      occurred_at: input.occurred_at.toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** 最近 N 个月（含本月）每月的收入/支出加总，由旧到新排序 */
export async function fetchMonthlyTrend(monthsBack: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .gte("occurred_at", start.toISOString())
    .order("occurred_at", { ascending: true });

  if (error) throw error;
  const entries = data as Entry[];

  const buckets: { key: string; year: number; month: number; income: number; expense: number }[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1) + i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, year: d.getFullYear(), month: d.getMonth(), income: 0, expense: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const e of entries) {
    const d = new Date(e.occurred_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = byKey.get(key);
    if (!bucket) continue;
    if (e.type === "收入") bucket.income += e.amount;
    else bucket.expense += e.amount;
  }

  return buckets;
}

/** 所有记录累积下来的净结余（收入总和 - 支出总和） */
export async function fetchAllTimeNet() {
  const { data, error } = await supabase.from("entries").select("type, amount");
  if (error) throw error;
  const rows = data as { type: EntryType; amount: number }[];
  return rows.reduce((sum, r) => sum + (r.type === "收入" ? r.amount : -r.amount), 0);
}
