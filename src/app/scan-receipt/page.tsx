"use client";

import { useEffect, useRef, useState } from "react";
import { addEntry, ALL_CATEGORIES } from "@/lib/entries";
import { fetchCategoriesGrouped } from "@/lib/categories";
import { fetchAccounts } from "@/lib/accounts";

type Step = "upload" | "scanning" | "review" | "saving" | "done";

type FormState = {
  merchant: string;
  date: string;
  amount: string;
  category: string;
  account: string;
  note: string;
};

function emptyForm(): FormState {
  return {
    merchant: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    category: "",
    account: "",
    note: "",
  };
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

export default function ScanReceiptPage() {
  const [step, setStep] = useState<Step>("upload");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState("");
  const [scanError, setScanError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [expenseCategories, setExpenseCategories] = useState<string[]>(ALL_CATEGORIES);
  const [accountNames, setAccountNames] = useState<string[]>(["现金"]);

  useEffect(() => {
    Promise.all([fetchCategoriesGrouped(), fetchAccounts()]).then(([cats, accs]) => {
      setExpenseCategories(cats.支出.length ? cats.支出 : ALL_CATEGORIES);
      setAccountNames(accs.map((a) => a.name));
    });
  }, []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    setStep("scanning");
    setScanError("");

    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });
      const data = await res.json();

      if (!res.ok) {
        setScanError(data.error || "识别失败，请手动填写");
        setForm({
          ...emptyForm(),
          category: expenseCategories[0] ?? "",
          account: accountNames[0] ?? "",
        });
        setStep("review");
        return;
      }

      const note =
        data.currency !== "MYR"
          ? `原始金额 ${data.currency} ${data.originalAmount.toFixed(2)}`
          : "";

      setForm({
        merchant: data.merchant || "",
        date: data.date || new Date().toISOString().slice(0, 10),
        amount: data.myrAmount.toFixed(2),
        category: expenseCategories[0] ?? "",
        account: accountNames[0] ?? "",
        note,
      });
      setStep("review");
    } catch {
      setScanError("识别失败，请手动填写");
      setForm({
        ...emptyForm(),
        category: expenseCategories[0] ?? "",
        account: accountNames[0] ?? "",
      });
      setStep("review");
    }
  }

  function reset() {
    setStep("upload");
    setImageUrl(null);
    setError("");
    setScanError("");
  }

  async function handleSave() {
    setError("");
    const value = parseFloat(form.amount);
    if (!value || value <= 0) {
      setError("金额要大于 0");
      return;
    }
    setStep("saving");
    try {
      await addEntry({
        type: "支出",
        amount: value,
        category: form.category,
        note: form.merchant + (form.note ? ` · ${form.note}` : ""),
        account: form.account,
        occurred_at: new Date(form.date + "T12:00:00"),
      });
      setStep("done");
    } catch {
      setError("保存失败，请再试一次");
      setStep("review");
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">扫描收据</h1>
        <p className="text-sm text-neutral-500 mt-0.5">拍照或上传，AI 帮你看总额，外币会自动换成 RM</p>
      </header>

      {step === "upload" && (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-neutral-700 rounded-2xl aspect-[3/4] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-500/50 transition bg-neutral-900"
        >
          <span className="text-4xl">📷</span>
          <p className="text-sm text-neutral-300">拍照 / 上传收据</p>
          <p className="text-xs text-neutral-600">支持 JPG、PNG</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {step === "scanning" && imageUrl && (
        <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-neutral-900 border border-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="收据预览" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-white">AI 正在看总额和货币...</p>
          </div>
        </div>
      )}

      {(step === "review" || step === "saving") && imageUrl && (
        <>
          <div className="rounded-2xl overflow-hidden aspect-[3/2] bg-neutral-900 border border-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="收据预览" className="w-full h-full object-cover" />
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-4">
            <p className="text-sm font-medium text-neutral-300">识别出来的资料，确认一下</p>
            {scanError && <p className="text-sm text-rose-400">{scanError}</p>}
            {!scanError && form.note && (
              <p className="text-xs text-indigo-400">已经自动把外币换成 RM：{form.note}</p>
            )}

            <Field label="商家">
              <input
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
              />
            </Field>

            <Field label="日期">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
              />
            </Field>

            <Field label="金额 (RM)">
              <input
                type="number"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-lg font-semibold text-neutral-100"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="分类">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
                >
                  {expenseCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="付款账户">
                <select
                  value={form.account}
                  onChange={(e) => setForm({ ...form, account: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
                >
                  {accountNames.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="备注">
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
              />
            </Field>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={reset}
              disabled={step === "saving"}
              className="flex-1 py-3 rounded-xl border border-neutral-800 text-neutral-300 text-sm font-medium disabled:opacity-50"
            >
              取消 / 重新拍
            </button>
            <button
              onClick={handleSave}
              disabled={step === "saving"}
              className="flex-1 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition text-white text-sm font-medium disabled:opacity-60"
            >
              {step === "saving" ? "保存中..." : "保存这一笔"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <span className="text-5xl">✅</span>
          <p className="text-neutral-100 font-medium">已保存</p>
          <p className="text-sm text-neutral-500 text-center max-w-xs">
            这一笔已经记到交易记录里了，金额是 AI 帮你从收据看出来、换算成 RM 的
          </p>
          <button
            onClick={reset}
            className="mt-2 px-5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm"
          >
            再扫一张
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-neutral-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
