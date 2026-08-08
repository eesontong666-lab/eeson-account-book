import { supabase } from "./supabase";
import { MAIN_INCOME_BUCKETS } from "./mainIncomeSplit";

export type AccountType = "银行" | "现金" | "信用卡" | "投资" | "预算";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: number;
  bank_group: string | null;
};

export const ACCOUNT_TYPES: AccountType[] = ["银行", "现金", "信用卡", "投资", "预算"];

const LIABILITY_TYPES: AccountType[] = ["信用卡"];

export function isAsset(type: AccountType) {
  return !LIABILITY_TYPES.includes(type);
}

const NAME_ICONS: Record<string, string> = {
  ...Object.fromEntries(MAIN_INCOME_BUCKETS.map((b) => [b.name, b.icon])),
  IBKR: "💼",
  "Tiger Broker": "🐯",
};

export function iconFor(type: AccountType, name?: string) {
  if (name && NAME_ICONS[name]) return NAME_ICONS[name];
  if (type === "银行") return "🏦";
  if (type === "现金") return "💵";
  if (type === "信用卡") return "💳";
  if (type === "投资") return "📈";
  return "🎯";
}

export async function fetchAccounts() {
  const { data, error } = await supabase.from("accounts").select("*").order("created_at");
  if (error) throw error;
  return data as Account[];
}

export async function addAccount(input: {
  name: string;
  type: AccountType;
  opening_balance: number;
  bank_group?: string | null;
}) {
  const { error } = await supabase
    .from("accounts")
    .insert({ ...input, bank_group: input.bank_group || null });
  if (error) throw error;
}

export async function updateAccount(
  id: string,
  input: { name: string; type: AccountType; opening_balance: number; bank_group?: string | null }
) {
  const { error } = await supabase
    .from("accounts")
    .update({ ...input, bank_group: input.bank_group || null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAccount(id: string) {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function countEntriesForAccount(name: string) {
  const { count, error } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("account", name);
  if (error) throw error;
  return count ?? 0;
}

export type AccountWithBalance = Account & {
  balance: number;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
};

/** 每个账户的余额 = 期初余额 + 收入 - 支出 + 转入 - 转出 */
export async function fetchAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const [
    { data: accountsData, error: accErr },
    { data: entriesData, error: entErr },
    { data: transfersData, error: trErr },
  ] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("entries").select("account, type, amount"),
    supabase.from("transfers").select("from_account, to_account, amount"),
  ]);
  if (accErr) throw accErr;
  if (entErr) throw entErr;
  if (trErr) throw trErr;

  const accounts = accountsData as Account[];
  const entries = entriesData as { account: string; type: "收入" | "支出"; amount: number }[];
  const transfers = transfersData as { from_account: string; to_account: string; amount: number }[];

  return accounts.map((acc) => {
    let income = 0;
    let expense = 0;
    let transferIn = 0;
    let transferOut = 0;
    for (const e of entries) {
      if (e.account !== acc.name) continue;
      if (e.type === "收入") income += e.amount;
      else expense += e.amount;
    }
    for (const t of transfers) {
      if (t.to_account === acc.name) transferIn += t.amount;
      if (t.from_account === acc.name) transferOut += t.amount;
    }
    return {
      ...acc,
      income,
      expense,
      transferIn,
      transferOut,
      balance: acc.opening_balance + income - expense + transferIn - transferOut,
    };
  });
}

export async function fetchNetWorth() {
  const accounts = await fetchAccountsWithBalances();
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    if (isAsset(a.type)) assets += a.balance;
    else liabilities += Math.abs(a.balance);
  }
  return { assets, liabilities, netWorth: assets - liabilities };
}
