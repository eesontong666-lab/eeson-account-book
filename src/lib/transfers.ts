import { supabase } from "./supabase";

export type Transfer = {
  id: string;
  from_account: string;
  to_account: string;
  amount: number;
  note: string | null;
  occurred_at: string;
};

export async function fetchTransfers() {
  const { data, error } = await supabase
    .from("transfers")
    .select("*")
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return data as Transfer[];
}

export async function addTransfer(input: {
  from_account: string;
  to_account: string;
  amount: number;
  note: string;
  occurred_at?: Date;
}) {
  const { error } = await supabase.from("transfers").insert({
    from_account: input.from_account,
    to_account: input.to_account,
    amount: input.amount,
    note: input.note || null,
    occurred_at: (input.occurred_at ?? new Date()).toISOString(),
  });
  if (error) throw error;
}

export async function updateTransfer(
  id: string,
  input: { from_account: string; to_account: string; amount: number; note: string; occurred_at: Date }
) {
  const { error } = await supabase
    .from("transfers")
    .update({
      from_account: input.from_account,
      to_account: input.to_account,
      amount: input.amount,
      note: input.note || null,
      occurred_at: input.occurred_at.toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTransfer(id: string) {
  const { error } = await supabase.from("transfers").delete().eq("id", id);
  if (error) throw error;
}

export async function countTransfersForAccount(name: string) {
  const { count, error } = await supabase
    .from("transfers")
    .select("id", { count: "exact", head: true })
    .or(`from_account.eq.${name},to_account.eq.${name}`);
  if (error) throw error;
  return count ?? 0;
}
