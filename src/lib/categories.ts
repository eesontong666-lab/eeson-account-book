import { supabase } from "./supabase";
import { EntryType } from "./entries";

export type Category = {
  id: string;
  name: string;
  type: EntryType;
};

export async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("created_at");
  if (error) throw error;
  return data as Category[];
}

export async function fetchCategoriesGrouped(): Promise<Record<EntryType, string[]>> {
  const categories = await fetchCategories();
  return {
    收入: categories.filter((c) => c.type === "收入").map((c) => c.name),
    支出: categories.filter((c) => c.type === "支出").map((c) => c.name),
  };
}

export async function addCategory(input: { name: string; type: EntryType }) {
  const { error } = await supabase.from("categories").insert(input);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function countEntriesForCategory(name: string) {
  const { count, error } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("category", name);
  if (error) throw error;
  return count ?? 0;
}
