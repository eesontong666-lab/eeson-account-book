"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import AddTransactionForm from "@/components/AddTransactionForm";
import { deleteEntry, Entry, EntryType, fetchAllEntries } from "@/lib/entries";
import { fetchCategoriesGrouped } from "@/lib/categories";
import { fetchAccounts } from "@/lib/accounts";

export default function TransactionsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"全部" | EntryType>("全部");
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [accountFilter, setAccountFilter] = useState("全部");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [entriesData, cats, accs] = await Promise.all([
        fetchAllEntries(),
        fetchCategoriesGrouped(),
        fetchAccounts(),
      ]);
      setEntries(entriesData);
      setCategoryOptions([...cats.收入, ...cats.支出]);
      setAccountOptions(accs.map((a) => a.name));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== "全部" && e.type !== typeFilter) return false;
      if (categoryFilter !== "全部" && e.category !== categoryFilter) return false;
      if (accountFilter !== "全部" && e.account !== accountFilter) return false;
      if (from && e.occurred_at < from) return false;
      if (to && e.occurred_at.slice(0, 10) > to) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${e.category} ${e.note ?? ""} ${e.account}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, typeFilter, categoryFilter, accountFilter, from, to, search]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const e of filtered) {
      if (e.type === "收入") income += e.amount;
      else expense += e.amount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  async function confirmDelete() {
    if (!deleting) return;
    await deleteEntry(deleting.id);
    setEntries((prev) => prev.filter((e) => e.id !== deleting.id));
    setDeleting(null);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">交易记录</h1>
          <p className="text-sm text-neutral-500 mt-0.5">所有收入与支出的完整流水</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="bg-indigo-500 hover:bg-indigo-400 transition text-white text-sm font-medium px-4 py-2 rounded-xl"
        >
          + 新增交易
        </button>
      </header>

      {/* 筛选后 汇总 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
          <p className="text-xs text-neutral-500">收入</p>
          <p className="text-emerald-400 font-semibold mt-1">RM {summary.income.toFixed(0)}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
          <p className="text-xs text-neutral-500">支出</p>
          <p className="text-rose-400 font-semibold mt-1">RM {summary.expense.toFixed(0)}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
          <p className="text-xs text-neutral-500">结余</p>
          <p
            className={`font-semibold mt-1 ${
              summary.net >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            RM {summary.net.toFixed(0)}
          </p>
        </div>
      </div>

      {/* 筛选 */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
        <input
          type="text"
          placeholder="搜索分类、备注、账户..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-neutral-600 text-neutral-100"
        />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as never)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-sm text-neutral-100"
          >
            {["全部", "收入", "支出"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-sm text-neutral-100"
          >
            <option>全部</option>
            {categoryOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-sm text-neutral-100"
          >
            <option>全部</option>
            {accountOptions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-sm text-neutral-100"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-sm text-neutral-100"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-neutral-600 text-center py-16">读取中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-neutral-600 text-center py-16">
            {entries.length === 0 ? "还没有记录，先新增一笔试试" : "没有符合条件的记录"}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-100">{e.category}</p>
                  <p className="text-xs text-neutral-500 truncate">
                    {new Date(e.occurred_at).toLocaleDateString("zh-CN")} · {e.account}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`text-sm font-medium mr-1 ${
                      e.type === "收入" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {e.type === "收入" ? "+" : "-"}
                    {e.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => setEditing(e)}
                    aria-label="编辑"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 text-xs"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleting(e)}
                    aria-label="删除"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-rose-400 text-xs"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="新增交易">
        <AddTransactionForm
          onSaved={() => {
            setAddOpen(false);
            load();
          }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="编辑交易">
        {editing && (
          <AddTransactionForm
            initial={editing}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="删除这一笔记录？"
        message={
          deleting
            ? `${deleting.category} · RM ${deleting.amount.toFixed(2)}，删除后无法恢复`
            : ""
        }
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
