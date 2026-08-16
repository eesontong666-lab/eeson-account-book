"use client";

import { useEffect, useRef, useState } from "react";
import { addEntry, ALL_CATEGORIES, EntryType } from "@/lib/entries";
import { fetchCategoriesGrouped } from "@/lib/categories";
import { fetchAccounts } from "@/lib/accounts";

type ItemStatus = "scanning" | "ready" | "error" | "saving" | "saved";

type ReceiptItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: ItemStatus;
  type: EntryType;
  merchant: string;
  date: string;
  amount: string;
  category: string;
  account: string;
  note: string;
  errorMsg?: string;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const SCAN_CONCURRENCY = 3;

export default function ScanReceiptPage() {
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(ALL_CATEGORIES);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [accountNames, setAccountNames] = useState<string[]>(["现金"]);
  const [savingAll, setSavingAll] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [globalError, setGlobalError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([fetchCategoriesGrouped(), fetchAccounts()]).then(([cats, accs]) => {
      setExpenseCategories(cats.支出.length ? cats.支出 : ALL_CATEGORIES);
      setIncomeCategories(cats.收入);
      setAccountNames(accs.map((a) => a.name));
    });
  }, []);

  function updateItem(id: string, patch: Partial<ReceiptItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function scanOne(id: string, file: File) {
    updateItem(id, { status: "scanning", errorMsg: undefined });
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: file.type,
          expenseCategories,
          incomeCategories,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        updateItem(id, { status: "error", errorMsg: data.error || "识别失败，请手动填写" });
        return;
      }

      const note =
        data.currency !== "MYR" ? `原始金额 ${data.currency} ${data.originalAmount.toFixed(2)}` : "";
      const type: EntryType = data.type === "收入" ? "收入" : "支出";
      const fallbackList = type === "收入" ? incomeCategories : expenseCategories;

      updateItem(id, {
        status: "ready",
        type,
        merchant: data.merchant || "",
        date: data.date || todayStr(),
        amount: data.myrAmount.toFixed(2),
        category: data.category || fallbackList[0] || "",
        note,
      });
    } catch {
      updateItem(id, { status: "error", errorMsg: "识别失败，请手动填写" });
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const newItems: ReceiptItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "scanning",
      type: "支出",
      merchant: "",
      date: todayStr(),
      amount: "",
      category: expenseCategories[0] || "",
      account: accountNames[0] || "",
      note: "",
    }));

    setItems((prev) => [...prev, ...newItems]);
    setGlobalError("");

    let idx = 0;
    async function worker() {
      while (idx < newItems.length) {
        const mine = newItems[idx++];
        await scanOne(mine.id, mine.file);
      }
    }
    for (let w = 0; w < Math.min(SCAN_CONCURRENCY, newItems.length); w++) worker();

    if (inputRef.current) inputRef.current.value = "";
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function retryScan(id: string) {
    const item = items.find((it) => it.id === id);
    if (item) scanOne(id, item.file);
  }

  async function saveAll() {
    setGlobalError("");
    const toSave = items.filter(
      (it) => (it.status === "ready" || it.status === "error") && parseFloat(it.amount) > 0
    );
    if (toSave.length === 0) {
      setGlobalError("目前没有金额填好的单据可以保存");
      return;
    }

    setSavingAll(true);
    let count = 0;
    for (const it of toSave) {
      updateItem(it.id, { status: "saving" });
      try {
        await addEntry({
          type: it.type,
          amount: parseFloat(it.amount),
          category: it.category,
          note: it.merchant + (it.note ? ` · ${it.note}` : ""),
          account: it.account,
          occurred_at: new Date(it.date + "T12:00:00"),
        });
        updateItem(it.id, { status: "saved" });
        count++;
      } catch {
        updateItem(it.id, { status: "error", errorMsg: "保存失败，请再试一次" });
      }
    }
    setSavingAll(false);
    setSavedCount((c) => c + count);
  }

  function resetAll() {
    setItems([]);
    setSavedCount(0);
    setGlobalError("");
  }

  const visibleItems = items.filter((it) => it.status !== "saved");
  const scanningCount = items.filter((it) => it.status === "scanning").length;
  const readyCount = items.filter((it) => it.status === "ready" || it.status === "error").length;
  const allSaved = items.length > 0 && visibleItems.length === 0;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">扫描收据</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          一次可以选好几张照片，AI 会自动看金额、判断是收入还是支出、还帮你选分类
        </p>
      </header>

      {items.length === 0 && (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-neutral-700 rounded-2xl aspect-[3/4] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-500/50 transition bg-neutral-900"
        >
          <span className="text-4xl">📷</span>
          <p className="text-sm text-neutral-300">拍照 / 从图库选单据</p>
          <p className="text-xs text-neutral-600">收据、利息单、存款单都可以，一次选多张</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              {scanningCount > 0 && `${scanningCount} 张辨识中 · `}
              {readyCount > 0 && `${readyCount} 张待确认 · `}
              已保存 {savedCount} 张
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              + 继续加照片
            </button>
          </div>

          {visibleItems.length === 0 && allSaved ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <span className="text-5xl">✅</span>
              <p className="text-neutral-100 font-medium">已保存 {savedCount} 笔</p>
              <p className="text-sm text-neutral-500 text-center max-w-xs">
                这些都已经记到交易记录里了，金额是 AI 帮你从单据看出来、换算成 RM 的
              </p>
              <button
                onClick={resetAll}
                className="mt-2 px-5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm"
              >
                再扫一批
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {visibleItems.map((it) => (
                  <ReceiptCard
                    key={it.id}
                    item={it}
                    expenseCategories={expenseCategories}
                    incomeCategories={incomeCategories}
                    accountNames={accountNames}
                    onChange={(patch) => updateItem(it.id, patch)}
                    onRemove={() => removeItem(it.id)}
                    onRetry={() => retryScan(it.id)}
                  />
                ))}
              </div>

              {globalError && <p className="text-sm text-rose-400">{globalError}</p>}

              <button
                onClick={saveAll}
                disabled={savingAll || scanningCount > 0}
                className="py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition text-white text-sm font-medium disabled:opacity-60"
              >
                {savingAll
                  ? "保存中..."
                  : scanningCount > 0
                  ? "还有照片在辨识中..."
                  : `保存全部（${readyCount} 张）`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ReceiptCard({
  item,
  expenseCategories,
  incomeCategories,
  accountNames,
  onChange,
  onRemove,
  onRetry,
}: {
  item: ReceiptItem;
  expenseCategories: string[];
  incomeCategories: string[];
  accountNames: string[];
  onChange: (patch: Partial<ReceiptItem>) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const scanning = item.status === "scanning";
  const saving = item.status === "saving";
  const categoryList = item.type === "收入" ? incomeCategories : expenseCategories;

  function setType(type: EntryType) {
    if (type === item.type) return;
    const list = type === "收入" ? incomeCategories : expenseCategories;
    onChange({ type, category: list[0] || "" });
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-neutral-950 border border-neutral-800 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.previewUrl} alt="单据预览" className="w-full h-full object-cover" />
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <input
            value={item.merchant}
            onChange={(e) => onChange({ merchant: e.target.value })}
            placeholder={scanning ? "辨识中..." : "商家 / 来源名称"}
            disabled={scanning || saving}
            className="w-full bg-transparent text-sm font-medium text-neutral-100 placeholder:text-neutral-600 disabled:opacity-50"
          />
          {item.status === "error" && item.errorMsg && (
            <p className="text-xs text-rose-400 mt-0.5">{item.errorMsg}</p>
          )}
          {item.status !== "error" && item.note && (
            <p className="text-xs text-indigo-400 mt-0.5">已换算：{item.note}</p>
          )}
        </div>

        <button
          onClick={onRemove}
          disabled={saving}
          className="text-neutral-600 hover:text-rose-400 text-sm shrink-0 disabled:opacity-40"
        >
          ✕
        </button>
      </div>

      {item.status === "error" && (
        <button
          onClick={onRetry}
          className="self-start text-xs px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-300 hover:text-neutral-100"
        >
          重新辨识
        </button>
      )}

      {!scanning && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-neutral-800 overflow-hidden shrink-0">
              <button
                onClick={() => setType("支出")}
                disabled={saving}
                className={`w-9 py-2 text-sm font-semibold disabled:opacity-50 ${
                  item.type === "支出" ? "bg-rose-500/20 text-rose-400" : "text-neutral-500"
                }`}
              >
                −
              </button>
              <button
                onClick={() => setType("收入")}
                disabled={saving}
                className={`w-9 py-2 text-sm font-semibold disabled:opacity-50 ${
                  item.type === "收入" ? "bg-emerald-500/20 text-emerald-400" : "text-neutral-500"
                }`}
              >
                ＋
              </button>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={item.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
              disabled={saving}
              placeholder="金额 (RM)"
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-base font-semibold text-neutral-100 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={item.category}
              onChange={(e) => onChange({ category: e.target.value })}
              disabled={saving}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-xs text-neutral-100 disabled:opacity-50"
            >
              {categoryList.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={item.account}
              onChange={(e) => onChange({ account: e.target.value })}
              disabled={saving}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-xs text-neutral-100 disabled:opacity-50"
            >
              {accountNames.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>

          <input
            type="date"
            value={item.date}
            onChange={(e) => onChange({ date: e.target.value })}
            disabled={saving}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 disabled:opacity-50"
          />
        </>
      )}
    </div>
  );
}
