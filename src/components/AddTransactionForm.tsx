"use client";

import { useEffect, useState } from "react";
import { addEntry, addMainIncomeEntry, Entry, EntryType, updateEntry } from "@/lib/entries";
import { fetchCategoriesGrouped } from "@/lib/categories";
import { fetchAccounts } from "@/lib/accounts";
import { MAIN_INCOME_CATEGORY, isMainIncomeSplittable, splitMainIncome } from "@/lib/mainIncomeSplit";

export default function AddTransactionForm({
  initial,
  presetAccount,
  onSaved,
}: {
  initial?: Entry;
  presetAccount?: string;
  onSaved: () => void;
}) {
  const isEdit = !!initial;

  const [type, setType] = useState<EntryType>(initial?.type ?? "支出");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [account, setAccount] = useState(initial?.account ?? presetAccount ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(() =>
    initial ? initial.occurred_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );

  const [categories, setCategories] = useState<Record<EntryType, string[]>>({ 收入: [], 支出: [] });
  const [accountNames, setAccountNames] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchCategoriesGrouped(), fetchAccounts()])
      .then(([cats, accs]) => {
        setCategories(cats);
        const names = accs.map((a) => a.name);
        setAccountNames(names);
        if (!category) setCategory(cats[type][0] ?? "");
        if (!account) setAccount(presetAccount ?? names[0] ?? "");
      })
      .finally(() => setLoadingOptions(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchType(next: EntryType) {
    setType(next);
    if (!isEdit || category === "") setCategory(categories[next][0] ?? "");
  }

  // 只有新增（不是编辑）而且选到「主收入」分类时，才进入自动拆分模式。
  // 编辑既有的一笔桶记录（例如 Transactions 里已经生成的「投资」那一行）
  // 永远走原本单笔编辑流程，不会重新触发拆分 UI。
  const isMainIncomeSplit = !isEdit && !presetAccount && type === "收入" && category === MAIN_INCOME_CATEGORY;
  const amountValue = parseFloat(amount) || 0;
  const splitPreview = isMainIncomeSplit ? splitMainIncome(amountValue) : [];
  const splitValid = !isMainIncomeSplit || isMainIncomeSplittable(amountValue);

  function selectCategory(c: string) {
    setCategory(c);
    if (type === "收入" && c !== MAIN_INCOME_CATEGORY && !account) {
      setAccount(accountNames[0] ?? "");
    }
  }

  async function handleSave() {
    setError("");
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setError("金额要大于 0");
      return;
    }
    if (!category) {
      setError("请选择分类");
      return;
    }
    if (!date) {
      setError("请选择日期");
      return;
    }

    if (isMainIncomeSplit) {
      if (!isMainIncomeSplittable(value)) {
        setError("金额太小，无法拆分到 5 个储蓄桶");
        return;
      }
      setSaving(true);
      try {
        await addMainIncomeEntry(value, new Date(date + "T12:00:00"), note);
        onSaved();
      } catch {
        setError("保存失败，请再试一次");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!account) {
      setError("请选择账户");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && initial) {
        await updateEntry(initial.id, {
          type,
          amount: value,
          category,
          note,
          account,
          occurred_at: new Date(date + "T12:00:00"),
        });
      } else {
        await addEntry({
          type,
          amount: value,
          category,
          note,
          account,
          occurred_at: new Date(date + "T12:00:00"),
        });
      }
      onSaved();
    } catch {
      setError("保存失败，请再试一次");
    } finally {
      setSaving(false);
    }
  }

  if (loadingOptions) {
    return <p className="text-sm text-neutral-500 text-center py-8">读取中...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 bg-neutral-950 border border-neutral-800 rounded-xl p-1">
        {(["收入", "支出"] as EntryType[]).map((t) => (
          <button
            key={t}
            onClick={() => switchType(t)}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              type === t
                ? t === "收入"
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500 text-white"
                : "text-neutral-400"
            }`}
          >
            {t === "收入" ? "＋ 收入" : "－ 支出"}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-neutral-500">金额 (RM)</label>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full text-2xl font-semibold outline-none mt-1 bg-transparent placeholder:text-neutral-700 text-neutral-100"
        />
      </div>

      <div>
        <label className="text-xs text-neutral-500">分类</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {categories[type].length === 0 && (
            <span className="text-xs text-neutral-600">还没有分类，先到设置新增</span>
          )}
          {categories[type].map((c) => (
            <button
              key={c}
              onClick={() => selectCategory(c)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                category === c
                  ? "bg-neutral-100 text-neutral-900 border-neutral-100"
                  : "bg-transparent text-neutral-400 border-neutral-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isMainIncomeSplit ? (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-neutral-500">自动拆分到 5 个储蓄桶</label>
            <div className="mt-1.5 flex flex-col gap-1.5 bg-neutral-950 border border-neutral-800 rounded-lg p-3">
              {splitPreview.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-300">
                    {row.name} <span className="text-neutral-600">{row.percent}%</span>
                  </span>
                  <span className={row.amount > 0 ? "text-neutral-100" : "text-rose-400"}>
                    RM {row.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            {!splitValid && (
              <p className="text-xs text-rose-400 mt-1.5">金额太小，无法拆分到 5 个桶</p>
            )}
          </div>
          <div>
            <label className="text-xs text-neutral-500">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500">账户</label>
            {presetAccount ? (
              <p className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100">
                {presetAccount}
              </p>
            ) : (
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
              >
                {accountNames.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-neutral-500">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-neutral-500">备注（选填）</label>
        <input
          type="text"
          placeholder="例如：客户名字、用途..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-neutral-700 text-neutral-100"
        />
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={!amount || saving}
        className="w-full py-3 rounded-xl bg-indigo-500 text-white font-medium disabled:bg-neutral-800 disabled:text-neutral-600 transition"
      >
        {saving ? "保存中..." : isEdit ? "保存修改" : "保存这一笔"}
      </button>
    </div>
  );
}
